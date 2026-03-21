# DB スキーマ

## ER図

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

## テーブル説明

### `users`
Firebase Authentication と紐づくユーザーテーブル。`firebase_uid` をキーとして認証情報とアプリユーザーを連携する。

### `conversations`
1つの学習セッション（会話）を表す。`phase` フィールドで会話の進行状態を管理し、AIが終了を示唆するタイミングを制御する。

### `messages`
会話内のやり取りを1行1メッセージで保存。`role` は `user` または `assistant`。Generative UIが生成された場合は `artifact_title` と `artifact_code` にReactコンポーネントのコードが格納される。

### `conversation_tree_nodes`
AIが生成した「問い」を木構造で管理するテーブル。各ノードはメッセージと紐づき、`parent_node_id` で親子関係を表現する。`node_type` で「質問」「回答」などの種別を区別する。

## マイグレーション

マイグレーションファイルは `backend/` 以下で管理されています。詳細は [ローカル開発ガイド](local-dev.md) を参照してください。
