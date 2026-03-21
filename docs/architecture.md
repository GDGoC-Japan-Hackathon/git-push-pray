# アーキテクチャ

## 全体構成図

![Architecture](https://github.com/user-attachments/assets/397251e6-7fa4-4af8-a7b4-8953ae1447d7)

## 技術スタック

| レイヤー | 技術 |
| --- | --- |
| **フロントエンド** | React + TypeScript + Vite |
| **バックエンド** | Go (net/http) |
| **AI** | Vertex AI (Gemini 2.5 Flash) via Google Gen AI SDK |
| **DB** | PostgreSQL 18 (Cloud SQL) |
| **認証** | Firebase Authentication + Identity Platform |
| **インフラ** | Google Cloud (Cloud Run, Cloud SQL, Artifact Registry, Secret Manager) |
| **IaC** | Terraform |
| **CI/CD** | GitHub Actions |

## Google Cloud サービス構成

| サービス | 用途 |
| --- | --- |
| **Cloud Run** | フロントエンド (React) とバックエンド (Go) をサーバーレスコンテナとして実行 |
| **Cloud SQL (PostgreSQL 18)** | ユーザー・会話・メッセージ・会話ツリーの永続化 |
| **Vertex AI (Gemini)** | チャット応答の生成および会話ツリーノードの生成 |
| **Artifact Registry** | CI/CD でビルドした Docker イメージの管理 |
| **Identity Platform** | Firebase Authentication と連携したユーザー認証・JWT 検証 |
| **Secret Manager** | DB パスワード等の機密情報の管理 |

## CI/CD フロー

`main` ブランチへのマージをトリガーに、GitHub Actions が Docker イメージをビルドして Artifact Registry へ push し、Cloud Run へ自動デプロイします。インフラは Terraform で管理され、`terraform/` 以下の変更も GitHub Actions から自動適用されます。

```
git push → GitHub Actions
  ├── Docker build & push (Artifact Registry)
  ├── Cloud Run deploy (frontend / backend)
  └── terraform apply (インフラ変更がある場合)
```

## ディレクトリ構成

```
.
├── frontend/          # React + Vite
│   └── src/
│       ├── components/    # UIコンポーネント
│       ├── contexts/      # React Context (認証など)
│       └── types.ts       # 共通型定義
├── backend/           # Go
│   ├── cmd/           # エントリポイント
│   └── internal/
│       ├── handler/   # HTTPハンドラ
│       ├── service/   # ビジネスロジック (Gemini呼び出しなど)
│       └── repository/ # DB操作
├── terraform/         # インフラ定義
└── .github/workflows/ # CI/CD パイプライン
```
