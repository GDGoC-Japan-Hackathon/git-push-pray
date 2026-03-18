package repository

import (
	"github.com/GDGoC-Japan-Hackathon/git-push-pray/backend/internal/model"
	"github.com/google/uuid"
)

func CreateTreeNode(node *model.ConversationTreeNode) error {
	return DB.Create(node).Error
}

func GetTreeNodesByConversationID(convID uuid.UUID) ([]model.ConversationTreeNode, error) {
	var nodes []model.ConversationTreeNode
	err := DB.Where("conversation_id = ?", convID).Order("created_at asc").Find(&nodes).Error
	return nodes, err
}

func UpdateTreeNodeAnswer(nodeID uuid.UUID, answer string, answerMessageID int64) error {
	return DB.Model(&model.ConversationTreeNode{}).Where("id = ?", nodeID).Updates(map[string]interface{}{
		"answer":            answer,
		"answer_message_id": answerMessageID,
	}).Error
}

func GetTreeNodeByID(nodeID uuid.UUID) (*model.ConversationTreeNode, error) {
	var node model.ConversationTreeNode
	err := DB.Where("id = ?", nodeID).First(&node).Error
	if err != nil {
		return nil, err
	}
	return &node, nil
}
