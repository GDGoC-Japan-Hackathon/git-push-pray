import React, { useState, useEffect, useRef, useCallback } from 'react'
import { MenuIcon, XIcon, SendIcon, PlusIcon, MessageSquareIcon, BotIcon, UserIcon } from 'lucide-react'
import { nanoid } from 'nanoid'
import chatHistoryData from './data/chatHistory.json'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface ChatSession {
  id: string
  title: string
  lastMessage: string
  timestamp: string
  messages: ChatMessage[]
}

const MOCK_RESPONSES = [
  "それは興味深い質問ですね！詳しく説明しましょう。この分野では様々なアプローチがありますが、まず基本的な概念から始めると理解しやすいと思います。",
  "ご質問ありがとうございます。このトピックについては複数の視点から考える必要があります。実装する際は、パフォーマンスとメンテナビリティのバランスを取ることが重要です。",
  "良い質問です！この問題を解決するためのベストプラクティスをいくつか紹介します：\n\n1. **まず要件を明確にする** - 何を達成したいのかを定義\n2. **シンプルなアプローチから始める** - 過度な最適化を避ける\n3. **テストを書く** - 期待通りの動作を確認\n4. **継続的にリファクタリング** - コードの品質を維持",
  "この課題は多くの開発者が直面するものです。推奨するアプローチは、まず問題を小さな部分に分解し、それぞれを個別に解決していくことです。具体的なコード例が必要でしたら、お知らせください。",
  "素晴らしい視点です！技術選択においては、チームの習熟度、プロジェクトの規模、長期的なメンテナンスコストなどを考慮することをお勧めします。",
]

function formatTimestamp(ts: string) {
  const date = new Date(ts)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return '今日'
  if (days === 1) return '昨日'
  if (days < 7) return `${days}日前`
  return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
}

function renderMarkdown(text: string) {
  // Very simple markdown renderer
  const lines = text.split('\n')
  const result: React.ReactElement[] = []
  let inCodeBlock = false
  let codeLines: string[] = []
  let keyCounter = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.startsWith('```')) {
      if (inCodeBlock) {
        result.push(
          <pre key={keyCounter++} className="bg-gray-100 rounded-md p-3 overflow-x-auto my-2 text-sm font-mono">
            <code>{codeLines.join('\n')}</code>
          </pre>
        )
        codeLines = []
        inCodeBlock = false
      } else {
        inCodeBlock = true
      }
      continue
    }

    if (inCodeBlock) {
      codeLines.push(line)
      continue
    }

    if (line.startsWith('### ')) {
      result.push(<h3 key={keyCounter++} className="font-semibold text-base mt-3 mb-1">{parseLine(line.slice(4))}</h3>)
    } else if (line.startsWith('## ')) {
      result.push(<h2 key={keyCounter++} className="font-semibold text-lg mt-4 mb-1">{parseLine(line.slice(3))}</h2>)
    } else if (line.startsWith('# ')) {
      result.push(<h1 key={keyCounter++} className="font-bold text-xl mt-4 mb-2">{parseLine(line.slice(2))}</h1>)
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      result.push(<li key={keyCounter++} className="ml-4 list-disc">{parseLine(line.slice(2))}</li>)
    } else if (/^\d+\. /.test(line)) {
      const content = line.replace(/^\d+\. /, '')
      result.push(<li key={keyCounter++} className="ml-4 list-decimal">{parseLine(content)}</li>)
    } else if (line === '') {
      result.push(<div key={keyCounter++} className="h-2" />)
    } else {
      result.push(<p key={keyCounter++} className="leading-relaxed">{parseLine(line)}</p>)
    }
  }

  return result
}

function parseLine(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_)/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    const m = match[0]
    if (m.startsWith('`')) {
      parts.push(<code key={key++} className="bg-gray-100 rounded px-1 py-0.5 text-sm font-mono">{m.slice(1, -1)}</code>)
    } else if (m.startsWith('**') || m.startsWith('__')) {
      parts.push(<strong key={key++}>{m.slice(2, -2)}</strong>)
    } else {
      parts.push(<em key={key++}>{m.slice(1, -1)}</em>)
    }
    lastIndex = match.index + m.length
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }
  return parts
}

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sessions, setSessions] = useState<ChatSession[]>(chatHistoryData as ChatSession[])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(sessions[0]?.id ?? null)
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const activeSession = sessions.find(s => s.id === activeSessionId) ?? null

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeSession?.messages])

  const handleNewChat = useCallback(() => {
    const newSession: ChatSession = {
      id: `chat-${nanoid()}`,
      title: '新しいチャット',
      lastMessage: '',
      timestamp: new Date().toISOString(),
      messages: [],
    }
    setSessions(prev => [newSession, ...prev])
    setActiveSessionId(newSession.id)
    setSidebarOpen(false)
  }, [])

  const handleSelectSession = useCallback((id: string) => {
    setActiveSessionId(id)
    setSidebarOpen(false)
  }, [])

  const streamResponse = useCallback(async (sessionId: string, response: string) => {
    const assistantMsgId = nanoid()
    setSessions(prev => prev.map(s =>
      s.id === sessionId
        ? {
            ...s,
            messages: [...s.messages, { id: assistantMsgId, role: 'assistant' as const, content: '' }]
          }
        : s
    ))

    const words = response.split(' ')
    for (let i = 0; i < words.length; i++) {
      const partial = words.slice(0, i + 1).join(' ')
      setSessions(prev => prev.map(s =>
        s.id === sessionId
          ? {
              ...s,
              messages: s.messages.map(m =>
                m.id === assistantMsgId ? { ...m, content: partial } : m
              ),
              lastMessage: partial.slice(0, 60) + (partial.length > 60 ? '...' : ''),
            }
          : s
      ))
      await new Promise(r => setTimeout(r, 30 + Math.random() * 40))
    }

    setIsStreaming(false)
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!input.trim() || isStreaming) return

    const text = input.trim()
    setInput('')
    setIsStreaming(true)

    let sessionId = activeSessionId
    if (!sessionId) {
      const newSession: ChatSession = {
        id: `chat-${nanoid()}`,
        title: text.slice(0, 30),
        lastMessage: text,
        timestamp: new Date().toISOString(),
        messages: [],
      }
      setSessions(prev => [newSession, ...prev])
      setActiveSessionId(newSession.id)
      sessionId = newSession.id
    }

    const userMsg: ChatMessage = { id: nanoid(), role: 'user', content: text }
    setSessions(prev => prev.map(s =>
      s.id === sessionId
        ? {
            ...s,
            title: s.messages.length === 0 ? text.slice(0, 30) : s.title,
            lastMessage: text,
            timestamp: new Date().toISOString(),
            messages: [...s.messages, userMsg],
          }
        : s
    ))

    await new Promise(r => setTimeout(r, 400))
    const response = MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)]
    streamResponse(sessionId, response)
  }, [input, isStreaming, activeSessionId, streamResponse])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      {/* Sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full w-72 bg-gray-50 border-r border-gray-200 z-30
          flex flex-col transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
          <span className="font-semibold text-gray-800 text-sm">チャット履歴</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1.5 rounded-md hover:bg-gray-200 text-gray-500 transition-colors"
          >
            <XIcon size={18} />
          </button>
        </div>

        <div className="px-3 py-3">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white border border-gray-200 text-sm text-gray-700 hover:bg-gray-100 transition-colors shadow-sm"
          >
            <PlusIcon size={16} />
            新しいチャット
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
          {sessions.map(session => (
            <button
              key={session.id}
              onClick={() => handleSelectSession(session.id)}
              className={`
                w-full text-left px-3 py-2.5 rounded-lg transition-colors
                ${activeSessionId === session.id
                  ? 'bg-blue-50 border border-blue-200 text-blue-900'
                  : 'hover:bg-gray-100 text-gray-700'
                }
              `}
            >
              <div className="flex items-start gap-2">
                <MessageSquareIcon size={15} className="mt-0.5 shrink-0 opacity-60" />
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{session.title}</div>
                  <div className="text-xs text-gray-400 mt-0.5 truncate">{session.lastMessage || '（メッセージなし）'}</div>
                </div>
              </div>
              <div className="text-xs text-gray-400 mt-1 pl-5">{formatTimestamp(session.timestamp)}</div>
            </button>
          ))}
        </div>
      </aside>

      {/* Main chat area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
            aria-label="メニューを開く"
          >
            <MenuIcon size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <BotIcon size={14} className="text-white" />
            </div>
            <span className="font-semibold text-gray-800 text-sm">AI アシスタント</span>
          </div>
          {activeSession && (
            <span className="text-sm text-gray-400 truncate ml-2">{activeSession.title}</span>
          )}
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
            {!activeSession || activeSession.messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[50vh] gap-4 text-center">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                  <BotIcon size={28} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-800 mb-1">何でも聞いてください</h2>
                  <p className="text-sm text-gray-400">AIアシスタントがお手伝いします</p>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2 w-full max-w-sm">
                  {['コードのレビューをお願いしたい', 'バグの原因を調べてほしい', 'アーキテクチャを相談したい', 'ドキュメントを書いてほしい'].map(suggestion => (
                    <button
                      key={suggestion}
                      onClick={() => setInput(suggestion)}
                      className="text-xs text-left px-3 py-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              activeSession.messages.map(message => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0 mt-0.5">
                      <BotIcon size={14} className="text-white" />
                    </div>
                  )}
                  <div
                    className={`
                      max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed
                      ${message.role === 'user'
                        ? 'bg-blue-600 text-white rounded-br-sm'
                        : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                      }
                    `}
                  >
                    {message.role === 'assistant'
                      ? <div className="space-y-1">{renderMarkdown(message.content)}</div>
                      : message.content
                    }
                  </div>
                  {message.role === 'user' && (
                    <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center shrink-0 mt-0.5">
                      <UserIcon size={14} className="text-gray-600" />
                    </div>
                  )}
                </div>
              ))
            )}
            {isStreaming && activeSession?.messages.at(-1)?.role !== 'assistant' && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0">
                  <BotIcon size={14} className="text-white" />
                </div>
                <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
                  <div className="flex gap-1 items-center h-5">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]" />
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]" />
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="shrink-0 border-t border-gray-200 bg-white px-4 py-4">
          <div className="max-w-3xl mx-auto">
            <div className="flex gap-2 items-end bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => {
                  setInput(e.target.value)
                  e.target.style.height = 'auto'
                  e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px'
                }}
                onKeyDown={handleKeyDown}
                placeholder="メッセージを入力... (Enterで送信、Shift+Enterで改行)"
                rows={1}
                className="flex-1 bg-transparent resize-none outline-none text-sm text-gray-800 placeholder-gray-400 max-h-[200px] leading-relaxed"
                style={{ height: '24px' }}
              />
              <button
                onClick={handleSubmit}
                disabled={!input.trim() || isStreaming}
                className={`
                  p-1.5 rounded-lg transition-all shrink-0
                  ${input.trim() && !isStreaming
                    ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }
                `}
              >
                <SendIcon size={16} />
              </button>
            </div>
            <p className="text-center text-xs text-gray-300 mt-2">AIは誤情報を生成することがあります。重要な情報は確認してください。</p>
          </div>
        </div>
      </div>
    </div>
  )
}
