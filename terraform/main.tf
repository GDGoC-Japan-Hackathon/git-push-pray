# Enable necessary GCP APIs
resource "google_project_service" "enabled_apis" {
  for_each = toset([
    "cloudresourcemanager.googleapis.com",
    "iam.googleapis.com",
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "aiplatform.googleapis.com",
  ])
  service            = each.key
  disable_on_destroy = false
}

# Artifact Registry Repository for Docker images
resource "google_artifact_registry_repository" "repo" {
  provider      = google
  location      = var.region
  repository_id = "cloud-run-source-deploy"
  description   = "Docker repository for git-push-pray Cloud Run services"
  format        = "DOCKER"

  depends_on = [google_project_service.enabled_apis]
}

# Frontend Cloud Run Service
resource "google_cloud_run_v2_service" "frontend" {
  name     = var.frontend_service_name
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    containers {
      # Dummy image for initial creation. Will be overwritten by GitHub Actions.
      image = "us-docker.pkg.dev/cloudrun/container/hello"
      ports {
        container_port = 8080
      }
    }
  }

  lifecycle {
    ignore_changes = [
      template[0].containers[0].image,
      client,
      client_version
    ]
  }

  depends_on = [google_project_service.enabled_apis]
}

# Allow unauthenticated access to the Frontend
resource "google_cloud_run_v2_service_iam_member" "frontend_public" {
  project  = google_cloud_run_v2_service.frontend.project
  location = google_cloud_run_v2_service.frontend.location
  name     = google_cloud_run_v2_service.frontend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Backend Cloud Run Service
resource "google_cloud_run_v2_service" "backend" {
  name     = var.backend_service_name
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    # Assume the backend uses a dedicated service account so it has permissions for Vertex AI
    service_account = google_service_account.backend_sa.email

    containers {
      # Dummy image for initial creation. Will be overwritten by CI/CD.
      image = "us-docker.pkg.dev/cloudrun/container/hello"
      ports {
        container_port = 8081
      }
      # Required for Vertex AI calls using ADC
      env {
        name  = "GOOGLE_CLOUD_PROJECT"
        value = var.project_id
      }
      env {
        name  = "GOOGLE_CLOUD_LOCATION"
        value = var.region
      }
      env {
        name  = "GOOGLE_GENAI_USE_VERTEXAI"
        value = "TRUE"
      }
    }
  }

  lifecycle {
    ignore_changes = [
      template[0].containers[0].image,
      client,
      client_version
    ]
  }

  depends_on = [google_project_service.enabled_apis, google_service_account.backend_sa]
}

# Allow unauthenticated access to the Backend (since Frontend calls it directly from browser)
resource "google_cloud_run_v2_service_iam_member" "backend_public" {
  project  = google_cloud_run_v2_service.backend.project
  location = google_cloud_run_v2_service.backend.location
  name     = google_cloud_run_v2_service.backend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
