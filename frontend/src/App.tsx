import { useState, useCallback } from 'react'
import { nanoid } from 'nanoid'
import type { ChatSession } from './types'

import { Sidebar } from './components/Sidebar'
import { Header } from './components/Header'
import { ChatArea } from './components/ChatArea'
import { PromptInput } from './components/PromptInput'
import chatHistoryData from './data/chatHistory.json'

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sessions, setSessions] = useState<ChatSession[]>(chatHistoryData as ChatSession[])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(sessions[0]?.id ?? null)
  const [isStreaming, setIsStreaming] = useState(false)

  const activeSession = sessions.find(s => s.id === activeSessionId) ?? null

  const handleNewChat = useCallback(() => {
    const session: ChatSession = {
      id: `chat-${nanoid()}`,
      title: '新しいチャット',
      lastMessage: '',
      timestamp: new Date().toISOString(),
      messages: [],
    }
    setSessions(prev => [session, ...prev])
    setActiveSessionId(session.id)
    setSidebarOpen(false)
  }, [])

  const handleSelectSession = useCallback((id: string) => {
    setActiveSessionId(id)
    setSidebarOpen(false)
  }, [])

  const streamResponse = useCallback(async (sessionId: string, response: string) => {
    const msgId = nanoid()
    setSessions(prev => prev.map(s =>
      s.id === sessionId
        ? { ...s, messages: [...s.messages, { id: msgId, role: 'assistant' as const, content: '' }] }
        : s
    ))

    const words = response.split(' ')
    for (let i = 0; i < words.length; i++) {
      const partial = words.slice(0, i + 1).join(' ')
      setSessions(prev => prev.map(s =>
        s.id === sessionId
          ? {
              ...s,
              messages: s.messages.map(m => m.id === msgId ? { ...m, content: partial } : m),
              lastMessage: partial.slice(0, 60) + (partial.length > 60 ? '...' : ''),
            }
          : s
      ))
      await new Promise(r => setTimeout(r, 30 + Math.random() * 40))
    }

    setIsStreaming(false)
  }, [])

  const handleSubmit = useCallback(async (text: string) => {
    if (isStreaming) return
    setIsStreaming(true)

    let sessionId = activeSessionId
    if (!sessionId) {
      const session: ChatSession = {
        id: `chat-${nanoid()}`,
        title: text.slice(0, 30),
        lastMessage: text,
        timestamp: new Date().toISOString(),
        messages: [],
      }
      setSessions(prev => [session, ...prev])
      setActiveSessionId(session.id)
      sessionId = session.id
    }

    setSessions(prev => prev.map(s =>
      s.id === sessionId
        ? {
            ...s,
            title: s.messages.length === 0 ? text.slice(0, 30) : s.title,
            lastMessage: text,
            timestamp: new Date().toISOString(),
            messages: [...s.messages, { id: nanoid(), role: 'user' as const, content: text }],
          }
        : s
    ))

    await new Promise(r => setTimeout(r, 400))
    
    // バックエンドAPIを呼び出す
    try {
      const apiBase = import.meta.env.VITE_API_BASE_URL ?? ''
      const resp = await fetch(`${apiBase}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      })
      if (!resp.ok) {
        throw new Error(`API error: ${resp.status}`)
      }
      const data = await resp.json()
      streamResponse(sessionId, data.reply)
    } catch (err) {
      console.error('Failed to fetch from backend:', err)
      // エラー時は MOCK_RESPONSES へのフォールバック、またはエラーメッセージ表示
      const fallbackResponse = "申し訳ありません。バックエンドへの接続に失敗しました。ローカルでGoサーバーが起動しているか確認してください。"
      streamResponse(sessionId, fallbackResponse)
    }
  }, [isStreaming, activeSessionId, streamResponse])

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <Sidebar
        open={sidebarOpen}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onClose={() => setSidebarOpen(false)}
        onNewChat={handleNewChat}
        onSelectSession={handleSelectSession}
      />

      <div className="flex flex-col flex-1 min-w-0">
        <Header
          title={activeSession?.title ?? null}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <ChatArea
          session={activeSession}
          isStreaming={isStreaming}
          onSuggestionClick={handleSubmit}
        />
        <PromptInput
          isStreaming={isStreaming}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  )
}
