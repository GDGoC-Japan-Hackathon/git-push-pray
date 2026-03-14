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
