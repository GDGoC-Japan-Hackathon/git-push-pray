package repository

import (
	"github.com/GDGoC-Japan-Hackathon/git-push-pray/backend/internal/model"
	"gorm.io/gorm"
)

func FindOrCreateUser(firebaseUID, name, email string) (*model.User, error) {
	var user model.User
	err := DB.Where("firebase_uid = ?", firebaseUID).First(&user).Error
	if err == gorm.ErrRecordNotFound {
		user = model.User{
			FirebaseUID: firebaseUID,
			Name:        name,
			Email:       email,
		}
		if err := DB.Create(&user).Error; err != nil {
			return nil, err
		}
		return &user, nil
	}
	if err != nil {
		return nil, err
	}
	updateData := make(map[string]interface{})
	if name != "" && user.Name != name {
		updateData["name"] = name
	}
	if email != "" && user.Email != email {
		updateData["email"] = email
	}
	if len(updateData) > 0 {
		if err := DB.Model(&user).Updates(updateData).Error; err != nil {
			return nil, err
		}
	}
	return &user, nil
}
