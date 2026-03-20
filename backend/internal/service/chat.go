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

6. ビジュアライズの提案と自律生成
先生の説明している内容が図・チャート・フローチャート・アニメーション・関係図・タイムライン・比較表などで視覚的に表現できそうな場合、questionsの一つとしてtype="visualize"のビジュアライズ提案を必ず含めてください。具体的な内容に触れた会話では、ほぼ毎回ビジュアライズを提案すること。抽象的な挨拶や雑談のみの場合は不要。summaryは「図で整理してみる」「フローチャートで見る」など具体的に。
また、先生の説明が複雑で図にした方が明らかに理解しやすい場合は、提案するだけでなくartifactフィールドにHTMLを直接生成してもよい。

【数式の表示】
replyフィールドで数式を書く場合はKaTeX記法を使用してください。
・インライン数式: $E = mc^2$ のように $...$ で囲む
・ブロック数式（独立した行に大きく表示）: $$\int_0^\infty e^{-x^2} dx$$ のように $$...$$ で囲む
数式が含まれる説明（物理・数学・統計等）では積極的に使用してください。

7. 学習完了の提案
テーマについてユーザーが十分に説明し終えたと感じたら（主要な概念が網羅され、質問への回答も的確だった場合）、suggest_endをtrueにしてください。
ただし、まだ掘り下げるべき重要な側面が残っている場合はfalseのままにしてください。
suggest_endをtrueにする場合、replyの中で「先生、〇〇についてかなり理解できました！そろそろ学習のまとめに入りますか？それともまだ教えたいことがありますか？」のように、続けるかどうかをユーザーに確認してください。

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
  ],
  "suggest_end": false
}`

const artifactInstruction = `

【ビジュアル生成について】
先生の説明がテキストだけでは伝わりにくく、図・チャート・フローチャート・アニメーション・関係図・タイムライン・比較表等で視覚的に表現した方が理解が深まると判断した場合、artifactフィールドにコードを生成してください。
テキストだけで十分理解できる場合や、まだ具体的な内容が出ていない段階では省略してください。
また、先生が「図にして」「ビジュアライズして」等と明示的にリクエストした場合は必ず生成してください。

【会話内容の反映（最重要）】
・ビジュアルは必ずこれまでの会話履歴の具体的な内容に基づいて作成すること。汎用的・教科書的な図ではなく、先生が実際に説明した内容・用いた例え・具体例をそのまま図に反映させること。
・先生が説明に使った用語や表現をビジュアル内のラベル・テキストにそのまま使用すること。
・会話の中で先生が強調したポイント、繰り返し説明した部分を重点的に視覚化すること。
・先生の説明の流れ（順序・因果関係・対比など）をビジュアルの構造に反映させること。

【前回のartifactを進化させる（最重要）】
・会話履歴に[前回生成したartifact]が含まれている場合、そのコードをベースに今回の新しい情報を追加・拡張すること。
・新しい説明で登場した概念・数値・関係性を前回のビジュアルに積み上げていくこと。セクションの追加、データの更新、新しいパネルの追加等で進化させること。
・前回と全く同じ構造・レイアウト・内容のコードを出力しないこと。必ず今回の会話で得た新情報が視覚的に加わっていること。

【品質基準（最重要）】
・プロのUIデザイナーが作成したような、視覚的に洗練された高品質なビジュアルを生成すること。
・色・サイズ・余白・フォントに一貫したデザインシステムを適用し、視覚的な矛盾（色のばらつき、サイズの不統一、余白のズレ等）が一切ないようにすること。
・要素の配置は整列・グルーピングを意識し、情報の優先度が一目でわかるレイアウトにすること。
・インタラクティブな要素（ホバー・クリック・スライダー等）を積極的に使い、静的な図より動的・体験的な理解を促すこと。

【技術要件】
・codeにはReact (JSX) コンポーネントを書くこと。必ず「export default function App() { return (...) }」の形式で始めること。
・コードは必ず適切な改行とインデントを含めること。一行にまとめず、読みやすい形式で出力すること。
・HTMLタグ（<!DOCTYPE>, <html>, <body>, <script>）は一切書かないこと。CDN読み込みも不要。
・Tailwind CSSのユーティリティクラスが使える。積極的に使うこと。
・以下のライブラリがimport可能（必要に応じて使う）:
  - recharts: グラフ・チャート（BarChart, LineChart, PieChart, ResponsiveContainer等）
  - framer-motion: アニメーション（motion.div等）
  - d3: データ可視化（低レベルな描画が必要な場合）
  - @radix-ui/themes: UIコンポーネント（Button, Card, Badge, Table, Dialog, Tabs, Tooltip, Flex, Grid, Text等）。使う場合は必ず先頭で「import '@radix-ui/themes/styles.css';」をimportし、ルートを「<Theme>...</Theme>」で囲むこと。「@radix-ui/react-tooltip」など個別のRadixパッケージは使わず、必ず@radix-ui/themesから使うこと。
  - react-katex: 数式レンダリング。「import 'katex/dist/katex.min.css'; import { InlineMath, BlockMath } from 'react-katex';」でimportして使う。katexを直接importしないこと。
  - @react-three/fiber + @react-three/drei: 3Dグラフィクス。「import { Canvas, useFrame } from '@react-three/fiber'; import { OrbitControls, Text } from '@react-three/drei';」でimportして使う。Canvasコンポーネントを親にしてその中にmesh等を配置する。Canvasには必ずstyle={{ width: '100%', height: '400px' }}を指定すること。threeを直接importしないこと。
・React hooksはReactからimportして使ってよい（useState, useEffect, useMemo等）。
・理解を助けると考えられる場合はアニメーションやインタラクティブな要素を活用すること。

【デザインガイドライン】
・カラーパレット: 1つのビジュアル内で使う色は3〜4色に絞り、トーンを統一すること（明るい系なら全体的に明るく、落ち着いた系なら全体的に落ち着いた色で統一）。blue-500/600をプライマリ、gray-100〜800をベース、アクセントにamber-400やgreen-500を使う。
・フォントサイズ: タイトルはtext-xl〜2xl font-bold、本文はtext-sm〜base、ラベルはtext-xs。異なる役割の文字には必ず異なるサイズ・太さを使い、階層を明確にする。
・余白: カード間はspace-y-4、内側はp-4〜6。同じ種類の要素には同じ余白を適用し、一貫性を保つ。
・カード: bg-white rounded-xl shadow-sm border border-gray-100 を基本とする。shadow の強さはカードの重要度に応じて統一する。
・全体を min-h-[300px] p-6 で囲み、背景はbg-gradient-to-br from-gray-50 to-white等の柔らかいグラデーション。
・アイコンや図形を使う場合、同じ種類の要素には同じスタイルを適用すること（大きさ・色・形を統一）。
・データや情報が複数ある場合は必ずグリッドやフレックスで整列し、バラバラに配置しないこと。

【良い例（rechartsを使ったグラフ）】
import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

const data = [
  { name: "ステップA", value: 40 },
  { name: "ステップB", value: 70 },
  { name: "ステップC", value: 55 },
];
const COLORS = ["#3b82f6", "#10b981", "#f59e0b"];

export default function App() {
  const [active, setActive] = useState(null);
  return (
    <div className="min-h-[300px] p-6 bg-gradient-to-br from-gray-50 to-white">
      <h2 className="text-xl font-bold text-gray-800 mb-4">プロセスの比較</h2>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey="value" radius={[6, 6, 0, 0]} onMouseEnter={(_, i) => setActive(i)} onMouseLeave={() => setActive(null)}>
            {data.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} opacity={active === null || active === i ? 1 : 0.4} />))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
※上記はあくまで形式の参考。実際の内容は会話に基づいて作成すること。
コードは一行にまとめて生成するのではなく、自然な改行を含めて生成してください。`

const artifactForceInstruction = `

【ユーザーからのビジュアライズリクエスト】
ユーザーがビジュアライズを明示的にリクエストしています。artifactフィールドにHTMLを必ず生成してください。空にすることは禁止です。`

const initSystemInstruction = `あなたはユーザーが学びたいテーマを具体化するためのアシスタントです。
ユーザーが入力したテーマについて、2〜3回の短い対話で学習範囲を絞り込んでください。

【ルール】
・親しみやすい敬語で対話してください。
・ユーザーの入力を受けて、具体的に何を学びたいのか明確にする質問を1つだけしてください。
・質問は短く（1〜2文）。選択肢を提示すると親切です。
・テーマが十分に具体的になったと判断したら、theme_decidedをtrueにし、decided_themeに最終テーマ（20字以内）を入れてください。
・最終テーマ決定時のreplyは「〇〇というテーマで学習を始めましょう！」のような確認メッセージにしてください。
・通常2〜3往復で決定してください。ユーザーが最初から具体的なら1往復でもOKです。`

const reviewSystemInstruction = `あなたは各分野の知識に精通したファクトチェッカーです。ユーザー（先生役）がAI（生徒役）に教えた会話全体を分析し、
ユーザーが教えた内容の事実としての正確性を厳密に評価してください。

【最重要：評価の焦点は「内容の正確性」】
このレビューの目的は、ユーザーが教えた知識が事実として正しいかどうかを判定することです。
説明の上手さや教え方の流れではなく、述べられた事実・概念・定義・因果関係が正確かどうかに集中してください。

【評価基準】
1. 事実の正確性（最重要）: 教えた内容は客観的事実として正しいか？誤った情報、不正確な定義、間違った因果関係はないか？
2. 概念の正確性: 専門用語や概念の使い方は正しいか？誤用や混同はないか？
3. 知識の完全性: 重要な事実の欠落や、誤解を招く省略はないか？
4. 根拠の妥当性: 主張に対する根拠や例は事実に基づいているか？

【スコア基準】
- 90-100: 非常に正確。事実誤認がほぼなく、正確な知識に基づいている
- 70-89: 概ね正確。軽微な不正確さや曖昧な表現があるが、大筋は正しい
- 50-69: 部分的に正確。いくつかの事実誤認や不正確な説明が含まれる
- 30-49: 不正確な点が多い。重要な事実の誤りや根本的な誤解が見られる
- 0-29: 大部分が不正確。重大な事実誤認が複数含まれる

【strengthsとweaknessesの書き方】
- strengthsには「正確に説明できていた具体的な事実や概念」を書くこと
- weaknessesには「事実と異なる点、不正確な説明、誤解している概念」を具体的に指摘し、正しい情報も併記すること

【重要な注意事項】
- 会話の途中で学習が終了しているため、生徒（AI）からの未回答の質問が残っている場合があります。未回答の質問については評価対象外としてください。「質問に回答していない」ことを弱点として挙げないでください。
- 会話中にビジュアライズ（図・チャート・HTML）が生成されている場合があります。ビジュアライズのタイトルが会話履歴に含まれています。ユーザーが「図で説明する」と言及した場合、実際にビジュアライズが生成されていればそれは正しく提供されたものとして扱ってください。

【出力形式】
必ず以下のJSON形式のみで返答してください。JSON以外のテキストは一切出力しないでください。`

// reviewReply はレビューフェーズでGeminiから返ってくるJSON
type reviewReply struct {
	OverallScore     int `json:"overall_score"`
	Summary          string `json:"summary"`
	Strengths        []string `json:"strengths"`
	Weaknesses       []string `json:"weaknesses"`
	Advice           string `json:"advice"`
	TopicEvaluations []struct {
		Topic       string `json:"topic"`
		Score       int    `json:"score"`
		Correctness string `json:"correctness"`
		Clarity     string `json:"clarity"`
		Comment     string `json:"comment"`
	} `json:"topic_evaluations"`
}

// initReply は初期化フェーズでGeminiから返ってくるJSON
type initReply struct {
	Reply        string `json:"reply"`
	ThemeDecided bool   `json:"theme_decided"`
	DecidedTheme string `json:"decided_theme"`
}

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
	SuggestEnd bool `json:"suggest_end"`
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

func (svc *ChatService) ChatStream(ctx context.Context, user *model.User, conversationIDStr, message, parentNodeID, answeringQuestion string, generateUI, isSupplement bool, contextParentNodeID string) (<-chan StreamEvent, error) {
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

	// 既存会話でPhaseが空（マイグレーション前のデータ）→ ツリーノードがあれば"teaching"として扱う
	phase := conv.Phase
	if phase == "" || phase == "init" {
		nodes, _ := repository.GetTreeNodesByConversationID(conv.ID)
		if len(nodes) > 0 {
			phase = "teaching"
		} else if phase == "" {
			phase = "init"
		}
	}

	// initフェーズの場合は初期化フロー
	if phase == "init" {
		return svc.chatStreamInit(ctx, conv, user, message, isNewConversation)
	}

	// teachingフェーズ: 既存の教育フロー
	return svc.chatStreamTeaching(ctx, conv, user, message, parentNodeID, answeringQuestion, generateUI, isSupplement, contextParentNodeID)
}

// chatStreamInit は初期化フェーズ（テーマ絞り込み）のストリーム処理
func (svc *ChatService) chatStreamInit(ctx context.Context, conv *model.Conversation, user *model.User, message string, isNewConversation bool) (<-chan StreamEvent, error) {
	dbMessages, err := repository.GetMessagesByConversationID(conv.ID)
	if err != nil {
		return nil, err
	}

	var contents []*genai.Content
	for _, m := range dbMessages {
		if m.Role == "system" {
			continue // systemメッセージはGeminiに渡さない
		}
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

	initSchema := &genai.Schema{
		Type: genai.TypeObject,
		Properties: map[string]*genai.Schema{
			"reply": {
				Type:        genai.TypeString,
				Description: "対話的な返答",
			},
			"theme_decided": {
				Type:        genai.TypeBoolean,
				Description: "テーマが十分に具体的になったらtrue",
			},
			"decided_theme": {
				Type:        genai.TypeString,
				Description: "最終テーマ（20字以内）。theme_decidedがfalseの場合は空文字。",
			},
		},
		Required: []string{"reply", "theme_decided", "decided_theme"},
	}

	config := &genai.GenerateContentConfig{
		SystemInstruction: genai.NewContentFromText(initSystemInstruction, "user"),
		ResponseMIMEType:  "application/json",
		ResponseSchema:    initSchema,
		SafetySettings: []*genai.SafetySetting{
			{Category: genai.HarmCategoryHarassment, Threshold: genai.HarmBlockThresholdBlockOnlyHigh},
			{Category: genai.HarmCategoryHateSpeech, Threshold: genai.HarmBlockThresholdBlockOnlyHigh},
			{Category: genai.HarmCategorySexuallyExplicit, Threshold: genai.HarmBlockThresholdBlockOnlyHigh},
			{Category: genai.HarmCategoryDangerousContent, Threshold: genai.HarmBlockThresholdBlockOnlyHigh},
		},
	}

	// DBに保存（user message）
	if _, err := repository.CreateMessage(conv.ID, "user", message, 0, "", ""); err != nil {
		return nil, err
	}

	ch := make(chan StreamEvent, 16)

	go func() {
		defer close(ch)

		var accumulated strings.Builder
		chunkCount := 0

		for resp, err := range svc.client.Models.GenerateContentStream(ctx, "gemini-3-flash-preview", contents, config) {
			if err != nil {
				log.Printf("Init stream error: %v", err)
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

		log.Printf("Init stream completed: %d chunks, %d bytes", chunkCount, accumulated.Len())

		fullText := accumulated.String()
		var parsed initReply
		if err := json.Unmarshal([]byte(fullText), &parsed); err != nil {
			log.Printf("Init response parse error: %v, raw: %s", err, fullText)
			parsed.Reply = fullText
		}

		// AI応答をDBに保存
		if _, err := repository.CreateMessage(conv.ID, "assistant", parsed.Reply, 0, "", ""); err != nil {
			log.Printf("failed to save init assistant message: %v", err)
			return
		}

		_ = repository.TouchConversation(conv.ID)

		if !parsed.ThemeDecided {
			// テーマ未決定: initフェーズ継続
			doneResp := &model.ChatResponse{
				ConversationID: conv.ID.String(),
				Reply:          parsed.Reply,
				Questions:      []model.QuestionNode{},
				Phase:          "init",
			}
			doneData, _ := json.Marshal(doneResp)
			ch <- StreamEvent{Type: "done", Data: string(doneData)}
			return
		}

		// テーマ決定: フェーズ遷移処理
		decidedTheme := parsed.DecidedTheme
		if decidedTheme == "" {
			decidedTheme = message
		}

		// フェーズとタイトルを更新
		if err := repository.UpdateConversationPhaseAndTitle(conv.ID, "teaching", decidedTheme); err != nil {
			log.Printf("failed to update conversation phase: %v", err)
		}

		// ルートツリーノードを作成（ユーザー発話ではないため role は system とする）
		rootMsgPlaceholder, err := repository.CreateMessage(conv.ID, "system", decidedTheme, 0, "", "")
		if err != nil {
			log.Printf("failed to create root message placeholder: %v", err)
			// エラーでもdoneは返す
			doneResp := &model.ChatResponse{
				ConversationID: conv.ID.String(),
				Reply:          parsed.Reply,
				Questions:      []model.QuestionNode{},
				Phase:          "teaching",
			}
			doneData, _ := json.Marshal(doneResp)
			ch <- StreamEvent{Type: "done", Data: string(doneData)}
			return
		}

		rootNode := &model.ConversationTreeNode{
			ID:             uuid.New(),
			ConversationID: conv.ID,
			MessageID:      rootMsgPlaceholder.ID,
			ParentNodeID:   nil,
			Text:           decidedTheme,
			Answer:         "",
		}
		if err := repository.CreateTreeNode(rootNode); err != nil {
			log.Printf("failed to create root tree node: %v", err)
		}

		// 2回目のAI呼び出し: 教育用プロンプトで初期質問を生成
		teachingContents := []*genai.Content{
			{
				Role:  "user",
				Parts: []*genai.Part{genai.NewPartFromText(fmt.Sprintf("[学習テーマ: %s]\n\nこのテーマについて教えてください！", decidedTheme))},
			},
		}

		teachingSchema := &genai.Schema{
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
							"type": {
								Type:        genai.TypeString,
								Description: "question: 通常の質問, visualize: ビジュアライズの提案",
								Enum:        []string{"question", "visualize"},
							},
						},
						Required: []string{"summary", "type"},
					},
				},
			},
			Required: []string{"reply", "answer_summary", "questions"},
		}

		teachingConfig := &genai.GenerateContentConfig{
			SystemInstruction: genai.NewContentFromText(systemInstruction, "user"),
			ResponseMIMEType:  "application/json",
			ResponseSchema:    teachingSchema,
			SafetySettings: []*genai.SafetySetting{
				{Category: genai.HarmCategoryHarassment, Threshold: genai.HarmBlockThresholdBlockOnlyHigh},
				{Category: genai.HarmCategoryHateSpeech, Threshold: genai.HarmBlockThresholdBlockOnlyHigh},
				{Category: genai.HarmCategorySexuallyExplicit, Threshold: genai.HarmBlockThresholdBlockOnlyHigh},
				{Category: genai.HarmCategoryDangerousContent, Threshold: genai.HarmBlockThresholdBlockOnlyHigh},
			},
		}

		teachingResp, err := svc.client.Models.GenerateContent(ctx, "gemini-3-flash-preview", teachingContents, teachingConfig)
		if err != nil {
			log.Printf("Teaching initial question generation error: %v", err)
			// エラーでもフェーズ遷移済みのdoneを返す
			doneResp := &model.ChatResponse{
				ConversationID: conv.ID.String(),
				Reply:          parsed.Reply,
				Questions:      []model.QuestionNode{},
				Phase:          "teaching",
			}
			doneData, _ := json.Marshal(doneResp)
			ch <- StreamEvent{Type: "done", Data: string(doneData)}
			return
		}

		var teachingParsed geminiReply
		if err := json.Unmarshal([]byte(teachingResp.Text()), &teachingParsed); err != nil {
			log.Printf("Teaching response parse error: %v", err)
		}

		// 教育AIの応答をDBに保存
		aiMsg, err := repository.CreateMessage(conv.ID, "assistant", teachingParsed.Reply, 0, "", "")
		if err != nil {
			log.Printf("failed to save teaching assistant message: %v", err)
			doneResp := &model.ChatResponse{
				ConversationID: conv.ID.String(),
				Reply:          parsed.Reply,
				Questions:      []model.QuestionNode{},
				Phase:          "teaching",
			}
			doneData, _ := json.Marshal(doneResp)
			ch <- StreamEvent{Type: "done", Data: string(doneData)}
			return
		}

		// 生成された質問をルートノードの子ノードとして保存
		newNodes := make([]model.QuestionNode, 0, len(teachingParsed.Questions))
		for _, q := range teachingParsed.Questions {
			pID := rootNode.ID
			nodeType := q.Type
			if nodeType == "" {
				nodeType = "question"
			}
			node := &model.ConversationTreeNode{
				ID:             uuid.New(),
				ConversationID: conv.ID,
				MessageID:      aiMsg.ID,
				ParentNodeID:   &pID,
				Text:           q.Summary,
				NodeType:       nodeType,
				Answer:         "",
			}
			if err := repository.CreateTreeNode(node); err != nil {
				log.Printf("failed to create initial question node: %v", err)
				continue
			}
			newNodes = append(newNodes, model.QuestionNode{
				ID:      node.ID.String(),
				Summary: node.Text,
				Type:    nodeType,
			})
		}

		// parsed.Reply（init AI応答）とteachingParsed.Reply（教育AI初回応答）を結合して返す
		combinedReply := parsed.Reply
		if teachingParsed.Reply != "" {
			combinedReply += "\n\n" + teachingParsed.Reply
		}
		doneResp := &model.ChatResponse{
			ConversationID: conv.ID.String(),
			Reply:          combinedReply,
			AnswerSummary:  "",
			Questions:      newNodes,
			Phase:          "teaching",
			Title:          decidedTheme,
		}
		doneData, _ := json.Marshal(doneResp)
		ch <- StreamEvent{Type: "done", Data: string(doneData)}
	}()

	return ch, nil
}

// chatStreamTeaching は教育フェーズのストリーム処理（既存ロジック）
func (svc *ChatService) chatStreamTeaching(ctx context.Context, conv *model.Conversation, user *model.User, message, parentNodeID, answeringQuestion string, generateUI, isSupplement bool, contextParentNodeID string) (<-chan StreamEvent, error) {
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
	// 最後のartifactコードを常に含める（AI自律生成のため）
	lastArtifactIndex := -1
	for i, m := range dbMessages {
		if m.Role == "assistant" && m.ArtifactCode != "" {
			lastArtifactIndex = i
		}
	}

	var contents []*genai.Content
	for i, m := range dbMessages {
		if m.Role == "system" {
			continue // systemメッセージはGeminiに渡さない
		}
		role := m.Role
		if role == "assistant" {
			role = "model"
		}
		text := m.Content
		// 最後のartifactを持つメッセージにコードを付加
		if i == lastArtifactIndex && m.ArtifactCode != "" {
			text += fmt.Sprintf("\n\n[前回生成したartifact: %s]\n%s", m.ArtifactTitle, m.ArtifactCode)
		}
		contents = append(contents, &genai.Content{
			Role:  role,
			Parts: []*genai.Part{genai.NewPartFromText(text)},
		})
	}

	// どの質問に回答しているかをメッセージに付加
	userMessage := message
	if isSupplement {
		// 補足モード: コンテキスト親ノードの情報を付加
		if contextParentNodeID != "" {
			cpID, err := uuid.Parse(contextParentNodeID)
			if err == nil {
				contextNode, err := repository.GetTreeNodeByID(cpID)
				if err == nil {
					if contextNode.ConversationID != conv.ID {
						log.Printf("invalid context_parent_node_id: node %s does not belong to conversation %s", contextParentNodeID, conv.ID)
						// 不正なノードは無視して通常の補足として扱う
						userMessage = fmt.Sprintf("[補足説明です]\n\n%s", message)
					} else {
						userMessage = fmt.Sprintf("[補足説明です。現在の話題: %s]\n\n%s", contextNode.Text, message)
					}
				}
			}
		} else {
			userMessage = fmt.Sprintf("[補足説明です]\n\n%s", message)
		}
	} else if answeringQuestion != "" {
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
	schemaProps["suggest_end"] = &genai.Schema{
		Type:        genai.TypeBoolean,
		Description: "テーマについて十分に学習が完了したと感じたらtrue。まだ掘り下げるべき内容があればfalse。",
	}
	requiredFields := []string{"reply", "answer_summary", "questions", "suggest_end"}

	// artifactスキーマを常にオプショナルで含める（AI自律判断 or ユーザーリクエスト時に生成）
	schemaProps["artifact"] = &genai.Schema{
		Type:        genai.TypeObject,
		Description: "会話内容をビジュアルで表現すると理解が深まる場合に生成する。テキストだけで十分な場合は省略してよい。",
		Properties: map[string]*genai.Schema{
			"title": {Type: genai.TypeString, Description: "タイトル（20字以内）"},
			"code":  {Type: genai.TypeString, Description: "React JSXコンポーネント。export default function App() の形式。"},
		},
		Required: []string{"title", "code"},
	}
	// visualizeカード押下時は必須
	if generateUI {
		requiredFields = append(requiredFields, "artifact")
	}

	responseSchema := &genai.Schema{
		Type:       genai.TypeObject,
		Properties: schemaProps,
		Required:   requiredFields,
	}

	// artifact生成指示を常に含める + visualizeカード押下時は強制指示を追加
	sysPrompt := systemInstruction + artifactInstruction
	if generateUI {
		sysPrompt += artifactForceInstruction
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

		for resp, err := range svc.client.Models.GenerateContentStream(ctx, "gemini-3-flash-preview", contents, config) {
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

		if parentNodeID != "" {
			// 親ノードの answer を更新
			pID, err := uuid.Parse(parentNodeID)
			if err == nil {
				if err := repository.UpdateTreeNodeAnswer(pID, conv.ID, parsed.AnswerSummary, userMsg.ID); err != nil {
					log.Printf("failed to update tree node answer (nodeID=%s): %v", pID, err)
				}
			}
		}

		// 補足モード: free_inputノードを作成し、その子として新しい質問を生成
		// ユーザーが明示的にノードを選んでいるので、常にそのノードの子にする
		if isSupplement && contextParentNodeID != "" {
			var freeInputParentID *uuid.UUID
			cpID, err := uuid.Parse(contextParentNodeID)
			if err == nil {
				freeInputParentID = &cpID
			}

			freeInputAnswer := parsed.AnswerSummary
			if freeInputAnswer == "" {
				// AIが要約を返さなかった場合、メッセージの先頭を使用
				freeInputAnswer = message
				if len([]rune(freeInputAnswer)) > 30 {
					freeInputAnswer = string([]rune(freeInputAnswer)[:30]) + "…"
				}
			}
			freeInputNode := &model.ConversationTreeNode{
				ID:             uuid.New(),
				ConversationID: conv.ID,
				MessageID:      userMsg.ID,
				ParentNodeID:   freeInputParentID,
				Text:           "自由回答",
				NodeType:       "free_input",
				Answer:         freeInputAnswer,
				AnswerMessageID: func() *int64 { v := userMsg.ID; return &v }(),
			}
			if err := repository.CreateTreeNode(freeInputNode); err != nil {
				log.Printf("failed to create free_input tree node: %v", err)
			} else {
				// 新しい質問はこのfree_inputノードの子にする
				activeParentNodeID = freeInputNode.ID.String()
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
			Phase:          "teaching",
			SuggestEnd:     parsed.SuggestEnd,
		}
		doneData, _ := json.Marshal(doneResp)
		ch <- StreamEvent{Type: "done", Data: string(doneData)}
	}()

	return ch, nil
}

func (svc *ChatService) DeleteConversation(userID, conversationID uuid.UUID) error {
	if _, err := repository.GetConversationByIDAndUserID(conversationID, userID); err != nil {
		return fmt.Errorf("conversation not found")
	}
	return repository.DeleteConversation(conversationID)
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
		if m.Role == "system" {
			// ルートノード用プレースホルダー → 学習開始アナウンスとして変換
			messages = append(messages, model.HistoryMessage{
				Role:    "system",
				Content: fmt.Sprintf("📚 テーマ: %s\n学習を開始します！", m.Content),
			})
			continue
		}
		hm := model.HistoryMessage{Role: m.Role, Content: m.Content}
		if m.ArtifactCode != "" {
			hm.Artifact = &model.Artifact{Title: m.ArtifactTitle, Code: m.ArtifactCode}
		}
		messages = append(messages, hm)
	}
	// Phaseを決定: 空/initでもツリーノードがあればteaching
	histPhase := conv.Phase
	if histPhase == "" || histPhase == "init" {
		nodes, _ := repository.GetTreeNodesByConversationID(conv.ID)
		if len(nodes) > 0 {
			histPhase = "teaching"
		} else if histPhase == "" {
			histPhase = "init"
		}
	}

	return &model.HistoryResponse{Messages: messages, Phase: histPhase}, nil
}

func (svc *ChatService) GenerateReview(ctx context.Context, user *model.User, conversationIDStr string) (<-chan StreamEvent, error) {
	convID, err := uuid.Parse(conversationIDStr)
	if err != nil {
		return nil, fmt.Errorf("invalid conversation_id")
	}

	conv, err := repository.GetConversationByIDAndUserID(convID, user.ID)
	if err != nil {
		return nil, fmt.Errorf("conversation not found")
	}

	if conv.Phase != "teaching" {
		return nil, fmt.Errorf("conversation is not in teaching phase")
	}

	// 冪等性: 既存レビューがあればそのまま返却
	existingReview, err := repository.GetReviewByConversationID(convID)
	if err == nil && existingReview != nil {
		ch := make(chan StreamEvent, 1)
		go func() {
			defer close(ch)
			resp := svc.buildReviewResponse(existingReview, convID)
			doneData, _ := json.Marshal(resp)
			ch <- StreamEvent{Type: "done", Data: string(doneData)}
		}()
		return ch, nil
	}

	// 全メッセージ取得
	dbMessages, err := repository.GetMessagesByConversationID(convID)
	if err != nil {
		return nil, err
	}

	// ツリーノード取得
	treeNodes, err := repository.GetTreeNodesByConversationID(convID)
	if err != nil {
		return nil, err
	}

	// コンテキスト組み立て
	var contextBuilder strings.Builder
	contextBuilder.WriteString(fmt.Sprintf("【学習テーマ】%s\n\n", conv.Title))

	contextBuilder.WriteString("【会話履歴】\n")
	for _, m := range dbMessages {
		if m.Role == "system" {
			continue
		}
		role := "先生（ユーザー）"
		if m.Role == "assistant" {
			role = "生徒（AI）"
		}
		fmt.Fprintf(&contextBuilder, "%s: %s\n", role, m.Content)
		if m.ArtifactTitle != "" {
			fmt.Fprintf(&contextBuilder, "[ビジュアライズ生成: %s]\n", m.ArtifactTitle)
		}
		contextBuilder.WriteString("\n")
	}

	contextBuilder.WriteString("【トピック構造（マインドマップ）】\n")
	for _, n := range treeNodes {
		status := "未回答"
		if n.Answer != "" {
			status = n.Answer
		}
		contextBuilder.WriteString(fmt.Sprintf("- %s [%s]: %s\n", n.Text, n.NodeType, status))
	}

	var contents []*genai.Content
	contents = append(contents, &genai.Content{
		Role:  "user",
		Parts: []*genai.Part{genai.NewPartFromText(contextBuilder.String())},
	})

	reviewSchema := &genai.Schema{
		Type: genai.TypeObject,
		Properties: map[string]*genai.Schema{
			"overall_score": {
				Type:        genai.TypeInteger,
				Description: "総合スコア（0-100）",
			},
			"summary": {
				Type:        genai.TypeString,
				Description: "全体的な評価サマリー（2-3文）",
			},
			"strengths": {
				Type:        genai.TypeArray,
				Items:       &genai.Schema{Type: genai.TypeString},
				Description: "ユーザーの強み（1-5個）",
			},
			"weaknesses": {
				Type:        genai.TypeArray,
				Items:       &genai.Schema{Type: genai.TypeString},
				Description: "改善が必要な点（1-5個）",
			},
			"advice": {
				Type:        genai.TypeString,
				Description: "今後の学習に向けた具体的なアドバイス",
			},
			"topic_evaluations": {
				Type: genai.TypeArray,
				Items: &genai.Schema{
					Type: genai.TypeObject,
					Properties: map[string]*genai.Schema{
						"topic": {
							Type:        genai.TypeString,
							Description: "トピック名",
						},
						"score": {
							Type:        genai.TypeInteger,
							Description: "トピック別スコア（0-100）",
						},
						"correctness": {
							Type:        genai.TypeString,
							Description: "正確性の評価",
							Enum:        []string{"correct", "partially_correct", "incorrect"},
						},
						"clarity": {
							Type:        genai.TypeString,
							Description: "明確さの評価",
							Enum:        []string{"clear", "vague", "unclear"},
						},
						"comment": {
							Type:        genai.TypeString,
							Description: "トピックに対するコメント",
						},
					},
					Required: []string{"topic", "score", "correctness", "clarity", "comment"},
				},
				Description: "トピック別評価",
			},
		},
		Required: []string{"overall_score", "summary", "strengths", "weaknesses", "advice", "topic_evaluations"},
	}

	config := &genai.GenerateContentConfig{
		SystemInstruction: genai.NewContentFromText(reviewSystemInstruction, "user"),
		ResponseMIMEType:  "application/json",
		ResponseSchema:    reviewSchema,
		SafetySettings: []*genai.SafetySetting{
			{Category: genai.HarmCategoryHarassment, Threshold: genai.HarmBlockThresholdBlockOnlyHigh},
			{Category: genai.HarmCategoryHateSpeech, Threshold: genai.HarmBlockThresholdBlockOnlyHigh},
			{Category: genai.HarmCategorySexuallyExplicit, Threshold: genai.HarmBlockThresholdBlockOnlyHigh},
			{Category: genai.HarmCategoryDangerousContent, Threshold: genai.HarmBlockThresholdBlockOnlyHigh},
		},
	}

	ch := make(chan StreamEvent, 16)

	go func() {
		defer close(ch)

		var accumulated strings.Builder
		chunkCount := 0

		for resp, err := range svc.client.Models.GenerateContentStream(ctx, "gemini-2.5-flash", contents, config) {
			if err != nil {
				log.Printf("Review stream error: %v", err)
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

		log.Printf("Review stream completed: %d chunks, %d bytes", chunkCount, accumulated.Len())

		fullText := accumulated.String()
		var parsed reviewReply
		if err := json.Unmarshal([]byte(fullText), &parsed); err != nil {
			log.Printf("Review response parse error: %v, raw: %s", err, fullText)
			errJSON, _ := json.Marshal(map[string]string{"error": "failed to parse review response"})
			ch <- StreamEvent{Type: "error", Data: string(errJSON)}
			return
		}

		// DB保存
		strengthsJSON, _ := json.Marshal(parsed.Strengths)
		weaknessesJSON, _ := json.Marshal(parsed.Weaknesses)
		topicEvalsJSON, _ := json.Marshal(parsed.TopicEvaluations)

		review := &model.Review{
			ConversationID:   convID,
			OverallScore:     parsed.OverallScore,
			Summary:          parsed.Summary,
			Strengths:        string(strengthsJSON),
			Weaknesses:       string(weaknessesJSON),
			Advice:           parsed.Advice,
			TopicEvaluations: string(topicEvalsJSON),
		}
		if err := repository.CreateReview(review); err != nil {
			log.Printf("failed to save review: %v", err)
		}

		// フェーズを"review"に更新
		if err := repository.UpdateConversationPhase(convID, "review"); err != nil {
			log.Printf("failed to update conversation phase to review: %v", err)
		}

		resp := svc.buildReviewResponse(review, convID)
		doneData, _ := json.Marshal(resp)
		ch <- StreamEvent{Type: "done", Data: string(doneData)}
	}()

	return ch, nil
}

func (svc *ChatService) buildReviewResponse(review *model.Review, convID uuid.UUID) *model.ReviewResponse {
	var strengths []string
	_ = json.Unmarshal([]byte(review.Strengths), &strengths)
	var weaknesses []string
	_ = json.Unmarshal([]byte(review.Weaknesses), &weaknesses)
	var topicEvals []model.TopicEvaluation
	_ = json.Unmarshal([]byte(review.TopicEvaluations), &topicEvals)

	return &model.ReviewResponse{
		ConversationID:   convID.String(),
		OverallScore:     review.OverallScore,
		Summary:          review.Summary,
		Strengths:        strengths,
		Weaknesses:       weaknesses,
		Advice:           review.Advice,
		TopicEvaluations: topicEvals,
		Phase:            "review",
	}
}

func (svc *ChatService) GetReview(userID uuid.UUID, conversationIDStr string) (*model.ReviewResponse, error) {
	convID, err := uuid.Parse(conversationIDStr)
	if err != nil {
		return nil, fmt.Errorf("invalid conversation_id")
	}

	if _, err := repository.GetConversationByIDAndUserID(convID, userID); err != nil {
		return nil, fmt.Errorf("conversation not found")
	}

	review, err := repository.GetReviewByConversationID(convID)
	if err != nil {
		return nil, fmt.Errorf("review not found")
	}

	return svc.buildReviewResponse(review, convID), nil
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
		// Phaseを決定: 空の場合はteachingとして扱う（既存データ互換）
		sessionPhase := c.Phase
		if sessionPhase == "" {
			sessionPhase = "teaching"
		}
		sessions = append(sessions, model.SessionMeta{
			ConversationID: c.ID.String(),
			Title:          c.Title,
			LastMessage:    lastMessage,
			UpdatedAt:      c.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
			Phase:          sessionPhase,
		})
	}
	return &model.SessionsResponse{Sessions: sessions}, nil
}
