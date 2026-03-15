package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"github.com/GDGoC-Japan-Hackathon/git-push-pray/backend/internal/handler"
	"github.com/GDGoC-Japan-Hackathon/git-push-pray/backend/internal/middleware"
	"github.com/GDGoC-Japan-Hackathon/git-push-pray/backend/internal/service"
	"github.com/joho/godotenv"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, relying on system environment variables")
	}

	log.Println("Initializing GenAI client for Vertex AI...")
	svc, err := service.New()
	if err != nil {
		log.Fatalf("Fatal error initializing service: %v", err)
	}
	log.Println("Client initialized successfully.")

	h := handler.New(svc)

	mux := http.NewServeMux()
	mux.Handle("/api/chat", middleware.CORS(http.HandlerFunc(h.Chat)))
	mux.Handle("/api/history", middleware.CORS(http.HandlerFunc(h.History)))
	mux.Handle("/api/sessions", middleware.CORS(http.HandlerFunc(h.Sessions)))

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
