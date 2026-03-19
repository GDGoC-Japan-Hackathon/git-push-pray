export interface Artifact {
  title: string
  code: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  artifact?: Artifact
}

export interface ChatSession {
  id: string
  title: string
  lastMessage: string
  timestamp: string
  messages: ChatMessage[]
}

export interface TreeNode {
  id: string
  parentId: string // '' = ルート
  text: string
  answer: string   // '' = 未回答
}
