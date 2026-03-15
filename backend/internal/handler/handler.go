package handler

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/GDGoC-Japan-Hackathon/git-push-pray/backend/internal/model"
	"github.com/GDGoC-Japan-Hackathon/git-push-pray/backend/internal/service"
)

type Handler struct {
	svc *service.ChatService
}

func New(svc *service.ChatService) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) Chat(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req model.ChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if req.UserID == "" || req.Message == "" {
		http.Error(w, "user_id and message are required", http.StatusBadRequest)
		return
	}

	log.Printf("user=%s conversation=%s message=%s", req.UserID, req.ConversationID, req.Message)

	resp, err := h.svc.Chat(r.Context(), req.UserID, req.ConversationID, req.Message)
	if err != nil {
		log.Printf("Gemini error: %v", err)
		http.Error(w, "Failed to generate response", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (h *Handler) History(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID := r.URL.Query().Get("user_id")
	conversationID := r.URL.Query().Get("conversation_id")
	if userID == "" || conversationID == "" {
		http.Error(w, "user_id and conversation_id are required", http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(h.svc.History(userID, conversationID))
}

func (h *Handler) Sessions(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID := r.URL.Query().Get("user_id")
	if userID == "" {
		http.Error(w, "user_id is required", http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(h.svc.Sessions(userID))
}
