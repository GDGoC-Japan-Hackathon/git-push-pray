output "frontend_url" {
  description = "URL of the Frontend Cloud Run service"
  value       = google_cloud_run_v2_service.frontend.uri
}

output "backend_url" {
  description = "URL of the Backend Cloud Run service"
  value       = google_cloud_run_v2_service.backend.uri
}

output "artifact_registry_repo_name" {
  description = "Name of the Artifact Registry repository"
  value       = google_artifact_registry_repository.repo.name
}

output "db_connection_name" {
  description = "Cloud SQL connection name (PROJECT:REGION:INSTANCE) for Cloud Run and local proxy"
  value       = google_sql_database_instance.main.connection_name
}
