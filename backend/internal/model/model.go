package model

type ChatRequest struct {
	UserID            string `json:"user_id"`
	ConversationID    string `json:"conversation_id"`
	Message           string `json:"message"`
	ParentNodeID      string `json:"parent_node_id"`
	AnsweringQuestion string `json:"answering_question"`
}

type QuestionNode struct {
	ID      string `json:"id"`
	Summary string `json:"summary"`
}

type Artifact struct {
	Title string `json:"title"`
	Code  string `json:"code"`
}

type ChatResponse struct {
	ConversationID string         `json:"conversation_id"`
	Reply          string         `json:"reply"`
	AnswerSummary  string         `json:"answer_summary"`
	Questions      []QuestionNode `json:"questions"`
	Artifact       *Artifact      `json:"artifact,omitempty"`
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

type TreeNodeResponse struct {
	ID       string `json:"id"`
	ParentID string `json:"parent_id"`
	Text     string `json:"text"`
	Answer   string `json:"answer"`
}

type ConversationTreeResponse struct {
	Nodes []TreeNodeResponse `json:"nodes"`
}
