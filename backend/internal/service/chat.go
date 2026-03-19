package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"

	"github.com/GDGoC-Japan-Hackathon/git-push-pray/backend/internal/model"
	"github.com/GDGoC-Japan-Hackathon/git-push-pray/backend/internal/repository"
	"github.com/google/uuid"
	"google.golang.org/genai"
	"gorm.io/gorm"
)

// StreamEvent はSSEで送信されるイベント
type StreamEvent struct {
	Type string // "chunk" or "done" or "error"
	Data string // JSON string
}

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

6. ビジュアライズの提案（積極的に行うこと）
先生の説明している内容が図・チャート・フローチャート・アニメーション・関係図・タイムライン・比較表などで視覚的に表現できそうな場合、questionsの一つとしてtype="visualize"のビジュアライズ提案を必ず含めてください。具体的な内容に触れた会話では、ほぼ毎回ビジュアライズを提案すること。抽象的な挨拶や雑談のみの場合は不要。summaryは「図で整理してみる」「フローチャートで見る」など具体的に。

【出力形式】
必ず以下のJSON形式のみで返答してください。JSON以外のテキストは一切出力しないでください。
questionsフィールドには必ず1〜3個の要素を含めること。空配列（[]）は絶対に禁止です。
各questionにはtypeフィールドを含めること。通常の質問は"question"、ビジュアライズ提案は"visualize"。

{
  "reply": "会話的な返答。質問も必ずこのフィールドに自然な文として含める。",
  "answer_summary": "先生の直前の説明を15字以内で要約。会話の最初のメッセージなら空文字。",
  "questions": [
    { "summary": "質問の要約（15字以内）", "type": "question" },
    { "summary": "図で整理してみる", "type": "visualize" }
  ]
}`

const artifactInstruction = `

【重要：ビジュアル生成リクエスト】
ユーザーがビジュアライズを明示的にリクエストしています。artifactフィールドにHTMLを必ず生成してください。空にすることは禁止です。
・これまでの会話内容を踏まえて、最も効果的なビジュアル（図・チャート・アニメーション・インタラクティブUI等）を作成すること。
・codeには<body>の中身だけを書くこと。<!DOCTYPE html>や<html>タグは不要。
・表示環境にはTailwind CSS、Inter フォントが事前に読み込まれている。Tailwindのユーティリティクラスを積極的に使うこと。
・追加ライブラリが必要な場合はCDN（Chart.js, D3.js, Three.js等）を<script>タグで読み込んでよい。
・アニメーションやトランジションを活用して、洗練されたインタラクティブな体験を作ること。`

// geminiReply はGeminiから返ってくる構造化JSON
type geminiReply struct {
	Reply         string `json:"reply"`
	AnswerSummary string `json:"answer_summary"`
	Questions     []struct {
		Summary string `json:"summary"`
		Type    string `json:"type"` // "question" or "visualize"
	} `json:"questions"`
	Artifact *struct {
		Title string `json:"title"`
		Code  string `json:"code"`
	} `json:"artifact"`
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

func (svc *ChatService) ChatStream(ctx context.Context, user *model.User, conversationIDStr, message, parentNodeID, answeringQuestion string, generateUI bool) (<-chan StreamEvent, error) {
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

	// 回答済みチェック（ノードが同じ会話に属するかも検証）
	if parentNodeID != "" {
		pID, err := uuid.Parse(parentNodeID)
		if err == nil {
			existingNode, err := repository.GetTreeNodeByID(pID)
			if err != nil {
				if err == gorm.ErrRecordNotFound {
					return nil, fmt.Errorf("invalid parent node")
				}
				return nil, err
			}
			if existingNode.ConversationID != conv.ID {
				return nil, fmt.Errorf("invalid parent node")
			}
			if existingNode.Answer != "" {
				return nil, fmt.Errorf("this node has already been answered")
			}
		}
	}

	dbMessages, err := repository.GetMessagesByConversationID(conv.ID)
	if err != nil {
		return nil, err
	}

	// 全会話履歴をGeminiに渡す
	// generateUI=true の時だけ最後のartifactコードを含める（トークン節約）
	lastArtifactIndex := -1
	if generateUI {
		for i, m := range dbMessages {
			if m.Role == "assistant" && m.ArtifactCode != "" {
				lastArtifactIndex = i
			}
		}
	}

	var contents []*genai.Content
	for i, m := range dbMessages {
		role := m.Role
		if role == "assistant" {
			role = "model"
		}
		text := m.Content
		// generateUI=true かつ最後のartifactを持つメッセージにのみコードを付加
		if generateUI && i == lastArtifactIndex && m.ArtifactCode != "" {
			text += fmt.Sprintf("\n\n[前回生成したartifact: %s]\n%s", m.ArtifactTitle, m.ArtifactCode)
		}
		contents = append(contents, &genai.Content{
			Role:  role,
			Parts: []*genai.Part{genai.NewPartFromText(text)},
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

	schemaProps := map[string]*genai.Schema{
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
					"type": {
						Type:        genai.TypeString,
						Description: "question: 通常の質問, visualize: ビジュアライズの提案",
						Enum:        []string{"question", "visualize"},
					},
				},
				Required: []string{"summary", "type"},
			},
		},
	}
	requiredFields := []string{"reply", "answer_summary", "questions"}

	// generateUI=true の場合のみartifactスキーマを追加（必須）
	if generateUI {
		schemaProps["artifact"] = &genai.Schema{
			Type:        genai.TypeObject,
			Description: "ユーザーがビジュアライズをリクエストしている。必ずartifactを生成すること。HTMLは完全に自己完結（inline CSS/JS、外部CDN可）。",
			Properties: map[string]*genai.Schema{
				"title": {Type: genai.TypeString, Description: "タイトル（20字以内）"},
				"code":  {Type: genai.TypeString, Description: "自己完結したHTML（inline CSS/JS）。<body>の中身だけ書く。"},
			},
			Required: []string{"title", "code"},
		}
		requiredFields = append(requiredFields, "artifact")
	}

	responseSchema := &genai.Schema{
		Type:       genai.TypeObject,
		Properties: schemaProps,
		Required:   requiredFields,
	}

	// generateUI=true の場合はartifact生成指示を追加
	sysPrompt := systemInstruction
	if generateUI {
		sysPrompt += artifactInstruction
	}

	config := &genai.GenerateContentConfig{
		SystemInstruction: genai.NewContentFromText(sysPrompt, "user"),
		ResponseMIMEType:  "application/json",
		ResponseSchema:    responseSchema,
		SafetySettings: []*genai.SafetySetting{
			{Category: genai.HarmCategoryHarassment, Threshold: genai.HarmBlockThresholdBlockOnlyHigh},
			{Category: genai.HarmCategoryHateSpeech, Threshold: genai.HarmBlockThresholdBlockOnlyHigh},
			{Category: genai.HarmCategorySexuallyExplicit, Threshold: genai.HarmBlockThresholdBlockOnlyHigh},
			{Category: genai.HarmCategoryDangerousContent, Threshold: genai.HarmBlockThresholdBlockOnlyHigh},
		},
	}

	// DBに保存（user message）- ストリーム開始前に保存
	userMsg, err := repository.CreateMessage(conv.ID, "user", message, 0, "", "")
	if err != nil {
		return nil, err
	}

	ch := make(chan StreamEvent, 16)

	go func() {
		defer close(ch)

		var accumulated strings.Builder
		chunkCount := 0

		for resp, err := range svc.client.Models.GenerateContentStream(ctx, "gemini-2.5-flash", contents, config) {
			if err != nil {
				log.Printf("Stream error: %v", err)
				errJSON, _ := json.Marshal(map[string]string{"error": err.Error()})
				ch <- StreamEvent{Type: "error", Data: string(errJSON)}
				return
			}
			chunk := resp.Text()
			accumulated.WriteString(chunk)
			chunkCount++

			chunkData, _ := json.Marshal(map[string]string{"text": accumulated.String()})
			ch <- StreamEvent{Type: "chunk", Data: string(chunkData)}
		}

		log.Printf("Stream completed: %d chunks, %d bytes", chunkCount, accumulated.Len())

		// ストリーム完了 → パース & DB保存
		fullText := accumulated.String()
		var parsed geminiReply
		if err := json.Unmarshal([]byte(fullText), &parsed); err != nil {
			log.Printf("Gemini response parse error: %v, raw: %s", err, fullText)
			parsed.Reply = fullText
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
			if err := repository.CreateTreeNode(rootNode); err != nil {
				log.Printf("failed to create root tree node: %v", err)
			} else {
				activeParentNodeID = rootNode.ID.String()
			}
		} else if parentNodeID != "" {
			// 親ノードの answer を更新
			pID, err := uuid.Parse(parentNodeID)
			if err == nil {
				if err := repository.UpdateTreeNodeAnswer(pID, conv.ID, parsed.AnswerSummary, userMsg.ID); err != nil {
					log.Printf("failed to update tree node answer (nodeID=%s): %v", pID, err)
				}
			}
		}

		// DBに保存（assistant reply）
		var artifactTitle, artifactCode string
		if parsed.Artifact != nil && parsed.Artifact.Code != "" {
			artifactTitle = parsed.Artifact.Title
			artifactCode = parsed.Artifact.Code
		}

		aiMsg, err := repository.CreateMessage(conv.ID, "assistant", parsed.Reply, 0, artifactTitle, artifactCode)
		if err != nil {
			log.Printf("failed to save assistant message: %v", err)
			return
		}

		newNodes := make([]model.QuestionNode, 0, len(parsed.Questions))
		for _, q := range parsed.Questions {
			var pID *uuid.UUID
			if activeParentNodeID != "" {
				parsedPID, err := uuid.Parse(activeParentNodeID)
				if err == nil {
					pID = &parsedPID
				}
			}

			nodeType := q.Type
			if nodeType == "" {
				nodeType = "question"
			}

			node := &model.ConversationTreeNode{
				ID:             uuid.New(),
				ConversationID: conv.ID,
				MessageID:      aiMsg.ID,
				ParentNodeID:   pID,
				Text:           q.Summary,
				NodeType:       nodeType,
				Answer:         "",
			}
			if err := repository.CreateTreeNode(node); err != nil {
				log.Printf("failed to create conversation tree node: %v", err)
				continue
			}

			newNodes = append(newNodes, model.QuestionNode{
				ID:      node.ID.String(),
				Summary: node.Text,
				Type:    nodeType,
			})
		}

		_ = repository.TouchConversation(conv.ID)

		var artifact *model.Artifact
		if artifactCode != "" {
			artifact = &model.Artifact{
				Title: artifactTitle,
				Code:  artifactCode,
			}
		}

		doneResp := &model.ChatResponse{
			ConversationID: conv.ID.String(),
			Reply:          parsed.Reply,
			AnswerSummary:  parsed.AnswerSummary,
			Questions:      newNodes,
			Artifact:       artifact,
		}
		doneData, _ := json.Marshal(doneResp)
		ch <- StreamEvent{Type: "done", Data: string(doneData)}
	}()

	return ch, nil
}

func (svc *ChatService) GetConversationTree(conversationIDStr string, userID uuid.UUID) (*model.ConversationTreeResponse, error) {
	convID, err := uuid.Parse(conversationIDStr)
	if err != nil {
		return nil, gorm.ErrRecordNotFound
	}

	if _, err := repository.GetConversationByIDAndUserID(convID, userID); err != nil {
		return nil, err
	}

	dbNodes, err := repository.GetTreeNodesByConversationID(convID)
	if err != nil {
		return nil, err
	}

	result := make([]model.TreeNodeResponse, 0, len(dbNodes))
	for _, n := range dbNodes {
		parentID := ""
		if n.ParentNodeID != nil {
			parentID = n.ParentNodeID.String()
		}
		nodeType := n.NodeType
		if nodeType == "" {
			nodeType = "question"
		}
		result = append(result, model.TreeNodeResponse{
			ID:       n.ID.String(),
			ParentID: parentID,
			Text:     n.Text,
			Answer:   n.Answer,
			Type:     nodeType,
		})
	}
	return &model.ConversationTreeResponse{Nodes: result}, nil
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
		hm := model.HistoryMessage{Role: m.Role, Content: m.Content}
		if m.ArtifactCode != "" {
			hm.Artifact = &model.Artifact{Title: m.ArtifactTitle, Code: m.ArtifactCode}
		}
		messages = append(messages, hm)
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
