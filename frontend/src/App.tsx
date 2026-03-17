import { useState, useCallback, useEffect } from 'react'
import { nanoid } from 'nanoid'
import type { ChatSession } from './types'

import { Sidebar } from './components/Sidebar'
import { Header } from './components/Header'
import { ChatArea } from './components/ChatArea'
import { PromptInput } from './components/PromptInput'
import { useAuth } from './contexts/AuthContext'

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const { user, loading } = useAuth()

  const activeSession = sessions.find(s => s.id === activeSessionId) ?? null

  useEffect(() => {
    if (!user) {
      setSessions([])
      setActiveSessionId(null)
      return
    }
    const fetchSessions = async () => {
      try {
        const token = await user.getIdToken()
        const rawApiBase = import.meta.env.VITE_API_BASE_URL ?? ''
        const apiBase = rawApiBase.replace(/\/+$/, '')
        const resp = await fetch(
          `${apiBase}/api/sessions?user_id=${encodeURIComponent(user.uid)}`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        )
        if (!resp.ok) return
        const data = await resp.json()
        const fetched: ChatSession[] = data.sessions.map((s: { conversation_id: string; title: string; last_message: string; updated_at?: string }) => ({
          id: s.conversation_id,
          title: s.title,
          lastMessage: s.last_message,
          timestamp: s.updated_at || new Date().toISOString(),
          messages: [],
        }))
        setSessions(fetched)
        if (fetched.length > 0) {
          const firstId = fetched[0].id
          setActiveSessionId(firstId)
          // 最初のセッションの履歴を取得
          const histResp = await fetch(
            `${apiBase}/api/history?user_id=${encodeURIComponent(user.uid)}&conversation_id=${encodeURIComponent(firstId)}`,
            { headers: { 'Authorization': `Bearer ${token}` } }
          )
          if (histResp.ok) {
            const histData = await histResp.json()
            setSessions(prev => prev.map(s =>
              s.id === firstId
                ? { ...s, messages: histData.messages.map((m: { role: string; content: string }) => ({ id: nanoid(), role: m.role as 'user' | 'assistant', content: m.content })) }
                : s
            ))
          }
        }
      } catch (err) {
        console.error('Failed to fetch sessions:', err)
      }
    }
    fetchSessions()
  }, [user])

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

  const fetchHistory = useCallback(async (sessionId: string) => {
    if (!user) return
    try {
      const token = await user.getIdToken()
      const rawApiBase = import.meta.env.VITE_API_BASE_URL ?? ''
      const apiBase = rawApiBase.replace(/\/+$/, '')
      const resp = await fetch(
        `${apiBase}/api/history?user_id=${encodeURIComponent(user.uid)}&conversation_id=${encodeURIComponent(sessionId)}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      )
      if (!resp.ok) return
      const data = await resp.json()
      setSessions(prev => prev.map(s =>
        s.id === sessionId
          ? { ...s, messages: data.messages.map((m: { role: string; content: string }) => ({ id: nanoid(), role: m.role as 'user' | 'assistant', content: m.content })) }
          : s
      ))
    } catch (err) {
      console.error('Failed to fetch history:', err)
    }
  }, [user])

  const handleSelectSession = useCallback(async (id: string) => {
    setActiveSessionId(id)
    setSidebarOpen(false)
    await fetchHistory(id)
  }, [fetchHistory])

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

    // await new Promise(r => setTimeout(r, 400)) // 人工的な遅延を削除
    
    // バックエンドAPIを呼び出す
    try {
      const token = user ? await user.getIdToken() : null
      if (!token || !user) {
        setIsStreaming(false)
        return
      }
      const rawApiBase = import.meta.env.VITE_API_BASE_URL ?? ''
      const apiBase = rawApiBase.replace(/\/+$/, '')
      const resp = await fetch(`${apiBase}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ user_id: user.uid, conversation_id: sessionId, message: text })
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
  }, [isStreaming, activeSessionId, streamResponse, user])

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
          onSuggestionClick={user ? handleSubmit : undefined}
        />
        {loading ? (
          <div className="p-6 border-t border-gray-100 bg-gray-50 text-center">
            <span className="inline-block w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin mr-2"></span>
            <span className="text-gray-500 text-sm">読み込み中...</span>
          </div>
        ) : user ? (
          <PromptInput
            isStreaming={isStreaming}
            onSubmit={handleSubmit}
          />
        ) : (
          <div className="p-6 border-t border-gray-100 bg-gray-50 text-center">
            <p className="text-gray-500 text-sm mb-2">チャットを開始するにはログインが必要です</p>
          </div>
        )}
      </div>
    </div>
  )
}
