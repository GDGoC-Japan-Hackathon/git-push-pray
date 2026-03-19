package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"time"

	firebase "firebase.google.com/go/v4"
	"github.com/GDGoC-Japan-Hackathon/git-push-pray/backend/internal/handler"
	"github.com/GDGoC-Japan-Hackathon/git-push-pray/backend/internal/middleware"
	"github.com/GDGoC-Japan-Hackathon/git-push-pray/backend/internal/repository"
	"github.com/GDGoC-Japan-Hackathon/git-push-pray/backend/internal/service"
	"github.com/joho/godotenv"
	"google.golang.org/api/option"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, relying on system environment variables")
	}

	log.Println("Initializing Firebase app...")
	fbOpts := []option.ClientOption{}
	if credFile := os.Getenv("GOOGLE_APPLICATION_CREDENTIALS"); credFile != "" {
		fbOpts = append(fbOpts, option.WithCredentialsFile(credFile))
	}
	fbApp, err := firebase.NewApp(context.Background(), nil, fbOpts...)
	if err != nil {
		log.Fatalf("Fatal error initializing Firebase: %v", err)
	}
	log.Println("Firebase app initialized.")
	auth := middleware.Auth(fbApp)

	log.Println("Initializing GenAI client for Vertex AI...")
	svc, err := service.New()
	if err != nil {
		log.Fatalf("Fatal error initializing service: %v", err)
	}
	log.Println("Client initialized successfully.")

	log.Println("Initializing database connection...")
	if err := repository.InitDB(); err != nil {
		log.Fatalf("Fatal error initializing database: %v", err)
	}

	h := handler.New(svc)

	mux := http.NewServeMux()
	mux.Handle("/api/chat", middleware.CORS(auth(http.HandlerFunc(h.Chat))))
	mux.Handle("/api/history", middleware.CORS(auth(http.HandlerFunc(h.History))))
	mux.Handle("/api/sessions", middleware.CORS(auth(http.HandlerFunc(h.Sessions))))
	mux.Handle("/api/conversation-tree", middleware.CORS(auth(http.HandlerFunc(h.ConversationTree))))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}

	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           mux,
		ReadTimeout:       10 * time.Second,
		ReadHeaderTimeout: 5 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	log.Printf("Backend server listening on port %s", port)
	if err := srv.ListenAndServe(); err != nil {
		log.Fatal(err)
	}
}
