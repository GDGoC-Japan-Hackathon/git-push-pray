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
   {"reply":"Vertex AIは...\n1. ...\n2. ...\n3. ...\n"}
   ```
