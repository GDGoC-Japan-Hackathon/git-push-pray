export interface Artifact {
  title: string;
  code: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  artifact?: Artifact;
  isStreaming?: boolean; // ストリーミング中
  streamingCode?: string; // 生成中のartifactコード
}

export interface ChatSession {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: string;
  messages: ChatMessage[];
  phase: "init" | "teaching" | "review";
}

export interface TopicEvaluation {
  topic: string;
  score: number;
  correctness: "correct" | "partially_correct" | "incorrect";
  clarity: "clear" | "vague" | "unclear";
  comment: string;
}

export interface ReviewResult {
  conversation_id: string;
  overall_score: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  advice: string;
  topic_evaluations: TopicEvaluation[];
  phase: string;
}

export interface TreeNode {
  id: string;
  parentId: string; // '' = ルート
  text: string;
  answer: string; // '' = 未回答
  type: "question" | "visualize" | "free_input";
}
