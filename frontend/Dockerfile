# ベースイメージ
FROM node:24.14-alpine AS base

# 依存関係のインストール
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# ビルド
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Viteはビルド時に環境変数を埋め込む（必要に応じてARG/ENVを追加）
# ARG VITE_EXAMPLE_KEY
# ENV VITE_EXAMPLE_KEY=$VITE_EXAMPLE_KEY

RUN npm run build

# 本番イメージ（nginx-unprivilgedで非rootかつポート8080で配信）
# - 非rootユーザーでポート80(特権ポート)にbindする問題を解消
# - Cloud Runの推奨ポートである8080に統一
FROM nginxinc/nginx-unprivileged:alpine AS runner

# ビルド済み静的ファイルをコピー（nginx-unprivilegedは内部でnginxユーザーを管理）
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
