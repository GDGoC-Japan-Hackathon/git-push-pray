package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"

	"strings"
	"time"

	firebase "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/auth"
	"github.com/joho/godotenv"
	"google.golang.org/api/option"
	"google.golang.org/genai"
)

// チャットリクエストのペイロード
type ChatRequest struct {
	Message string `json:"message"`
}

// チャットレスポンスのペイロード
type ChatResponse struct {
	Reply string `json:"reply"`
}

// ChatAgent のようにグローバル変数へ持たせるのではなく、ハンドラで都度呼び出す
// APIキーを使わず Vertex AI (ADC) で認証する
var (
	genaiClient *genai.Client
	authClient  *auth.Client
)

func initClient() error {
	ctx := context.Background()

	// Initialize Gemini Client
	client, err := genai.NewClient(ctx, nil)
	if err != nil {
		return err
	}
	genaiClient = client

	// Initialize Firebase Admin SDK
	// Use ADC (Application Default Credentials) in Cloud Run
	// Local development might need a service account key file
	var app *firebase.App
	projectID := os.Getenv("GOOGLE_CLOUD_PROJECT")

	if projectID == "" {
		log.Println("GOOGLE_CLOUD_PROJECT is not set. Trying to initialize without specific project ID.")
		app, err = firebase.NewApp(ctx, nil)
	} else {
		config := &firebase.Config{ProjectID: projectID}
		app, err = firebase.NewApp(ctx, config)
	}

	if err != nil {
		return err
	}

	ac, err := app.Auth(ctx)
	if err != nil {
		return err
	}
	authClient = ac

	return nil
}

// withAuth is a middleware to verify Firebase ID Token
func withAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		enableCORS(w, r)
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		authHeader := r.Header.Get("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			http.Error(w, "Unauthorized: Missing or invalid Authorization header", http.StatusUnauthorized)
			return
		}

		idToken := strings.TrimPrefix(authHeader, "Bearer ")
		token, err := authClient.VerifyIDToken(r.Context(), idToken)
		if err != nil {
			log.Printf("Token verification failed: %v", err)
			http.Error(w, "Unauthorized: Invalid token", http.StatusUnauthorized)
			return
		}

		// Store UID in request context if needed
		log.Printf("Request from verified user: %s", token.UID)

		next.ServeHTTP(w, r)
	}
}

func enableCORS(w http.ResponseWriter, r *http.Request) {
	origin := r.Header.Get("Origin")
	allowedOriginsEnv := os.Getenv("ALLOWED_ORIGINS")

	// 開発環境 (localhost) や特定のオリジンを許可
	// ALLOWED_ORIGINS=https://your-frontend.run.app,http://localhost:5173 などの形式を想定
	if origin != "" && allowedOriginsEnv != "" {
		for _, ao := range strings.Split(allowedOriginsEnv, ",") {
			if strings.TrimSpace(ao) == origin {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Add("Vary", "Origin")
				break
			}
		}
	} else if allowedOriginsEnv == "" {
		// 未設定の場合は開発の利便性のために全許可（本番では設定を推奨）
		w.Header().Set("Access-Control-Allow-Origin", "*")
	}

	w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE")
	w.Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization")
}

func chatHandler(w http.ResponseWriter, r *http.Request) {
	// CORS handling is now in withAuth middleware for this specific route
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req ChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	log.Printf("Received message: %s", req.Message)

	// プロンプトの構築
	systemInstruction := "あなたは、ユーザーが教えようとしているトピックについて「全く事前の知識を持たない、完全な初心者」です。ユーザーのことを「先生」などのように慕い、純粋な好奇心を持って教えを請う生徒として振る舞ってください。年齢設定は特にありませんが、丁寧で素直な言葉遣いを心がけてください（「～ですね！」「～なんですね！」など）。"
	fullPrompt := systemInstruction + "\n\nユーザーからの質問:\n" + req.Message

	// Gemini API (Vertex AI経由) の呼び出し
	// モデル名の prefix に注意（VertexAI では gemini-2.5-flash はサポートされている）
	model := "gemini-2.5-flash"
	resp, err := genaiClient.Models.GenerateContent(
		context.Background(),
		model,
		[]*genai.Content{{
			Role:  "user",
			Parts: []*genai.Part{genai.NewPartFromText(fullPrompt)},
		}},
		nil,
	)

	if err != nil {
		log.Printf("Gemini execution error: %v", err)
		http.Error(w, "Failed to generate response", http.StatusInternalServerError)
		return
	}

	replyText := resp.Text()

	res := ChatResponse{
		Reply: replyText,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(res)
}

func main() {
	// .envファイルから環境変数を読み込む
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, relying on system environment variables")
	}

	log.Println("Initializing GenAI client for Vertex AI...")
	if err := initClient(); err != nil {
		log.Fatalf("Fatal error initializing client: %v", err)
	}
	log.Println("Client initialized successfully.")

	http.HandleFunc("/api/chat", withAuth(chatHandler))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}

	srv := &http.Server{
		Addr:              ":" + port,
		ReadTimeout:       10 * time.Second,
		ReadHeaderTimeout: 5 * time.Second,
		WriteTimeout:      60 * time.Second, // Gemini response could take time
		IdleTimeout:       120 * time.Second,
	}

	log.Printf("Backend server listening on port %s", port)
	if err := srv.ListenAndServe(); err != nil {
		log.Fatal(err)
	}
}
