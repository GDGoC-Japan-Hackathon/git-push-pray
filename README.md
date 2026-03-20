# git-push-pray

ハッカソンチーム: Git Push & Pray

## サービス概要

**???** は、AIとの対話を通じて知識を深めるための学習支援チャットアプリです。
ユーザーがトピックを投げかけると、Gemini が回答しながら関連する問いを生成し、会話ツリーとして可視化します。理解の深まりをビジュアルで確認しながら、能動的に学習を進めることができます。
TBW more...

## アーキテクチャ

![Architecture](https://github.com/user-attachments/assets/397251e6-7fa4-4af8-a7b4-8953ae1447d7)

### Google Cloud サービス構成

| サービス                      | 用途                                                                        |
| ----------------------------- | --------------------------------------------------------------------------- |
| **Cloud Run**                 | フロントエンド (React) とバックエンド (Go) をサーバーレスコンテナとして実行 |
| **Cloud SQL (PostgreSQL 18)** | ユーザー・会話・メッセージ・会話ツリーの永続化                              |
| **Vertex AI (Gemini)**        | チャット応答の生成および会話ツリーノードの生成                              |
| **Artifact Registry**         | CI/CD でビルドした Docker イメージの管理                                    |
| **Identity Platform**         | Firebase Authentication と連携したユーザー認証・JWT 検証                    |
| **Secret Manager**            | DB パスワード等の機密情報の管理                                             |

### CI/CD

`main` ブランチへのマージをトリガーに、GitHub Actions が Docker イメージをビルドして Artifact Registry へ push し、Cloud Run へ自動デプロイします。インフラは Terraform で管理され、`terraform/` 以下の変更も GitHub Actions から自動適用されます。

### DB Schema

```mermaid
erDiagram
    users {
        uuid id PK
        string firebase_uid UK
        string name
        string email
        timestamp created_at
        timestamp updated_at
    }
    conversations {
        uuid id PK
        uuid user_id FK
        string title
        string phase
        timestamp created_at
        timestamp updated_at
    }
    messages {
        int64 id PK
        uuid conversation_id FK
        string role
        text content
        text artifact_title
        text artifact_code
        int token_count
        timestamp created_at
    }
    conversation_tree_nodes {
        uuid id PK
        uuid conversation_id FK
        int64 message_id FK
        uuid parent_node_id FK
        text text
        string node_type
        text answer
        int64 answer_message_id FK
        timestamp created_at
        timestamp updated_at
    }

    users ||--o{ conversations : "has"
    conversations ||--o{ messages : "has"
    conversations ||--o{ conversation_tree_nodes : "has"
    messages ||--o{ conversation_tree_nodes : "source (message_id)"
    conversation_tree_nodes }o--o| conversation_tree_nodes : "parent_node_id"
    messages ||--o{ conversation_tree_nodes : "answer (answer_message_id)"
```

---

## ローカル開発環境の立ち上げ方

このプロジェクトは、フロントエンド (React + Vite) とバックエンド (Go + Vertex AI) で構成されています。

### 1. 必要なツールのインストール

- [Node.js](https://nodejs.org/) (v24以上推奨)
- [Go](https://go.dev/) (1.24以上推奨)
- [Google Cloud CLI (gcloud)](https://cloud.google.com/sdk/docs/install)

### 2. Google Cloud 認証 (初回のみ)

ローカルから Vertex AI (Gemini) を呼び出すために、Application Default Credentials (ADC) を設定します。

```bash
gcloud auth application-default login
```

※ブラウザが開いて Google アカウントへのログインを求められます。

### 3. Cloud SQL Auth Proxy の起動 (ローカルDB接続用)

ローカル環境からGCP上のCloud SQLへ接続するために、[Cloud SQL Auth Proxy](https://cloud.google.com/sql/docs/postgres/sql-proxy) を利用します。

初回のみ以下を実施。

**インストール (Mac の場合):**

```bash
cd backend/
# Intel Mac
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.14.3/cloud-sql-proxy.darwin.amd64
# Apple Silicon (M1/M2/M3) Mac
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.14.3/cloud-sql-proxy.darwin.arm64
chmod +x cloud-sql-proxy
```

**インストール (Linux の場合):**

```bash
cd backend/
# AMD64 (x86_64)
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.14.3/cloud-sql-proxy.linux.amd64
# ARM64
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.14.3/cloud-sql-proxy.linux.arm64
chmod +x cloud-sql-proxy
```

**インストール (Windows の場合):**
[公式のダウンロードリンク (x64用)](https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.14.3/cloud-sql-proxy.x64.exe) から `cloud-sql-proxy.exe` をダウンロードし、`backend/` フォルダに配置してください。

### 4. バックエンド (Go) の `.env` ファイル作成

`.env` ファイルを作成してください（存在しない場合）:

```
GOOGLE_CLOUD_PROJECT=git-push-pray
GOOGLE_CLOUD_LOCATION=asia-northeast1
GOOGLE_GENAI_USE_VERTEXAI=TRUE
DATABASE_URL=postgres://appuser:【ここを置き換える】@localhost:5432/git-push-pray?sslmode=disable
```

> [!NOTE]
> `godotenv` により、`backend/.env` が自動的に読み込まれます。

### 5. 一括起動 (推奨)

以下のコマンドひとつで、Cloud SQL Proxy・バックエンド・フロントエンドをまとめて起動できます。

```bash
# 全サービスを一括起動
make all
```

> [!NOTE]
> `make all` は内部で `nc` コマンドを使ってDB Proxyの起動を待機します。`nc` がインストールされていない場合は自動的に固定時間の待機にフォールバックします。

### 5a. 個別に起動する場合

各サービスを別々のターミナルで起動することもできます。

```bash
# ターミナル1: Cloud SQL Auth Proxy
make database

# ターミナル2: バックエンド (localhost:5432 が利用可能になってから)
make back

# ターミナル3: フロントエンド
make front
```

- `make database` で `localhost:5432` 経由でGCPのデータベースにつながります。
- `make back` で起動に成功すると `Backend server listening on port 8081` と表示されます。
- `make front` で `http://localhost:5173` にアクセスできます。

フロントエンドからのAPIリクエスト (`/api/*`) は、Vite のプロキシ設定によって自動的にバックエンド (`http://localhost:8081`) へ転送されます。

### 6. ローカルでの動作確認

1. Cloud SQL Auth Proxy, バックエンド, フロントエンドの3つが起動していることを確認します。
2. ブラウザで `http://localhost:5173` を開きます。
3. チャットの入力欄からメッセージ（例: `「ReactのHooksについて教えて」`）を送信します。
4. 数秒待って、Vertex AI (Gemini) からの回答が返ってくれば成功です！
   ※ 初回のみ、APIのコールドスタートで少し時間がかかる場合があります。

---

## ローカルでVertex AIだけを単体テストする方法

1. **バックエンド起動**
   `backend` ディレクトリで、`.env` を読み込ませてサーバーを立ち上げます。

   ```bash
   make back
   ```

2. **curlでAPIを叩く**
   別のターミナルタブを開き、以下の `curl` コマンドでメッセージを送信します。

   ```bash
   curl -X POST http://localhost:8081/api/chat \
     -H "Content-Type: application/json" \
     -d '{"user_id":"test-user","message":"GCPのVertex AIについて3行で教えて"}'
   ```

3. **レスポンスの確認**
   成功すると、以下のようなJSON形式でGeminiからの回答が返ってきます。
   ```json
   { "reply": "Vertex AIは...\n1. ...\n2. ...\n3. ...\n" }
   ```

## Terraformの使い方とローカルでの確認方法

このリポジトリでは、Google Cloud上のインフラ（Cloud RunやIAM設定など）をコードで管理するために [Terraform](https://www.terraform.io/) を使用しています。

### Terraformのローカル実行手順

手元のマシンからTerraformを実行して設定を確認・反映させたい場合は、以下の手順に沿って行います。

#### 1. Google Cloud の認証とプロジェクト設定

Terraformを実行する権限を持つアカウントでログインし、対象のプロジェクトをセットします。

```bash
# アカウントの認証 (ADCの作成)
# terraformを実行する際にもこの認証情報が使われます
gcloud auth application-default login

# デフォルトプロジェクトの設定
gcloud config set project git-push-pray
```

#### 2. 初期化と変数ファイルの準備

```bash
cd terraform/

# 【初回のみ】Terraformのリモートステート保存用GCSバケットを作成する
# すでに存在する場合はスキップしてください
gcloud storage buckets create gs://terraform-state-git-push-pray \
  --location=asia-northeast1 \
  --project=git-push-pray

# 初回のみ（または新しいプロバイダを追加した際）実行
terraform init

# 変数ファイルを作成（.gitignoreで除外されているため、手動で作成します）
cat <<EOF > terraform.tfvars
project_id = "git-push-pray"
region = "asia-northeast1"
EOF
```

#### 3. 変更の計画（プランの確認）

実際にクラウド環境に変更を加える前に、どのようなリソースが変更・追加・削除されるかを確認します。

```bash
terraform plan -var="project_id=git-push-pray" -var="region=asia-northeast1" -var="db_password=**********"
```

> ※ 出力結果を確認し、意図しないリソースの削除などが行われないかチェックしてください。

#### 4. クラウド環境への適用

> **通常は `main` ブランチへのマージ時に GitHub Actions が自動で `terraform apply` を実行します。** ローカルからの手動実行は緊急対応や動作確認のみを想定しています。

手動で適用したい場合は、`terraform plan` の結果に問題がなければ以下を実行します。

```bash
terraform apply
```

> ※ `Do you want to perform these actions?` と聞かれたら `yes` と入力します。

---

**注意点**

- Terraformの管理外で手動変更したリソース（特にIAMポリシー全体の上書きなど）は、次回の `terraform apply` でTerraformの状態に書き換わって消えてしまう可能性があります。
- `terraform` フォルダ以下の `.tf` ファイルを変更することで、インフラ構成を追加・修正できます。
- `.terraform.lock.hcl` はプロバイダーのバージョンを固定するためのファイルです。

### CI/CD による自動化（GitHub Actions）

`.github/workflows/terraform.yml` により、以下が自動化されています。

| イベント                            | 実行内容                                              |
| ----------------------------------- | ----------------------------------------------------- |
| `terraform/` 以下を変更したPRの作成 | `terraform plan` のみ（変更内容の確認・ドライラン）   |
| `main` ブランチへのマージ           | `terraform plan` → `terraform apply`（GCPへ自動反映） |

---

## 本番環境 (Cloud Run) へのデプロイ方法

このプロジェクトはフロントエンドとバックエンドをそれぞれ Cloud Run にデプロイします。

### 0. 準備: コードを GitHub に push してテストする

「本番は `main` だけにしたい」とのことでしたが、**マージする前に正しく動くか確認する**ために、一時的に現在のブランチでも環境が動くように設定しました。

まず、以下のコマンドで現在のブランチを push してください：

```bash
git add .
git commit -m "Add Cloud Run deployment workflows for testing"
git push origin add-vertex-ai-with-go
```

**※ これを実行すると、GitHub の Actions タブに項目が表示され、現在のブランチでデプロイの成否を確認できます。**
無事にデプロイ・動作確認ができたら、安心して `main` にマージできます。マージ後は `main` だけで動くように自動的に戻ります。

### 1. 必要な GitHub Secrets の登録

GitHub リポジトリの `Settings` -> `Secrets and variables` -> `Actions` から以下の Secret を登録してください。

| Secret 名               | 値                                                    |
| ----------------------- | ----------------------------------------------------- |
| `GCP_PROJECT_ID`        | GCP プロジェクト ID                                   |
| `GCP_SA_KEY`            | サービスアカウントの JSON キー                        |
| `BACKEND_CLOUD_RUN_URL` | バックエンドの Cloud Run URL（**手順 2 の後に登録**） |

### 2. 初回デプロイ手順

#### ① バックエンドを先にデプロイする

1. GitHub の `Actions` タブを開く
2. 左側のリストから `Build and Deploy Backend to Cloud Run` を選択（手順0のpush後に現れます）
3. 右側の `Run workflow` -> `Run workflow` をクリック
4. デプロイ完了後、ログを確認しバックエンドの URL を取得する
   - 例: `https://git-push-pray-backend-xxxxxxxxxx-an.a.run.app`

#### ② GitHub Secret `BACKEND_CLOUD_RUN_URL` を更新する

取得したURLを Secret に登録してください。末尾のスラッシュは不要です。

#### ③ フロントエンドを再デプロイする

1. GitHub の `Actions` タブから `Build and Deploy to Cloud Run` を選択
2. `Run workflow` -> `Run workflow` をクリック
3. 完了後、フロントエンドの URL にアクセスして動作を確認する

### ローカル開発との違い

| 環境                 | バックエンドURL                                         |
| -------------------- | ------------------------------------------------------- |
| **ローカル開発**     | Vite proxy 経由 -> `http://localhost:8081`              |
| **本番 (Cloud Run)** | `VITE_API_BASE_URL`（バックエンドの URL）に直接アクセス |
