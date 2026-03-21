package repository

import (
	"github.com/GDGoC-Japan-Hackathon/git-push-pray/backend/internal/model"
	"github.com/google/uuid"
)

func CreateReview(review *model.Review) error {
	return DB.Create(review).Error
}

func GetReviewByConversationID(conversationID uuid.UUID) (*model.Review, error) {
	var review model.Review
	if err := DB.Where("conversation_id = ?", conversationID).First(&review).Error; err != nil {
		return nil, err
	}
	return &review, nil
}

func UpdateConversationPhase(id uuid.UUID, phase string) error {
	return DB.Model(&model.Conversation{}).Where("id = ?", id).Update("phase", phase).Error
}
