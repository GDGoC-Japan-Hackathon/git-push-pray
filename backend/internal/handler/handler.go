package handler

import (
	"encoding/json"
	"fmt"
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

func authInfoFromContext(r *http.Request) (*middleware.AuthInfo, bool) {
	info, ok := r.Context().Value(middleware.AuthInfoKey).(*middleware.AuthInfo)
	return info, ok && info != nil
}

func (h *Handler) ensureUser(r *http.Request) (*model.User, error) {
	info, ok := authInfoFromContext(r)
	if !ok {
		return nil, nil
	}
	return service.EnsureUser(info.UID, info.Name, info.Email)
}

func (h *Handler) Chat(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	user, err := h.ensureUser(r)
	if err != nil {
		log.Printf("Failed to ensure user: %v", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	if user == nil {
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

	log.Printf("user=%s firebase_uid=%s conversation=%s message_len=%d parent_node=%s", user.ID.String(), user.FirebaseUID, req.ConversationID, len(req.Message), req.ParentNodeID)

	eventCh, err := h.svc.ChatStream(r.Context(), user, req.ConversationID, req.Message, req.ParentNodeID, req.AnsweringQuestion, req.GenerateUI, req.IsSupplement, req.ContextParentNodeID)
	if err != nil {
		if err.Error() == "this node has already been answered" {
			http.Error(w, err.Error(), http.StatusConflict)
			return
		}
		log.Printf("ChatStream setup error: %v", err)
		http.Error(w, "Failed to generate response", http.StatusInternalServerError)
		return
	}

	// SSEヘッダー設定
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming not supported", http.StatusInternalServerError)
		return
	}

	eventCount := 0
	for event := range eventCh {
		eventCount++
		fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event.Type, event.Data)
		flusher.Flush()
	}
	log.Printf("SSE stream completed: %d events sent", eventCount)
}

func (h *Handler) ConversationTree(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	user, err := h.ensureUser(r)
	if err != nil {
		log.Printf("Failed to ensure user: %v", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	if user == nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	conversationID := r.URL.Query().Get("conversation_id")
	if conversationID == "" {
		http.Error(w, "conversation_id is required", http.StatusBadRequest)
		return
	}

	resp, err := h.svc.GetConversationTree(conversationID, user.ID)
	if err != nil {
		http.Error(w, "not found", http.StatusNotFound)
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

	user, err := h.ensureUser(r)
	if err != nil {
		log.Printf("Failed to ensure user: %v", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	if user == nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	conversationID := r.URL.Query().Get("conversation_id")
	if conversationID == "" {
		http.Error(w, "conversation_id is required", http.StatusBadRequest)
		return
	}

	resp, err := h.svc.History(user.ID, conversationID)
	if err != nil {
		log.Printf("History error: %v", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (h *Handler) Sessions(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	user, err := h.ensureUser(r)
	if err != nil {
		log.Printf("Failed to ensure user: %v", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	if user == nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	resp, err := h.svc.Sessions(user.ID)
	if err != nil {
		log.Printf("Sessions error: %v", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}
