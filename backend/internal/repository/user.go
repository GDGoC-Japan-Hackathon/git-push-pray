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
	if user.Name != name || user.Email != email {
		DB.Model(&user).Updates(map[string]interface{}{"name": name, "email": email})
	}
	return &user, nil
}
