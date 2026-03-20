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
  phase: "init" | "teaching";
}

export interface TreeNode {
  id: string;
  parentId: string; // '' = ルート
  text: string;
  answer: string; // '' = 未回答
  type: "question" | "visualize";
}
