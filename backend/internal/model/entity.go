package model

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID          uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	FirebaseUID string    `gorm:"uniqueIndex;size:128;not null" json:"firebase_uid"`
	Name        string    `gorm:"size:255" json:"name"`
	Email       string    `gorm:"size:255" json:"email"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Conversation struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID    uuid.UUID `gorm:"type:uuid;index;not null" json:"user_id"`
	Title     string    `gorm:"size:255" json:"title"`
	Phase     string    `gorm:"size:20;default:'init'" json:"phase"` // "init" | "teaching" | "review"
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Message struct {
	ID             int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	ConversationID uuid.UUID `gorm:"type:uuid;index;not null" json:"conversation_id"`
	Role           string    `gorm:"size:50;not null" json:"role"`
	Content        string    `gorm:"type:text;not null" json:"content"`
	ArtifactTitle  string    `gorm:"type:text" json:"artifact_title"`
	ArtifactCode   string    `gorm:"type:text" json:"artifact_code"`
	TokenCount     int       `gorm:"default:0" json:"token_count"`
	CreatedAt      time.Time `json:"created_at"`
}

type ConversationTreeNode struct {
	ID              uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	ConversationID  uuid.UUID  `gorm:"type:uuid;index;not null" json:"conversation_id"`
	MessageID       int64      `gorm:"index;not null" json:"message_id"` // このノードを生成したメッセージのID
	ParentNodeID    *uuid.UUID `gorm:"type:uuid;index" json:"parent_node_id"`
	Text            string     `gorm:"type:text;not null" json:"text"`   // 質問内容、またはルートの場合はテーマ内容
	NodeType        string     `gorm:"size:20;default:'question'" json:"node_type"` // "question" or "visualize"
	Answer          string     `gorm:"type:text" json:"answer"`          // このノード（質問）に対する回答要約
	AnswerMessageID *int64     `gorm:"index" json:"answer_message_id"`   // 回答が抽出されたユーザーメッセージのID
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

type Review struct {
	ID               uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	ConversationID   uuid.UUID `gorm:"type:uuid;uniqueIndex;not null" json:"conversation_id"`
	OverallScore     int       `gorm:"not null" json:"overall_score"`
	Summary          string    `gorm:"type:text;not null" json:"summary"`
	Strengths        string    `gorm:"type:text" json:"strengths"`
	Weaknesses       string    `gorm:"type:text" json:"weaknesses"`
	Advice           string    `gorm:"type:text" json:"advice"`
	TopicEvaluations string    `gorm:"type:text" json:"topic_evaluations"`
	CreatedAt        time.Time `json:"created_at"`
}
