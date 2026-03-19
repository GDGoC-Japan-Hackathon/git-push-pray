import { useState, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { nanoid } from "nanoid";
import type { ChatSession, TreeNode } from "./types";

import { Sidebar } from "./components/Sidebar";
import { Header, type ViewMode } from "./components/Header";
import { ChatArea } from "./components/ChatArea";
import { ConversationTreeView } from "./components/ConversationTreeView";
import { PromptInput } from "./components/PromptInput";
import { useAuth } from "./contexts/AuthContext";
import { readSSEStream, extractJSONStringField } from "./utils/streamParser";

function getUnansweredLeaves(nodes: TreeNode[]): TreeNode[] {
  const parentIds = new Set(nodes.map((n) => n.parentId).filter(Boolean));
  return nodes.filter(
    (n) => n.type === "question" && n.parentId !== "" && n.answer === "" && !parentIds.has(n.id)
  );
}

export default function App() {
  const { chatId } = useParams<{ chatId?: string }>();
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(
    chatId ?? null
  );
  const [isStreaming, setIsStreaming] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("chat");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [treeNodes, setTreeNodes] = useState<Record<string, TreeNode[]>>({});
  const [latestQuestions, setLatestQuestions] = useState<TreeNode[]>([]);
  const [generateUI, setGenerateUI] = useState(false);
  const { user, loading } = useAuth();

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;
  const activeTreeNodes = activeSessionId
    ? (treeNodes[activeSessionId] ?? [])
    : [];
  const selectedNode =
    activeTreeNodes.find((n) => n.id === selectedNodeId) ?? null;

  // URLパラメータとactiveSessionIdを同期
  useEffect(() => {
    if (chatId && chatId !== activeSessionId) {
      setActiveSessionId(chatId);
      setSelectedNodeId(null);
      setLatestQuestions([]);
      // セッション一覧にあれば履歴を読み込む
      if (sessions.some((s) => s.id === chatId)) {
        fetchHistory(chatId);
        fetchConversationTree(chatId);
      }
    } else if (!chatId && activeSessionId) {
      setActiveSessionId(null);
      setSelectedNodeId(null);
      setLatestQuestions([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  const apiBase = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

  const fetchConversationTree = useCallback(
    async (sessionId: string): Promise<TreeNode[]> => {
      if (!user) return [];
      try {
        const token = await user.getIdToken();
        const resp = await fetch(
          `${apiBase}/api/conversation-tree?conversation_id=${encodeURIComponent(sessionId)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!resp.ok) return [];
        const data = await resp.json();
        const nodes: TreeNode[] = (data.nodes ?? []).map(
          (n: {
            id: string;
            parent_id: string;
            text: string;
            answer: string;
            type?: string;
          }) => ({
            id: n.id,
            parentId: n.parent_id,
            text: n.text,
            answer: n.answer,
            type: (n.type || "question") as "question" | "visualize",
          })
        );
        setTreeNodes((prev) => ({ ...prev, [sessionId]: nodes }));
        return nodes;
      } catch (err) {
        console.error("Failed to fetch conversation tree:", err);
        return [];
      }
    },
    [user, apiBase]
  );

  // セッション一覧の初回取得（userログイン時のみ）
  useEffect(() => {
    if (!user) {
      setSessions([]);
      setActiveSessionId(null);
      return;
    }
    const fetchSessions = async () => {
      try {
        const token = await user.getIdToken();
        const resp = await fetch(
          `${apiBase}/api/sessions?user_id=${encodeURIComponent(user.uid)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!resp.ok) return;
        const data = await resp.json();
        const fetched: ChatSession[] = data.sessions.map(
          (s: {
            conversation_id: string;
            title: string;
            last_message: string;
            updated_at?: string;
          }) => ({
            id: s.conversation_id,
            title: s.title,
            lastMessage: s.last_message,
            timestamp: s.updated_at || new Date().toISOString(),
            messages: [],
          })
        );
        setSessions(fetched);

        // 初回ロード時: URLにchatIdがあればそのセッションの履歴を読み込む
        const initialChatId = chatId;
        const targetId =
          initialChatId && fetched.some((s) => s.id === initialChatId)
            ? initialChatId
            : null;

        if (targetId) {
          setActiveSessionId(targetId);
          const histResp = await fetch(
            `${apiBase}/api/history?user_id=${encodeURIComponent(user.uid)}&conversation_id=${encodeURIComponent(targetId)}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (histResp.ok) {
            const histData = await histResp.json();
            setSessions((prev) =>
              prev.map((s) =>
                s.id === targetId
                  ? {
                      ...s,
                      messages: histData.messages.map(
                        (m: {
                          role: string;
                          content: string;
                          artifact?: { title: string; code: string };
                        }) => ({
                          id: nanoid(),
                          role: m.role as "user" | "assistant",
                          content: m.content,
                          artifact: m.artifact,
                        })
                      ),
                    }
                  : s
              )
            );
          }
          const nodes = await fetchConversationTree(targetId);
          setLatestQuestions(getUnansweredLeaves(nodes));
        }
      } catch (err) {
        console.error("Failed to fetch sessions:", err);
      }
    };
    fetchSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, apiBase]);

  const handleNewChat = useCallback(() => {
    setActiveSessionId(null);
    setSelectedNodeId(null);
    setLatestQuestions([]);
    setSidebarOpen(false);
    navigate("/");
  }, [navigate]);

  const fetchHistory = useCallback(
    async (sessionId: string) => {
      if (!user) return;
      try {
        const token = await user.getIdToken();
        const resp = await fetch(
          `${apiBase}/api/history?user_id=${encodeURIComponent(user.uid)}&conversation_id=${encodeURIComponent(sessionId)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!resp.ok) return;
        const data = await resp.json();
        setSessions((prev) =>
          prev.map((s) =>
            s.id === sessionId
              ? {
                  ...s,
                  messages: data.messages.map(
                    (m: {
                      role: string;
                      content: string;
                      artifact?: { title: string; code: string };
                    }) => ({
                      id: nanoid(),
                      role: m.role as "user" | "assistant",
                      content: m.content,
                      artifact: m.artifact,
                    })
                  ),
                }
              : s
          )
        );
      } catch (err) {
        console.error("Failed to fetch history:", err);
      }
    },
    [user, apiBase]
  );

  const handleSelectSession = useCallback(
    async (id: string) => {
      setActiveSessionId(id);
      setSelectedNodeId(null);
      setLatestQuestions([]);
      setSidebarOpen(false);
      navigate(`/${id}`);
      const [, nodes] = await Promise.all([fetchHistory(id), fetchConversationTree(id)]);
      setLatestQuestions(getUnansweredLeaves(nodes));
    },
    [fetchHistory, fetchConversationTree, navigate]
  );

  const handleViewModeChange = useCallback(
    (mode: ViewMode) => {
      setViewMode(mode);
      if (mode === "tree" && activeSessionId) {
        fetchConversationTree(activeSessionId);
      }
    },
    [activeSessionId, fetchConversationTree]
  );

  const handleSubmit = useCallback(
    async (text: string) => {
      if (isStreaming) return;
      setIsStreaming(true);

      let sessionId = activeSessionId;
      if (!sessionId) {
        const session: ChatSession = {
          id: `chat-${nanoid()}`,
          title: text.slice(0, 30),
          lastMessage: text,
          timestamp: new Date().toISOString(),
          messages: [],
        };
        setSessions((prev) => [session, ...prev]);
        setActiveSessionId(session.id);
        sessionId = session.id;
        navigate(`/${session.id}`, { replace: true });
      }

      const msgId = nanoid();
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                title: s.messages.length === 0 ? text.slice(0, 30) : s.title,
                lastMessage: text,
                timestamp: new Date().toISOString(),
                messages: [
                  ...s.messages,
                  { id: nanoid(), role: "user" as const, content: text },
                  {
                    id: msgId,
                    role: "assistant" as const,
                    content: "",
                    isStreaming: true,
                  },
                ],
              }
            : s
        )
      );

      try {
        const token = user ? await user.getIdToken() : null;
        if (!token || !user) {
          setIsStreaming(false);
          return;
        }

        const body: Record<string, string | boolean> = {
          user_id: user.uid,
          conversation_id: sessionId,
          message: text,
        };
        if (selectedNodeId) body.parent_node_id = selectedNodeId;
        if (selectedNode) body.answering_question = selectedNode.text;
        if (generateUI) body.generate_ui = true;

        const resp = await fetch(`${apiBase}/api/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });
        if (!resp.ok) throw new Error(`API error: ${resp.status}`);

        // SSEストリームを読み取り、リアルタイムで表示を更新
        let doneProcessed = false;
        await readSSEStream(resp, async (event, data) => {
          if (event === "chunk") {
            const { text: accumulated } = JSON.parse(data) as { text: string };
            const reply = extractJSONStringField(accumulated, "reply") ?? "";
            const code = extractJSONStringField(accumulated, "code");

            setSessions((prev) =>
              prev.map((s) =>
                s.id === sessionId
                  ? {
                      ...s,
                      messages: s.messages.map((m) =>
                        m.id === msgId
                          ? {
                              ...m,
                              content: reply,
                              streamingCode: code ?? undefined,
                            }
                          : m
                      ),
                      lastMessage:
                        reply.slice(0, 60) + (reply.length > 60 ? "..." : ""),
                    }
                  : s
              )
            );
          } else if (event === "done") {
            doneProcessed = true;
            const doneData = JSON.parse(data);
            const actualId: string = doneData.conversation_id || sessionId;
            if (actualId !== sessionId) {
              setSessions((prev) =>
                prev.map((s) =>
                  s.id === sessionId ? { ...s, id: actualId } : s
                )
              );
              setActiveSessionId(actualId);
              navigate(`/${actualId}`, { replace: true });
            }

            // 最終データでメッセージを確定（streaming解除 + artifact付与）
            const targetId = actualId !== sessionId ? actualId : sessionId;
            setSessions((prev) =>
              prev.map((s) =>
                s.id === targetId
                  ? {
                      ...s,
                      messages: s.messages.map((m) =>
                        m.id === msgId
                          ? {
                              ...m,
                              content: doneData.reply,
                              isStreaming: false,
                              streamingCode: undefined,
                              artifact: doneData.artifact ?? undefined,
                            }
                          : m
                      ),
                    }
                  : s
              )
            );

            // 会話ツリーを更新
            const questionIds = new Set<string>(
              (doneData.questions ?? []).map((q: { id: string }) => q.id)
            );
            const updatedNodes = await fetchConversationTree(actualId);
            const newQuestions = updatedNodes.filter((n) =>
              questionIds.has(n.id)
            );
            setLatestQuestions(newQuestions);
          } else if (event === "error") {
            console.error("Stream error:", data);
            doneProcessed = true;
            setSessions((prev) =>
              prev.map((s) =>
                s.id === sessionId
                  ? {
                      ...s,
                      messages: s.messages.map((m) =>
                        m.id === msgId
                          ? {
                              ...m,
                              content:
                                "ストリーミング中にエラーが発生しました。",
                              isStreaming: false,
                            }
                          : m
                      ),
                    }
                  : s
              )
            );
            setIsStreaming(false);
          }
        });

        // doneイベントが来なかった場合のフォールバック
        if (!doneProcessed) {
          console.warn("SSE stream ended without done event");
          setSessions((prev) =>
            prev.map((s) =>
              s.id === sessionId
                ? {
                    ...s,
                    messages: s.messages.map((m) =>
                      m.id === msgId && m.isStreaming
                        ? {
                            ...m,
                            content:
                              m.content ||
                              "予期しないエラーにより応答が中断されました。",
                            isStreaming: false,
                          }
                        : m
                    ),
                  }
                : s
            )
          );
        }

        setSelectedNodeId(null);
        setGenerateUI(false);
        setIsStreaming(false);
      } catch (err) {
        console.error("Failed to fetch from backend:", err);
        setSessions((prev) =>
          prev.map((s) =>
            s.id === sessionId
              ? {
                  ...s,
                  messages: s.messages.map((m) =>
                    m.id === msgId
                      ? {
                          ...m,
                          content: "バックエンドへの接続に失敗しました。",
                          isStreaming: false,
                        }
                      : m
                  ),
                }
              : s
          )
        );
        setGenerateUI(false);
        setIsStreaming(false);
      }
    },
    [
      isStreaming,
      activeSessionId,
      selectedNodeId,
      selectedNode,
      generateUI,
      user,
      apiBase,
      fetchConversationTree,
      navigate,
    ]
  );

  const handleNodeSelect = useCallback((id: string) => {
    setSelectedNodeId((prev) => (prev === id ? null : id)); // 再クリックで選択解除
    setLatestQuestions([]);
  }, []);

  const handleQuestionCardSelect = useCallback((id: string) => {
    setSelectedNodeId(id);
    setLatestQuestions([]);
  }, []);

  // 質問カードのvisualizeクリック → ノード選択 + ビジュアライズモードON
  const handleVisualizeClick = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
    setLatestQuestions([]);
    setGenerateUI(true);
  }, []);

  // 入力欄のビジュアライズボタン → トグル
  const handleToggleVisualize = useCallback(() => {
    setGenerateUI((prev) => !prev);
  }, []);

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
          <div
            className={`flex flex-col flex-1 min-h-0 min-w-0 ${viewMode === "tree" ? "hidden md:flex" : "flex"}`}
          >
            <ChatArea
              session={activeSession}
              isStreaming={isStreaming}
              onSuggestionClick={user ? handleSubmit : undefined}
              latestQuestions={latestQuestions}
              onQuestionCardSelect={handleQuestionCardSelect}
              onVisualizeClick={handleVisualizeClick}
            />
          </div>
          <div
            className={`flex flex-col flex-1 min-h-0 border-l border-gray-200 ${viewMode === "chat" ? "hidden" : "flex"}`}
          >
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
          <div className={viewMode === "tree" ? "hidden md:block" : ""}>
            <PromptInput
              isStreaming={isStreaming}
              onSubmit={handleSubmit}
              onVisualize={handleToggleVisualize}
              isVisualizeActive={generateUI}
              selectedQuestion={selectedNode?.text ?? null}
              requiresSelection={activeTreeNodes.length > 0}
              hasMessages={(activeSession?.messages.length ?? 0) > 0}
            />
          </div>
        ) : (
          <div className="p-6 border-t border-gray-100 bg-gray-50 text-center">
            <p className="text-gray-500 text-sm mb-2">
              チャットを開始するにはログインが必要です
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
