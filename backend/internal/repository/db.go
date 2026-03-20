package repository

import (
	"fmt"
	"log"
	"os"

	"github.com/GDGoC-Japan-Hackathon/git-push-pray/backend/internal/model"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

// InitDB initializes the database connection
func InitDB() error {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		return fmt.Errorf("DATABASE_URL is not set in the environment")
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		return err
	}

	DB = db
	log.Println("Database connection established successfully")

	if err := db.AutoMigrate(&model.User{}, &model.Conversation{}, &model.Message{}, &model.ConversationTreeNode{}, &model.Review{}); err != nil {
		return fmt.Errorf("auto migration failed: %w", err)
	}
	log.Println("Database migration completed successfully")

	return nil
}
