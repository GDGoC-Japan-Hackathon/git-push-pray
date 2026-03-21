# Terraform によるインフラ管理

このリポジトリでは、Google Cloud 上のインフラ（Cloud Run・IAM・Cloud SQL 等）を [Terraform](https://www.terraform.io/) でコード管理しています。

## ローカルでの実行手順

### 1. 認証とプロジェクト設定

```bash
gcloud auth application-default login
gcloud config set project git-push-pray
```

### 2. 初期化と変数ファイルの準備

```bash
cd terraform/

# 【初回のみ】リモートステート保存用GCSバケットを作成
gcloud storage buckets create gs://terraform-state-git-push-pray \
  --location=asia-northeast1 \
  --project=git-push-pray

# 初期化（初回 or 新しいプロバイダを追加した際）
terraform init

# 変数ファイルを作成（.gitignore で除外されているため手動で作成）
cat <<EOF > terraform.tfvars
project_id = "git-push-pray"
region = "asia-northeast1"
EOF
```

### 3. 変更のプレビュー

実際に変更を加える前に、何が変わるか確認します。

```bash
terraform plan -var="project_id=git-push-pray" -var="region=asia-northeast1" -var="db_password=**********"
```

意図しないリソースの削除が含まれていないか確認してください。

### 4. 適用

> **通常は `main` ブランチへのマージ時に GitHub Actions が自動で `terraform apply` を実行します。** ローカルからの手動実行は緊急対応や動作確認のみを想定しています。

```bash
terraform apply
```

`Do you want to perform these actions?` → `yes` と入力して適用します。

## 注意事項

- Terraform の管理外で手動変更したリソース（特にIAMポリシー全体の上書き等）は、次回の `apply` でTerraformの状態に書き換わって消える可能性があります
- `.terraform.lock.hcl` はプロバイダーのバージョンを固定するファイルです。コミットに含めてください

## CI/CD による自動化（GitHub Actions）

`.github/workflows/terraform.yml` により、以下が自動化されています。

| イベント | 実行内容 |
| --- | --- |
| `terraform/` 以下を変更したPRの作成 | `terraform plan` のみ（ドライラン） |
| `main` ブランチへのマージ | `terraform plan` → `terraform apply`（GCPへ自動反映） |
