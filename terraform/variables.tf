variable "project_id" {
  description = "The ID of the GCP Project"
  type        = string
}

variable "region" {
  description = "The default GCP region"
  type        = string
  default     = "asia-northeast1"
}

variable "frontend_service_name" {
  description = "Name of the Frontend Cloud Run service"
  type        = string
  default     = "git-push-pray-frontend"
}

variable "backend_service_name" {
  description = "Name of the Backend Cloud Run service"
  type        = string
  default     = "git-push-pray-backend"
}
