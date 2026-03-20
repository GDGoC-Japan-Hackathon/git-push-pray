package repository

import (
	"time"

	"github.com/GDGoC-Japan-Hackathon/git-push-pray/backend/internal/model"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func CreateConversation(userID uuid.UUID, title string) (*model.Conversation, error) {
	conv := model.Conversation{UserID: userID, Title: title, Phase: "init"}
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

func UpdateConversationPhaseAndTitle(id uuid.UUID, phase, title string) error {
	return DB.Model(&model.Conversation{}).Where("id = ?", id).Updates(map[string]interface{}{
		"phase":      phase,
		"title":      title,
		"updated_at": time.Now(),
	}).Error
}

func ListConversationsByUserID(userID uuid.UUID) ([]model.Conversation, error) {
	var convs []model.Conversation
	if err := DB.Where("user_id = ?", userID).Order("updated_at DESC").Find(&convs).Error; err != nil {
		return nil, err
	}
	return convs, nil
}

func DeleteConversation(id uuid.UUID) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("conversation_id = ?", id).Delete(&model.ConversationTreeNode{}).Error; err != nil {
			return err
		}
		if err := tx.Where("conversation_id = ?", id).Delete(&model.Message{}).Error; err != nil {
			return err
		}
		return tx.Delete(&model.Conversation{}, id).Error
	})
}
