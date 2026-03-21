# ローカル開発環境のセットアップ

このプロジェクトは、フロントエンド (React + Vite) とバックエンド (Go + Vertex AI) で構成されています。

## 1. 必要なツール

- [Node.js](https://nodejs.org/) (v24以上推奨)
- [Go](https://go.dev/) (1.24以上推奨)
- [Google Cloud CLI (gcloud)](https://cloud.google.com/sdk/docs/install)

## 2. Google Cloud 認証（初回のみ）

ローカルから Vertex AI (Gemini) を呼び出すために、Application Default Credentials (ADC) を設定します。

```bash
gcloud auth application-default login
```

ブラウザが開いて Google アカウントへのログインを求められます。

## 3. Cloud SQL Auth Proxy の起動（ローカルDB接続用）

ローカル環境からGCP上のCloud SQLへ接続するために、[Cloud SQL Auth Proxy](https://cloud.google.com/sql/docs/postgres/sql-proxy) を利用します。

**インストール（初回のみ）:**

```bash
cd backend/

# Mac: Apple Silicon (M1/M2/M3)
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.14.3/cloud-sql-proxy.darwin.arm64
chmod +x cloud-sql-proxy

# Mac: Intel
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.14.3/cloud-sql-proxy.darwin.amd64
chmod +x cloud-sql-proxy

# Linux: AMD64
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.14.3/cloud-sql-proxy.linux.amd64
chmod +x cloud-sql-proxy

# Linux: ARM64
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.14.3/cloud-sql-proxy.linux.arm64
chmod +x cloud-sql-proxy
```

Windows の場合は[公式ダウンロードリンク (x64)](https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.14.3/cloud-sql-proxy.x64.exe)から `cloud-sql-proxy.exe` を `backend/` フォルダに配置してください。

## 4. バックエンドの `.env` ファイル作成

`backend/.env` を作成してください：

```
GOOGLE_CLOUD_PROJECT=git-push-pray
GOOGLE_CLOUD_LOCATION=asia-northeast1
GOOGLE_GENAI_USE_VERTEXAI=TRUE
DATABASE_URL=postgres://appuser:【パスワード】@localhost:5432/git-push-pray?sslmode=disable
```

> `godotenv` により `backend/.env` は自動的に読み込まれます。

## 5. 起動

### 一括起動（推奨）

```bash
make all
```

Cloud SQL Proxy・バックエンド・フロントエンドをまとめて起動します。

> `make all` は内部で `nc` コマンドを使ってDB Proxyの起動を待機します。`nc` がない場合は固定時間の待機にフォールバックします。

### 個別起動

```bash
# ターミナル1: Cloud SQL Auth Proxy
make database

# ターミナル2: バックエンド（localhost:5432 が起動してから）
make back

# ターミナル3: フロントエンド
make front
```

- `make database` → `localhost:5432` 経由でGCPのDBに接続
- `make back` → 起動成功で `Backend server listening on port 8081` と表示
- `make front` → `http://localhost:5173` でアクセス可能

フロントエンドからのAPIリクエスト (`/api/*`) は Vite のプロキシ設定によって自動的にバックエンド (`http://localhost:8081`) へ転送されます。

## 6. 動作確認

1. Cloud SQL Auth Proxy・バックエンド・フロントエンドの3つが起動していることを確認
2. `http://localhost:5173` をブラウザで開く
3. チャット欄にメッセージ（例: `「ReactのHooksについて教えて」`）を送信
4. Vertex AI (Gemini) からの回答が返れば成功

初回はAPIのコールドスタートで少し時間がかかる場合があります。

## Vertex AI 単体テスト

バックエンドのみを起動してAPIを直接叩く場合：

```bash
# バックエンド起動
make back

# 別ターミナルでAPIを叩く
curl -X POST http://localhost:8081/api/chat \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test-user","message":"GCPのVertex AIについて3行で教えて"}'
```

成功すると以下のようなレスポンスが返ります：

```json
{ "reply": "Vertex AIは...\n1. ...\n2. ...\n3. ...\n" }
```
