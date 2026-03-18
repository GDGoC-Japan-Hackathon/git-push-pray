package service

import (
	"context"

	"github.com/GDGoC-Japan-Hackathon/git-push-pray/backend/internal/model"
	"github.com/GDGoC-Japan-Hackathon/git-push-pray/backend/internal/repository"
	"github.com/google/uuid"
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

type ChatService struct {
	client *genai.Client
}

func New() (*ChatService, error) {
	client, err := genai.NewClient(context.Background(), nil)
	if err != nil {
		return nil, err
	}
	return &ChatService{client: client}, nil
}

func EnsureUser(firebaseUID, name, email string) (*model.User, error) {
	return repository.FindOrCreateUser(firebaseUID, name, email)
}

func (svc *ChatService) Chat(ctx context.Context, user *model.User, conversationIDStr, message string) (*model.ChatResponse, error) {
	var conv *model.Conversation

	convID, parseErr := uuid.Parse(conversationIDStr)
	if parseErr == nil {
		conv, _ = repository.GetConversationByIDAndUserID(convID, user.ID)
	}

	if conv == nil {
		title := message
		if len([]rune(title)) > 30 {
			title = string([]rune(title)[:30])
		}
		var err error
		conv, err = repository.CreateConversation(user.ID, title)
		if err != nil {
			return nil, err
		}
	}

	dbMessages, err := repository.GetMessagesByConversationID(conv.ID)
	if err != nil {
		return nil, err
	}

	var contents []*genai.Content
	for _, m := range dbMessages {
		role := m.Role
		if role == "assistant" {
			role = "model"
		}
		contents = append(contents, &genai.Content{
			Role:  role,
			Parts: []*genai.Part{genai.NewPartFromText(m.Content)},
		})
	}

	contents = append(contents, &genai.Content{
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

	if _, err := repository.CreateMessage(conv.ID, "user", message, 0); err != nil {
		return nil, err
	}
	if _, err := repository.CreateMessage(conv.ID, "assistant", replyText, 0); err != nil {
		return nil, err
	}

	if err := repository.TouchConversation(conv.ID); err != nil {
		return nil, err
	}

	return &model.ChatResponse{
		ConversationID: conv.ID.String(),
		Reply:          replyText,
	}, nil
}

func (svc *ChatService) History(userID uuid.UUID, conversationIDStr string) (*model.HistoryResponse, error) {
	convID, err := uuid.Parse(conversationIDStr)
	if err != nil {
		return &model.HistoryResponse{Messages: []model.HistoryMessage{}}, nil
	}

	conv, err := repository.GetConversationByIDAndUserID(convID, userID)
	if err != nil {
		return &model.HistoryResponse{Messages: []model.HistoryMessage{}}, nil
	}

	dbMessages, err := repository.GetMessagesByConversationID(conv.ID)
	if err != nil {
		return nil, err
	}

	messages := make([]model.HistoryMessage, 0, len(dbMessages))
	for _, m := range dbMessages {
		messages = append(messages, model.HistoryMessage{Role: m.Role, Content: m.Content})
	}
	return &model.HistoryResponse{Messages: messages}, nil
}

func (svc *ChatService) Sessions(userID uuid.UUID) (*model.SessionsResponse, error) {
	convs, err := repository.ListConversationsByUserID(userID)
	if err != nil {
		return nil, err
	}

	sessions := make([]model.SessionMeta, 0, len(convs))
	for _, c := range convs {
		lastMessage := ""
		if msg, err := repository.GetLastMessage(c.ID); err == nil {
			lastMessage = msg.Content
			if len([]rune(lastMessage)) > 60 {
				lastMessage = string([]rune(lastMessage)[:60])
			}
		}
		sessions = append(sessions, model.SessionMeta{
			ConversationID: c.ID.String(),
			Title:          c.Title,
			LastMessage:    lastMessage,
			UpdatedAt:      c.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
		})
	}
	return &model.SessionsResponse{Sessions: sessions}, nil
}
