package repository

import (
	"github.com/GDGoC-Japan-Hackathon/git-push-pray/backend/internal/model"
	"github.com/google/uuid"
)

func CreateMessage(conversationID uuid.UUID, role, content string, tokenCount int) (*model.Message, error) {
	msg := model.Message{
		ConversationID: conversationID,
		Role:           role,
		Content:        content,
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
