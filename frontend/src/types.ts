export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
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
