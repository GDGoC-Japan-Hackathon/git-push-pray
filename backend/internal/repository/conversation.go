package repository

import (
	"time"

	"github.com/GDGoC-Japan-Hackathon/git-push-pray/backend/internal/model"
	"github.com/google/uuid"
)

func CreateConversation(userID uuid.UUID, title string) (*model.Conversation, error) {
	conv := model.Conversation{UserID: userID, Title: title}
	if err := DB.Create(&conv).Error; err != nil {
		return nil, err
	}
	return &conv, nil
}

func GetConversationByIDAndUserID(id, userID uuid.UUID) (*model.Conversation, error) {
	var conv model.Conversation
	if err := DB.Where("id = ? AND user_id = ?", id, userID).First(&conv).Error; err != nil {
		return nil, err
	}
	return &conv, nil
}

func TouchConversation(id uuid.UUID) error {
	return DB.Model(&model.Conversation{}).Where("id = ?", id).Update("updated_at", time.Now()).Error
}

func ListConversationsByUserID(userID uuid.UUID) ([]model.Conversation, error) {
	var convs []model.Conversation
	if err := DB.Where("user_id = ?", userID).Order("updated_at DESC").Find(&convs).Error; err != nil {
		return nil, err
	}
	return convs, nil
}
