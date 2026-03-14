# git-push-pray

ハッカソンチーム: Git Push & Pray

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

### 3. バックエンド (Go) の起動

```bash
# バックエンドのディレクトリへ移動
cd backend/

# 依存パッケージのインストール
go mod download

# .env ファイルの作成 (存在しない場合)
# .env の内容は以下のように設定してください。
# GOOGLE_CLOUD_PROJECT=git-push-pray
# GOOGLE_CLOUD_LOCATION=asia-northeast1
# GOOGLE_GENAI_USE_VERTEXAI=TRUE

# アプリケーションの起動 (.env を読み込んで実行)
export $(cat .env | xargs) && go run main.go
```

起動に成功すると `Backend server listening on port 8081` と表示されます。

### 4. フロントエンド (React) の起動

新しいターミナルタブを開き、フロントエンドを起動します。

```bash
# フロントエンドのディレクトリへ移動
cd frontend/

# 依存パッケージのインストール
npm install

# 開発サーバーの起動
npm run dev
```

ブラウザで `http://localhost:5173` にアクセスすると、アプリケーションを利用できます。
フロントエンドからのAPIリクエスト (`/api/*`) は、Vite のプロキシ設定によって自動的にバックエンド (`http://localhost:8081`) へ転送されます。

### 5. ローカルでの動作確認

1. フロントエンドとバックエンドの両方が起動していることを確認します。
2. ブラウザで `http://localhost:5173` を開きます。
3. チャットの入力欄からメッセージ（例: `「ReactのHooksについて教えて」`）を送信します。
4. 数秒待って、Vertex AI (Gemini) からの回答が返ってくれば成功です！
   ※ 初回のみ、APIのコールドスタートで少し時間がかかる場合があります。

## ローカルでVertex AIだけを単体テストする方法

フロントエンドを使わず、ターミナルから直接Goのバックエンド（Vertex AI連携部分）が動いているか確認したい場合は、以下の手順を実行します。

1. **バックエンド起動**
   `backend` ディレクトリで、`.env` を読み込ませてサーバーを立ち上げます。

   ```bash
   cd backend
   export $(cat .env | xargs) && go run main.go
   ```

2. **curlでAPIを叩く**
   別のターミナルタブを開き、以下の `curl` コマンドでメッセージを送信します。

   ```bash
   curl -X POST http://localhost:8081/api/chat \
     -H "Content-Type: application/json" \
     -d '{"message":"GCPのVertex AIについて3行で教えて"}'
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
terraform plan
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
