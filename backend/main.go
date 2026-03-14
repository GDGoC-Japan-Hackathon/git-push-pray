package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"

	"google.golang.org/genai"
	"github.com/joho/godotenv"
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
var genaiClient *genai.Client

func initClient() error {
	ctx := context.Background()
	client, err := genai.NewClient(ctx, nil)
	if err != nil {
		return err
	}
	genaiClient = client
	return nil
}

func enableCORS(w *http.ResponseWriter) {
	(*w).Header().Set("Access-Control-Allow-Origin", "*")
	(*w).Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE")
	(*w).Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization")
}

func chatHandler(w http.ResponseWriter, r *http.Request) {
	enableCORS(&w)
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
	systemInstruction := "あなたはプログラミングや開発に関する質問に答える、親切なAIアシスタントです。簡潔に、しかし詳細に回答してください。マークダウン形式で回答してください。"
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
		http.Error(w, "Failed to generate response: "+err.Error(), http.StatusInternalServerError)
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

	http.HandleFunc("/api/chat", chatHandler)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}

	log.Printf("Backend server listening on port %s", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatal(err)
	}
}
