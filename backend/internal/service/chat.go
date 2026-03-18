package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	"github.com/GDGoC-Japan-Hackathon/git-push-pray/backend/internal/model"
	"github.com/GDGoC-Japan-Hackathon/git-push-pray/backend/internal/repository"
	"github.com/google/uuid"
	"google.golang.org/genai"
	"gorm.io/gorm"
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

5. 毎回必ず質問する（最重要ルールの一つ）
毎回のレスポンスで必ず1〜3個の質問をreplyの中に自然な文章として含めること。questionsが空になることは絶対に禁止。対話のテンポを重視し、replyは短く（2〜4文程度）まとめること。

【出力形式】
必ず以下のJSON形式のみで返答してください。JSON以外のテキストは一切出力しないでください。
questionsフィールドには必ず1〜3個の要素を含めること。空配列（[]）は絶対に禁止です。

{
  "reply": "会話的な返答。質問も必ずこのフィールドに自然な文として含める。例：「なるほど！では、◯◯ってどういう意味ですか？また、△△の場合はどうなりますか？」",
  "answer_summary": "先生の直前の説明を15字以内で要約。会話の最初のメッセージなら空文字。",
  "questions": [
    { "summary": "replyに書いた質問を15字以内で要約（必ず1〜3個）" }
  ]
}`

// geminiReply はGeminiから返ってくる構造化JSON
type geminiReply struct {
	Reply         string `json:"reply"`
	AnswerSummary string `json:"answer_summary"`
	Questions     []struct {
		Summary string `json:"summary"`
	} `json:"questions"`
}

type ChatService struct {
	client *genai.Client
}

func New() (*ChatService, error) {
	client, err := genai.NewClient(context.Background(), nil)
	if err != nil {
		return nil, err
	}
	return &ChatService{
		client: client,
	}, nil
}

func EnsureUser(firebaseUID, name, email string) (*model.User, error) {
	return repository.FindOrCreateUser(firebaseUID, name, email)
}

func (svc *ChatService) Chat(ctx context.Context, user *model.User, conversationIDStr, message, parentNodeID, answeringQuestion string) (*model.ChatResponse, error) {
	var conv *model.Conversation
	isNewConversation := false

	convID, parseErr := uuid.Parse(conversationIDStr)
	if parseErr == nil {
		var err error
		conv, err = repository.GetConversationByIDAndUserID(convID, user.ID)
		if err != nil && err != gorm.ErrRecordNotFound {
			return nil, err
		}
	}

	if conv == nil {
		isNewConversation = true
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

	// 回答済みチェック
	if parentNodeID != "" {
		pID, err := uuid.Parse(parentNodeID)
		if err == nil {
			existingNode, _ := repository.GetTreeNodeByID(pID)
			if existingNode != nil && existingNode.Answer != "" {
				return nil, fmt.Errorf("this node has already been answered")
			}
		}
	}

	dbMessages, err := repository.GetMessagesByConversationID(conv.ID)
	if err != nil {
		return nil, err
	}

	// 全会話履歴をGeminiに渡す（Option 1）
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

	// どの質問に回答しているかをメッセージに付加
	userMessage := message
	if answeringQuestion != "" {
		userMessage = fmt.Sprintf("[回答している質問: %s]\n\n%s", answeringQuestion, message)
	}
	contents = append(contents, &genai.Content{
		Role:  "user",
		Parts: []*genai.Part{genai.NewPartFromText(userMessage)},
	})

	responseSchema := &genai.Schema{
		Type: genai.TypeObject,
		Properties: map[string]*genai.Schema{
			"reply": {
				Type:        genai.TypeString,
				Description: "会話的な返答（1〜3文）",
			},
			"answer_summary": {
				Type:        genai.TypeString,
				Description: "ユーザーの説明の要約（15字以内）。最初のメッセージは空文字。",
			},
			"questions": {
				Type: genai.TypeArray,
				Items: &genai.Schema{
					Type: genai.TypeObject,
					Properties: map[string]*genai.Schema{
						"summary": {
							Type:        genai.TypeString,
							Description: "質問の要約（15字以内）",
						},
					},
					Required: []string{"summary"},
				},
			},
		},
		Required: []string{"reply", "answer_summary", "questions"},
	}

	resp, err := svc.client.Models.GenerateContent(
		ctx,
		"gemini-2.5-flash",
		contents,
		&genai.GenerateContentConfig{
			SystemInstruction: genai.NewContentFromText(systemInstruction, "user"),
			ResponseMIMEType:  "application/json",
			ResponseSchema:    responseSchema,
			SafetySettings: []*genai.SafetySetting{
				{Category: genai.HarmCategoryHarassment, Threshold: genai.HarmBlockThresholdBlockOnlyHigh},
				{Category: genai.HarmCategoryHateSpeech, Threshold: genai.HarmBlockThresholdBlockOnlyHigh},
				{Category: genai.HarmCategorySexuallyExplicit, Threshold: genai.HarmBlockThresholdBlockOnlyHigh},
				{Category: genai.HarmCategoryDangerousContent, Threshold: genai.HarmBlockThresholdBlockOnlyHigh},
			},
		},
	)
	if err != nil {
		return nil, err
	}

	var parsed geminiReply
	if err := json.Unmarshal([]byte(resp.Text()), &parsed); err != nil {
		// フォールバック: plain textをreplyとして扱う
		parsed.Reply = resp.Text()
	}

	// DBに保存（user message）
	userMsg, err := repository.CreateMessage(conv.ID, "user", message, 0)
	if err != nil {
		return nil, err
	}

	var activeParentNodeID = parentNodeID

	// 初回の場合は、まず「テーマ」をルートノードとして作成する
	if isNewConversation {
		rootNode := &model.ConversationTreeNode{
			ID:             uuid.New(),
			ConversationID: conv.ID,
			MessageID:      userMsg.ID,
			ParentNodeID:   nil,
			Text:           message,
			Answer:         "",
		}
		if err := repository.CreateTreeNode(rootNode); err == nil {
			activeParentNodeID = rootNode.ID.String()
		}
	} else if parentNodeID != "" {
		// 親ノードの answer を更新
		pID, err := uuid.Parse(parentNodeID)
		if err == nil {
			_ = repository.UpdateTreeNodeAnswer(pID, parsed.AnswerSummary, userMsg.ID)
		}
	}

	// DBに保存（assistant reply）
	aiMsg, err := repository.CreateMessage(conv.ID, "assistant", parsed.Reply, 0)
	if err != nil {
		return nil, err
	}

	// 新しい質問ノードを作成
	newNodes := make([]model.QuestionNode, 0, len(parsed.Questions))
	for _, q := range parsed.Questions {
		var pID *uuid.UUID
		if activeParentNodeID != "" {
			parsedPID, err := uuid.Parse(activeParentNodeID)
			if err == nil {
				pID = &parsedPID
			}
		}

		node := &model.ConversationTreeNode{
			ID:             uuid.New(),
			ConversationID: conv.ID,
			MessageID:      aiMsg.ID,
			ParentNodeID:   pID,
			Text:           q.Summary,
			Answer:         "",
		}
		if err := repository.CreateTreeNode(node); err != nil {
			log.Printf("failed to create conversation tree node: %v", err)
			continue
		}

		newNodes = append(newNodes, model.QuestionNode{
			ID:      node.ID.String(),
			Summary: node.Text,
		})
	}

	if err := repository.TouchConversation(conv.ID); err != nil {
		return nil, err
	}

	return &model.ChatResponse{
		ConversationID: conv.ID.String(),
		Reply:          parsed.Reply,
		AnswerSummary:  parsed.AnswerSummary,
		Questions:      newNodes,
	}, nil
}

func (svc *ChatService) GetConversationTree(conversationIDStr string) *model.ConversationTreeResponse {
	convID, err := uuid.Parse(conversationIDStr)
	if err != nil {
		return &model.ConversationTreeResponse{Nodes: []model.TreeNodeResponse{}}
	}

	dbNodes, err := repository.GetTreeNodesByConversationID(convID)
	if err != nil {
		return &model.ConversationTreeResponse{Nodes: []model.TreeNodeResponse{}}
	}

	result := make([]model.TreeNodeResponse, 0, len(dbNodes))
	for _, n := range dbNodes {
		parentID := ""
		if n.ParentNodeID != nil {
			parentID = n.ParentNodeID.String()
		}
		result = append(result, model.TreeNodeResponse{
			ID:       n.ID.String(),
			ParentID: parentID,
			Text:     n.Text,
			Answer:   n.Answer,
		})
	}
	return &model.ConversationTreeResponse{Nodes: result}
}

func (svc *ChatService) History(userID uuid.UUID, conversationIDStr string) (*model.HistoryResponse, error) {
	convID, err := uuid.Parse(conversationIDStr)
	if err != nil {
		return nil, err
	}

	conv, err := repository.GetConversationByIDAndUserID(convID, userID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return &model.HistoryResponse{Messages: []model.HistoryMessage{}}, nil
		}
		return nil, err
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
