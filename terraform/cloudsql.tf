# Cloud SQLインスタンス
resource "google_sql_database_instance" "main" {
  name             = "git-push-pray-db"
  database_version = "POSTGRES_18"
  region           = var.region

  settings {
    tier = "db-f1-micro"

    backup_configuration {
      enabled = false
    }

    ip_configuration {
      ipv4_enabled = true
    }
  }

  deletion_protection = true

  depends_on = [google_project_service.enabled_apis]
}

# データベース
resource "google_sql_database" "app_db" {
  name     = "gitpushpray"
  instance = google_sql_database_instance.main.name
}

# DBユーザー
resource "google_sql_user" "app_user" {
  name     = "appuser"
  instance = google_sql_database_instance.main.name
  password = var.db_password
}

# Secret ManagerにDBパスワードを保存
resource "google_secret_manager_secret" "db_password" {
  secret_id = "db-password"

  replication {
    auto {}
  }

  depends_on = [google_project_service.enabled_apis]
}

resource "google_secret_manager_secret_version" "db_password" {
  secret      = google_secret_manager_secret.db_password.id
  secret_data = var.db_password
}
