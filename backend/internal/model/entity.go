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
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Message struct {
	ID             int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	ConversationID uuid.UUID `gorm:"type:uuid;index;not null" json:"conversation_id"`
	Role           string    `gorm:"size:50;not null" json:"role"`
	Content        string    `gorm:"type:text;not null" json:"content"`
	TokenCount     int       `gorm:"default:0" json:"token_count"`
	CreatedAt      time.Time `json:"created_at"`
}
