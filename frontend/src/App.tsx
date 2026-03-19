import { useState, useCallback, useEffect } from 'react'
import { nanoid } from 'nanoid'
import type { ChatSession, TreeNode } from './types'

import { Sidebar } from './components/Sidebar'
import { Header, type ViewMode } from './components/Header'
import { ChatArea } from './components/ChatArea'
import { ConversationTreeView } from './components/ConversationTreeView'
import { PromptInput } from './components/PromptInput'
import { useAuth } from './contexts/AuthContext'

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('chat')
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [treeNodes, setTreeNodes] = useState<Record<string, TreeNode[]>>({})
  const [latestQuestions, setLatestQuestions] = useState<TreeNode[]>([])
  const { user, loading } = useAuth()

  const activeSession = sessions.find(s => s.id === activeSessionId) ?? null
  const activeTreeNodes = activeSessionId ? (treeNodes[activeSessionId] ?? []) : []
  const selectedNode = activeTreeNodes.find(n => n.id === selectedNodeId) ?? null

  const apiBase = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '')

  const fetchConversationTree = useCallback(async (sessionId: string): Promise<TreeNode[]> => {
    if (!user) return []
    try {
      const token = await user.getIdToken()
      const resp = await fetch(
        `${apiBase}/api/conversation-tree?conversation_id=${encodeURIComponent(sessionId)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      if (!resp.ok) return []
      const data = await resp.json()
      const nodes: TreeNode[] = (data.nodes ?? []).map((n: { id: string; parent_id: string; text: string; answer: string }) => ({
        id: n.id,
        parentId: n.parent_id,
        text: n.text,
        answer: n.answer,
      }))
      setTreeNodes(prev => ({ ...prev, [sessionId]: nodes }))
      return nodes
    } catch (err) {
      console.error('Failed to fetch conversation tree:', err)
      return []
    }
  }, [user, apiBase])

  useEffect(() => {
    if (!user) {
      setSessions([])
      setActiveSessionId(null)
      return
    }
    const fetchSessions = async () => {
      try {
        const token = await user.getIdToken()
        const resp = await fetch(
          `${apiBase}/api/sessions?user_id=${encodeURIComponent(user.uid)}`,
          { headers: { Authorization: `Bearer ${token}` } },
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
      } catch (err) {
        console.error('Failed to fetch sessions:', err)
      }
    }
    fetchSessions()
  }, [user, apiBase])

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
    setSelectedNodeId(null)
    setLatestQuestions([])
    setSidebarOpen(false)
  }, [])

  const fetchHistory = useCallback(async (sessionId: string) => {
    if (!user) return
    try {
      const token = await user.getIdToken()
      const resp = await fetch(
        `${apiBase}/api/history?user_id=${encodeURIComponent(user.uid)}&conversation_id=${encodeURIComponent(sessionId)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      if (!resp.ok) return
      const data = await resp.json()
      setSessions(prev => prev.map(s =>
        s.id === sessionId
          ? { ...s, messages: data.messages.map((m: { role: string; content: string }) => ({ id: nanoid(), role: m.role as 'user' | 'assistant', content: m.content })) }
          : s,
      ))
    } catch (err) {
      console.error('Failed to fetch history:', err)
    }
  }, [user, apiBase])

  const handleSelectSession = useCallback(async (id: string) => {
    setActiveSessionId(id)
    setSelectedNodeId(null)
    setLatestQuestions([])
    setSidebarOpen(false)
    await Promise.all([fetchHistory(id), fetchConversationTree(id)])
  }, [fetchHistory, fetchConversationTree])

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode)
    if (mode === 'tree' && activeSessionId) {
      fetchConversationTree(activeSessionId)
    }
  }, [activeSessionId, fetchConversationTree])

  const streamResponse = useCallback(async (sessionId: string, response: string) => {
    const msgId = nanoid()
    setSessions(prev => prev.map(s =>
      s.id === sessionId
        ? { ...s, messages: [...s.messages, { id: msgId, role: 'assistant' as const, content: '' }] }
        : s,
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
          : s,
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
        : s,
    ))

    try {
      const token = user ? await user.getIdToken() : null
      if (!token || !user) {
        setIsStreaming(false)
        return
      }

      const body: Record<string, string> = {
        user_id: user.uid,
        conversation_id: sessionId,
        message: text,
      }
      if (selectedNodeId) body.parent_node_id = selectedNodeId
      if (selectedNode) body.answering_question = selectedNode.text

      const resp = await fetch(`${apiBase}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      if (!resp.ok) throw new Error(`API error: ${resp.status}`)

      const data = await resp.json()
      const actualId = data.conversation_id || sessionId
      if (actualId !== sessionId) {
        setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, id: actualId } : s))
        setActiveSessionId(actualId)
      }

      // 会話ツリーをサーバーから再取得し、APIレスポンスのquestionノードIDで絞り込む
      const questionIds = new Set<string>((data.questions ?? []).map((q: { id: string }) => q.id))
      const updatedNodes = await fetchConversationTree(actualId)
      const newQuestions = updatedNodes.filter(n => questionIds.has(n.id))
      setLatestQuestions(newQuestions)

      // 選択状態をリセット
      setSelectedNodeId(null)

      streamResponse(actualId, data.reply)
    } catch (err) {
      console.error('Failed to fetch from backend:', err)
      const fallbackResponse = '申し訳ありません。バックエンドへの接続に失敗しました。ローカルでGoサーバーが起動しているか確認してください。'
      streamResponse(sessionId, fallbackResponse)
    }
  }, [isStreaming, activeSessionId, selectedNodeId, selectedNode, streamResponse, user, apiBase, fetchConversationTree])

  const handleNodeSelect = useCallback((id: string) => {
    setSelectedNodeId(prev => prev === id ? null : id) // 再クリックで選択解除
    setLatestQuestions([])
  }, [])

  const handleQuestionCardSelect = useCallback((id: string) => {
    setSelectedNodeId(id)
    setLatestQuestions([])
  }, [])

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
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
        />

        {/* PC: 横並び / モバイル: viewModeで切り替え */}
        <div className="flex flex-row flex-1 min-h-0 overflow-hidden">
          <div className={`flex flex-col flex-1 min-h-0 min-w-0 ${viewMode === 'tree' ? 'hidden md:flex' : 'flex'}`}>
            <ChatArea
              session={activeSession}
              isStreaming={isStreaming}
              onSuggestionClick={user ? handleSubmit : undefined}
              latestQuestions={latestQuestions}
              onQuestionCardSelect={handleQuestionCardSelect}
            />
          </div>
          <div className={`flex flex-col flex-1 min-h-0 border-l border-gray-200 ${viewMode === 'chat' ? 'hidden' : 'flex'}`}>
            <ConversationTreeView
              treeNodes={activeTreeNodes}
              selectedNodeId={selectedNodeId}
              onNodeSelect={handleNodeSelect}
            />
          </div>
        </div>

        {loading ? (
          <div className="p-6 border-t border-gray-100 bg-gray-50 text-center">
            <span className="inline-block w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin mr-2"></span>
            <span className="text-gray-500 text-sm">読み込み中...</span>
          </div>
        ) : user ? (
          <div className={viewMode === 'tree' ? 'hidden md:block' : ''}>
            <PromptInput
              isStreaming={isStreaming}
              onSubmit={handleSubmit}
              selectedQuestion={selectedNode?.text ?? null}
              requiresSelection={activeTreeNodes.length > 0}
            />
          </div>
        ) : (
          <div className="p-6 border-t border-gray-100 bg-gray-50 text-center">
            <p className="text-gray-500 text-sm mb-2">チャットを開始するにはログインが必要です</p>
          </div>
        )}
      </div>
    </div>
  )
}
