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

# 本番イメージ（Nginxで静的ホスティング）
FROM nginx:alpine AS runner

RUN addgroup --system --gid 1001 webgroup
RUN adduser --system --uid 1001 webuser

# ビルド済み静的ファイルをコピー
COPY --from=builder --chown=webuser:webgroup /app/dist /usr/share/nginx/html

USER webuser

EXPOSE 80

ENV HOSTNAME="0.0.0.0"

CMD ["nginx", "-g", "daemon off;"]
