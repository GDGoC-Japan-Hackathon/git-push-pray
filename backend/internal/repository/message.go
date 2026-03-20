package repository

import (
	"time"

	"github.com/GDGoC-Japan-Hackathon/git-push-pray/backend/internal/model"
	"github.com/google/uuid"
)

func CreateMessage(conversationID uuid.UUID, role, content string, tokenCount int, artifactTitle, artifactCode string) (*model.Message, error) {
	msg := model.Message{
		ConversationID: conversationID,
		Role:           role,
		Content:        content,
		ArtifactTitle:  artifactTitle,
		ArtifactCode:   artifactCode,
		TokenCount:     tokenCount,
	}
	if err := DB.Create(&msg).Error; err != nil {
		return nil, err
	}
	return &msg, nil
}

func GetMessagesByConversationID(conversationID uuid.UUID) ([]model.Message, error) {
	var msgs []model.Message
	if err := DB.Where("conversation_id = ?", conversationID).Order("id ASC").Find(&msgs).Error; err != nil {
		return nil, err
	}
	return msgs, nil
}

func GetLastMessage(conversationID uuid.UUID) (*model.Message, error) {
	var msg model.Message
	if err := DB.Where("conversation_id = ?", conversationID).Order("id DESC").First(&msg).Error; err != nil {
		return nil, err
	}
	return &msg, nil
}

func CountUserMessagesToday(userID uuid.UUID) (int64, error) {
	var count int64
	today := time.Now().Truncate(24 * time.Hour)
	err := DB.Model(&model.Message{}).
		Joins("JOIN conversations ON conversations.id = messages.conversation_id").
		Where("conversations.user_id = ? AND messages.created_at >= ? AND messages.role = ?", userID, today, "user").
		Count(&count).Error
	return count, err
}
