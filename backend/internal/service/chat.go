package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/GDGoC-Japan-Hackathon/git-push-pray/backend/internal/model"
	"google.golang.org/genai"
)

const systemInstruction = `あなたは「好奇心旺盛で学ぶ意欲が高い生徒（後輩）」のペルソナを持つAIです。
ユーザーはあなたに様々なトピックを教える「先生」です。
このシステムは「ユーザー（先生）自身が、あなたに教える過程で理解を深めること」を最大の目的としています。以下のルールを厳格に守って対話を行ってください。

【基本設定と口調】
・礼儀正しいが親しみやすい、少し砕けた敬語（「〜ですか？」「〜ですね！」「なるほど！」など）を使用してください。
・ガチガチのビジネス敬語や、過度に砕けたタメ口は避けてください。
・ユーザーを「先生」と呼んでください。
・そのトピックについては「全くの初心者」として振る舞ってください。

【厳守すべき行動ルール】
1. 答えを先回りしない（最重要）
ユーザーが説明しようとしている内容の先を読んだり、あなたから専門用語の解説や正解を提示したりすることは絶対に避けてください。あなたの役割は「教えられること」です。

2. 具体化と例え話を求める
ユーザーの説明が抽象的、または専門用語がそのまま使われている場合は、分かったふりをしないでください。「それって、身近なものに例えるとどういうことですか？」「中学生の私にも分かるように言うと、どうなりますか？」と具体例や噛み砕いた説明を求めてください。

3. ソクラテス式の質問（矛盾へのアプローチ）
ユーザーの説明に論理的な飛躍や誤りを感じた場合でも、直接「それは間違っています」と否定したり、正解を教えたりしないでください。代わりに「先生、〇〇の部分は分かったのですが、だとすると△△の場合はどうなってしまうんですか？」と素朴な疑問を投げかけ、ユーザー自身に気づかせ、再考を促してください。

4. 自分の言葉で要約・確認する
ユーザーの説明で一つの区切りがついたり、あなたの疑問が解決した場合は、「つまり、先生が言いたいのは〇〇ということですね！スッキリしました！」と、あなた自身の言葉で短く要約し、理解が合っているか確認してください。

5. 簡潔なキャッチボール
一度に複数の質問を投げかけたり、長文で返答したりしないでください。対話のテンポを重視し、1回の返答は短く（1〜3文程度）まとめて、ユーザーが話しやすい余白を作ってください。`

func newID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return hex.EncodeToString(b)
}

type store struct {
	mu        sync.RWMutex
	history   map[string][]*genai.Content
	updatedAt map[string]time.Time
}

func (s *store) key(userID, conversationID string) string {
	return userID + ":" + conversationID
}

func (s *store) get(userID, conversationID string) []*genai.Content {
	s.mu.RLock()
	defer s.mu.RUnlock()
	src := s.history[s.key(userID, conversationID)]
	if src == nil {
		return nil
	}
	dst := make([]*genai.Content, len(src))
	copy(dst, src)
	return dst
}

func (s *store) set(userID, conversationID string, contents []*genai.Content) {
	s.mu.Lock()
	defer s.mu.Unlock()
	key := s.key(userID, conversationID)
	s.history[key] = contents
	s.updatedAt[key] = time.Now()
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
		updatedAt := ""
		if t, ok := s.updatedAt[k]; ok {
			updatedAt = t.Format(time.RFC3339)
		}
		sessions = append(sessions, model.SessionMeta{
			ConversationID: conversationID,
			Title:          title,
			LastMessage:    lastMessage,
			UpdatedAt:      updatedAt,
		})
	}
	sort.Slice(sessions, func(i, j int) bool {
		return sessions[i].UpdatedAt > sessions[j].UpdatedAt
	})
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
		store: &store{
			history:   make(map[string][]*genai.Content),
			updatedAt: make(map[string]time.Time),
		},
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
			SafetySettings: []*genai.SafetySetting{
				{
					Category:  genai.HarmCategoryHarassment,
					Threshold: genai.HarmBlockThresholdBlockOnlyHigh,
				},
				{
					Category:  genai.HarmCategoryHateSpeech,
					Threshold: genai.HarmBlockThresholdBlockOnlyHigh,
				},
				{
					Category:  genai.HarmCategorySexuallyExplicit,
					Threshold: genai.HarmBlockThresholdBlockOnlyHigh,
				},
				{
					Category:  genai.HarmCategoryDangerousContent,
					Threshold: genai.HarmBlockThresholdBlockOnlyHigh,
				},
			},
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
