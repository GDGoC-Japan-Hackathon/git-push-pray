package model

type ChatRequest struct {
	UserID         string `json:"user_id"`
	ConversationID string `json:"conversation_id"`
	Message        string `json:"message"`
}

type ChatResponse struct {
	ConversationID string `json:"conversation_id"`
	Reply          string `json:"reply"`
}

type HistoryMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type HistoryResponse struct {
	Messages []HistoryMessage `json:"messages"`
}

type SessionMeta struct {
	ConversationID string `json:"conversation_id"`
	Title          string `json:"title"`
	LastMessage    string `json:"last_message"`
	UpdatedAt      string `json:"updated_at"`
}

type SessionsResponse struct {
	Sessions []SessionMeta `json:"sessions"`
}
