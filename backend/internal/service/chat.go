package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"strings"
	"sync"

	"github.com/GDGoC-Japan-Hackathon/git-push-pray/backend/internal/model"
	"google.golang.org/genai"
)

const systemInstruction = "あなたは、ユーザーが教えようとしているトピックについて「全く事前の知識を持たない、完全な初心者」です。ユーザーのことを「先生」などのように慕い、純粋な好奇心を持って教えを請う生徒として振る舞ってください。年齢設定は特にありませんが、丁寧で素直な言葉遣いを心がけてください（「～ですね！」「～なんですね！」など）。"

func newID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return hex.EncodeToString(b)
}

type store struct {
	mu      sync.RWMutex
	history map[string][]*genai.Content
}

func (s *store) key(userID, conversationID string) string {
	return userID + ":" + conversationID
}

func (s *store) get(userID, conversationID string) []*genai.Content {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.history[s.key(userID, conversationID)]
}

func (s *store) set(userID, conversationID string, contents []*genai.Content) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.history[s.key(userID, conversationID)] = contents
}

func (s *store) list(userID string) []model.SessionMeta {
	prefix := userID + ":"
	s.mu.RLock()
	defer s.mu.RUnlock()

	var sessions []model.SessionMeta
	for k, contents := range s.history {
		if !strings.HasPrefix(k, prefix) {
			continue
		}
		conversationID := strings.TrimPrefix(k, prefix)
		title := conversationID
		lastMessage := ""
		for _, c := range contents {
			text := ""
			for _, p := range c.Parts {
				if p != nil {
					text += p.Text
				}
			}
			if c.Role == "user" && title == conversationID {
				title = text
				if len(title) > 30 {
					title = title[:30]
				}
			}
			if text != "" {
				lastMessage = text
				if len(lastMessage) > 60 {
					lastMessage = lastMessage[:60]
				}
			}
		}
		sessions = append(sessions, model.SessionMeta{
			ConversationID: conversationID,
			Title:          title,
			LastMessage:    lastMessage,
		})
	}
	return sessions
}

type ChatService struct {
	client *genai.Client
	store  *store
}

func New() (*ChatService, error) {
	client, err := genai.NewClient(context.Background(), nil)
	if err != nil {
		return nil, err
	}
	return &ChatService{
		client: client,
		store:  &store{history: make(map[string][]*genai.Content)},
	}, nil
}

func (svc *ChatService) Chat(ctx context.Context, userID, conversationID, message string) (*model.ChatResponse, error) {
	if conversationID == "" {
		conversationID = newID()
	}

	history := svc.store.get(userID, conversationID)
	contents := append(history, &genai.Content{
		Role:  "user",
		Parts: []*genai.Part{genai.NewPartFromText(message)},
	})

	resp, err := svc.client.Models.GenerateContent(
		ctx,
		"gemini-2.5-flash",
		contents,
		&genai.GenerateContentConfig{
			SystemInstruction: genai.NewContentFromText(systemInstruction, "user"),
		},
	)
	if err != nil {
		return nil, err
	}

	replyText := resp.Text()
	contents = append(contents, &genai.Content{
		Role:  "model",
		Parts: []*genai.Part{genai.NewPartFromText(replyText)},
	})
	svc.store.set(userID, conversationID, contents)

	return &model.ChatResponse{ConversationID: conversationID, Reply: replyText}, nil
}

func (svc *ChatService) History(userID, conversationID string) *model.HistoryResponse {
	history := svc.store.get(userID, conversationID)
	messages := make([]model.HistoryMessage, 0, len(history))
	for _, c := range history {
		role := c.Role
		if role == "model" {
			role = "assistant"
		}
		text := ""
		for _, p := range c.Parts {
			if p != nil {
				text += p.Text
			}
		}
		messages = append(messages, model.HistoryMessage{Role: role, Content: text})
	}
	return &model.HistoryResponse{Messages: messages}
}

func (svc *ChatService) Sessions(userID string) *model.SessionsResponse {
	sessions := svc.store.list(userID)
	if sessions == nil {
		sessions = []model.SessionMeta{}
	}
	return &model.SessionsResponse{Sessions: sessions}
}
