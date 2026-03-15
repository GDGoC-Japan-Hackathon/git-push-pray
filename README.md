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

# アプリケーションの起動
go run main.go
```
> [!NOTE]
> `backend/main.go` 内で `godotenv` を使用しているため、自動的に `.env` が読み込まれます。

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

| Secret 名 | 値 |
|---|---|
| `GCP_PROJECT_ID` | GCP プロジェクト ID |
| `GCP_SA_KEY` | サービスアカウントの JSON キー |
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

| 環境 | バックエンドURL |
|---|---|
| **ローカル開発** | Vite proxy 経由 -> `http://localhost:8081` |
| **本番 (Cloud Run)** | `VITE_API_BASE_URL`（バックエンドの URL）に直接アクセス |
