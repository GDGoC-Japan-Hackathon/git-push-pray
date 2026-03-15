# Service Account for the Backend Cloud Run service
resource "google_service_account" "backend_sa" {
  account_id   = "git-push-pray-backend-sa"
  display_name = "Backend Service Account for git-push-pray"
}

# Grant Vertex AI User to Backend Service Account
resource "google_project_iam_member" "backend_vertex_ai_user" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.backend_sa.email}"
}

# Grant Firebase Auth Viewer to Backend Service Account (for ID Token verification / user discovery if needed)
resource "google_project_iam_member" "backend_firebase_auth" {
  project = var.project_id
  role    = "roles/firebaseauth.viewer"
  member  = "serviceAccount:${google_service_account.backend_sa.email}"
}

# -------------------------------------------------------
# IAM roles for GitHub Actions deployer service account
# NOTE: These are "bootstrap" permissions required for Terraform CI/CD to run.
#       They must be granted manually before the first CI/CD execution.
#       Defined here as a record; applying has no side effects if already granted.
# -------------------------------------------------------
locals {
  github_actions_sa = "serviceAccount:github-actions-deployer@${var.project_id}.iam.gserviceaccount.com"
}

resource "google_project_iam_member" "gha_service_usage_admin" {
  project = var.project_id
  role    = "roles/serviceusage.serviceUsageAdmin"
  member  = local.github_actions_sa
}

resource "google_project_iam_member" "gha_project_iam_admin" {
  project = var.project_id
  role    = "roles/resourcemanager.projectIamAdmin"
  member  = local.github_actions_sa
}

resource "google_project_iam_member" "gha_artifactregistry_admin" {
  project = var.project_id
  role    = "roles/artifactregistry.admin"
  member  = local.github_actions_sa
}

resource "google_project_iam_member" "gha_service_account_admin" {
  project = var.project_id
  role    = "roles/iam.serviceAccountAdmin"
  member  = local.github_actions_sa
}

resource "google_project_iam_member" "gha_cloud_run_admin" {
  project = var.project_id
  role    = "roles/run.admin"
  member  = local.github_actions_sa
}
