# 本番環境へのデプロイ（Cloud Run）

フロントエンドとバックエンドをそれぞれ Cloud Run にデプロイします。`main` ブランチへのマージで GitHub Actions が自動デプロイします。

## GitHub Secrets の登録

リポジトリの `Settings` → `Secrets and variables` → `Actions` から以下を登録してください。

| Secret 名 | 値 |
| --- | --- |
| `GCP_PROJECT_ID` | GCP プロジェクト ID |
| `GCP_SA_KEY` | サービスアカウントの JSON キー |
| `BACKEND_CLOUD_RUN_URL` | バックエンドの Cloud Run URL（初回デプロイ後に登録） |

## 初回デプロイ手順

### ① バックエンドを先にデプロイ

1. GitHub の `Actions` タブを開く
2. `Build and Deploy Backend to Cloud Run` を選択
3. `Run workflow` をクリック
4. 完了後、ログからバックエンドのURLを取得する
   - 例: `https://git-push-pray-backend-xxxxxxxxxx-an.a.run.app`

### ② `BACKEND_CLOUD_RUN_URL` を登録

取得したURLをSecretに登録します（末尾のスラッシュは不要）。

### ③ フロントエンドをデプロイ

1. `Build and Deploy to Cloud Run` を選択
2. `Run workflow` をクリック
3. 完了後、フロントエンドのURLにアクセスして動作確認

## ローカル開発との違い

| 環境 | バックエンドURL |
| --- | --- |
| **ローカル開発** | Vite proxy 経由 → `http://localhost:8081` |
| **本番 (Cloud Run)** | `VITE_API_BASE_URL`（バックエンドのCloud Run URL）に直接アクセス |
