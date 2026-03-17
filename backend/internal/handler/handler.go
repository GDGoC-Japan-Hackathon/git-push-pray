package handler

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/GDGoC-Japan-Hackathon/git-push-pray/backend/internal/middleware"
	"github.com/GDGoC-Japan-Hackathon/git-push-pray/backend/internal/model"
	"github.com/GDGoC-Japan-Hackathon/git-push-pray/backend/internal/service"
)

type Handler struct {
	svc *service.ChatService
}

func New(svc *service.ChatService) *Handler {
	return &Handler{svc: svc}
}

func userIDFromContext(r *http.Request) (string, bool) {
	uid, ok := r.Context().Value(middleware.UserIDKey).(string)
	return uid, ok && uid != ""
}

func (h *Handler) Chat(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, ok := userIDFromContext(r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var req model.ChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if req.Message == "" {
		http.Error(w, "message is required", http.StatusBadRequest)
		return
	}

	log.Printf("user=%s conversation=%s message_len=%d", userID, req.ConversationID, len(req.Message))

	resp, err := h.svc.Chat(r.Context(), userID, req.ConversationID, req.Message)
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

	userID, ok := userIDFromContext(r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	conversationID := r.URL.Query().Get("conversation_id")
	if conversationID == "" {
		http.Error(w, "conversation_id is required", http.StatusBadRequest)
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

	userID, ok := userIDFromContext(r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(h.svc.Sessions(userID))
}
