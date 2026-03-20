import { nanoid } from "nanoid";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { ChatSession, TreeNode } from "./types";

import { ChatArea } from "./components/ChatArea";
import { ConversationTreeView } from "./components/ConversationTreeView";
import { Header, type ViewMode } from "./components/Header";
import { PromptInput } from "./components/PromptInput";
import { Sidebar } from "./components/Sidebar";
import { useAuth } from "./contexts/AuthContext";
import { extractJSONStringField, readSSEStream } from "./utils/streamParser";

// 直前のAI返信で生成された質問だけを返す（ツリー末尾の同一親グループ）
function getLatestQuestionGroup(nodes: TreeNode[]): TreeNode[] {
  const parentIds = new Set(nodes.map((n) => n.parentId).filter(Boolean));
  const leaves = nodes.filter(
    (n) => n.parentId !== "" && n.answer === "" && !parentIds.has(n.id)
  );
  if (leaves.length === 0) return [];
  // ノードはcreatedAt順で返るので、末尾のノードの親と同じ親を持つグループが最新
  const lastParentId = leaves[leaves.length - 1].parentId;
  return leaves.filter((n) => n.parentId === lastParentId);
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
  const [freeInputMode, setFreeInputMode] = useState(false);
  const [contextParentNodeId, setContextParentNodeId] = useState<string | null>(
    null
  );
  const { user, loading } = useAuth();

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;
  const activeTreeNodes = activeSessionId
    ? (treeNodes[activeSessionId] ?? [])
    : [];
  const selectedNode =
    activeTreeNodes.find((n) => n.id === selectedNodeId) ?? null;
  const contextParentNode =
    activeTreeNodes.find((n) => n.id === contextParentNodeId) ?? null;

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
            phase?: string;
          }) => ({
            id: s.conversation_id,
            title: s.title,
            lastMessage: s.last_message,
            timestamp: s.updated_at || new Date().toISOString(),
            messages: [],
            phase: (s.phase || "teaching") as "init" | "teaching",
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
            const histPhase = (histData.phase || "teaching") as
              | "init"
              | "teaching";
            setSessions((prev) =>
              prev.map((s) =>
                s.id === targetId
                  ? {
                      ...s,
                      phase: histPhase,
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
          setLatestQuestions(getLatestQuestionGroup(nodes));
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
    setFreeInputMode(false);
    setContextParentNodeId(null);
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
        const histPhase = (data.phase || "teaching") as "init" | "teaching";
        setSessions((prev) =>
          prev.map((s) =>
            s.id === sessionId
              ? {
                  ...s,
                  phase: histPhase,
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
      const [, nodes] = await Promise.all([
        fetchHistory(id),
        fetchConversationTree(id),
      ]);
      setLatestQuestions(getLatestQuestionGroup(nodes));
    },
    [fetchHistory, fetchConversationTree, navigate]
  );

  const handleViewModeChange = useCallback(
    (mode: ViewMode) => {
      setViewMode(mode);
      if ((mode === "tree" || mode === "both") && activeSessionId) {
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
          phase: "init",
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

        const currentSession = sessions.find((s) => s.id === sessionId);
        const isInitPhase =
          currentSession != null ? currentSession.phase === "init" : false;

        const body: Record<string, string | boolean> = {
          user_id: user.uid,
          conversation_id: sessionId,
          message: text,
        };
        if (!isInitPhase && selectedNodeId)
          body.parent_node_id = selectedNodeId;
        if (!isInitPhase && selectedNode)
          body.answering_question = selectedNode.text;
        if (!isInitPhase && generateUI) body.generate_ui = true;
        if (!isInitPhase && freeInputMode) {
          body.is_supplement = true;
          if (contextParentNodeId)
            body.context_parent_node_id = contextParentNodeId;
        }

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
            const donePhase: "init" | "teaching" = doneData.phase || "teaching";

            if (actualId !== sessionId) {
              setSessions((prev) =>
                prev.map((s) =>
                  s.id === sessionId ? { ...s, id: actualId } : s
                )
              );
              setActiveSessionId(actualId);
              navigate(`/${actualId}`, { replace: true });
            }

            // 最終データでメッセージを確定（streaming解除 + artifact付与）+ phase更新
            const targetId = actualId !== sessionId ? actualId : sessionId;
            setSessions((prev) =>
              prev.map((s) => {
                if (s.id !== targetId) return s;
                const isPhaseTransition =
                  donePhase === "teaching" && s.phase === "init";
                const updatedMessages = s.messages.map((m) =>
                  m.id === msgId
                    ? {
                        ...m,
                        content: doneData.reply,
                        isStreaming: false,
                        streamingCode: undefined,
                        artifact: doneData.artifact ?? undefined,
                      }
                    : m
                );
                return {
                  ...s,
                  phase: donePhase,
                  ...(isPhaseTransition
                    ? { title: doneData.title || s.title }
                    : {}),
                  messages: isPhaseTransition
                    ? [
                        ...updatedMessages,
                        {
                          id: nanoid(),
                          role: "system" as const,
                          content: `📚 テーマ: ${doneData.title || s.title}\n学習を開始します！`,
                        },
                      ]
                    : updatedMessages,
                };
              })
            );

            // initフェーズ中は質問カードやツリー不要
            if (donePhase === "init") {
              setLatestQuestions([]);
            } else {
              // 会話ツリーを更新
              const questionIds = new Set<string>(
                (doneData.questions ?? []).map((q: { id: string }) => q.id)
              );
              const updatedNodes = await fetchConversationTree(actualId);
              const newQuestions = updatedNodes.filter((n) =>
                questionIds.has(n.id)
              );
              setLatestQuestions(newQuestions);
            }
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
        setFreeInputMode(false);
        setContextParentNodeId(null);
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
      freeInputMode,
      contextParentNodeId,
      user,
      apiBase,
      fetchConversationTree,
      navigate,
      sessions,
    ]
  );

  const handleDeleteSession = useCallback(
    async (id: string) => {
      if (!user) return;
      try {
        const token = await user.getIdToken();
        const resp = await fetch(
          `${apiBase}/api/conversation?conversation_id=${encodeURIComponent(id)}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (!resp.ok) throw new Error(`Delete failed: ${resp.status}`);
        setSessions((prev) => prev.filter((s) => s.id !== id));
        if (activeSessionId === id) {
          setActiveSessionId(null);
          setSelectedNodeId(null);
          setLatestQuestions([]);
          navigate("/");
        }
      } catch (err) {
        console.error("Failed to delete session:", err);
      }
    },
    [user, apiBase, activeSessionId, navigate]
  );

  const handleNodeSelect = useCallback((id: string) => {
    setSelectedNodeId((prev) => (prev === id ? null : id)); // 再クリックで選択解除
    setLatestQuestions([]);
    setFreeInputMode(false);
    setContextParentNodeId(null);
  }, []);

  const handleQuestionCardSelect = useCallback((id: string) => {
    setSelectedNodeId(id);
    setLatestQuestions([]);
    setFreeInputMode(false);
    setContextParentNodeId(null);
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

  // 補足する（自由入力モード）- 現在の質問カードの親ノードIDをコンテキストとして保持
  const handleFreeInput = useCallback(() => {
    const parentId =
      latestQuestions.length > 0 ? latestQuestions[0].parentId : null;
    setContextParentNodeId(parentId);
    setSelectedNodeId(null);
    setLatestQuestions([]);
    setFreeInputMode(true);
  }, [latestQuestions]);

  // マインドマップのノードから補足する
  const handleFreeInputFromNode = useCallback((nodeId: string) => {
    setContextParentNodeId(nodeId);
    setSelectedNodeId(null);
    setLatestQuestions([]);
    setFreeInputMode(true);
  }, []);

  const isInitPhase = activeSession?.phase === "init";

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <Sidebar
        open={sidebarOpen}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onClose={() => setSidebarOpen(false)}
        onNewChat={handleNewChat}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
      />

      <div className="flex flex-col flex-1 min-w-0">
        <Header
          title={activeSession?.title ?? null}
          onMenuClick={() => setSidebarOpen(true)}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          hideToggle={isInitPhase || !activeSession}
        />

        {/* PC: 横並び / モバイル: viewModeで切り替え */}
        <div className="flex flex-row flex-1 min-h-0 overflow-hidden">
          <div
            className={`flex flex-col flex-1 min-h-0 min-w-0 ${!isInitPhase && viewMode === "tree" ? "hidden" : "flex"}`}
          >
            <ChatArea
              session={activeSession}
              isStreaming={isStreaming}
              onSuggestionClick={user ? handleSubmit : undefined}
              latestQuestions={isInitPhase ? [] : latestQuestions}
              onQuestionCardSelect={handleQuestionCardSelect}
              onVisualizeClick={handleVisualizeClick}
              onFreeInput={handleFreeInput}
            />
          </div>
          {!isInitPhase && (
            <div
              className={`flex flex-col flex-1 min-h-0 border-l border-gray-200 ${viewMode === "chat" ? "hidden" : "flex"}`}
              style={viewMode === "both" ? { maxWidth: "50%" } : undefined}
            >
              <ConversationTreeView
                treeNodes={activeTreeNodes}
                selectedNodeId={selectedNodeId}
                onNodeSelect={handleNodeSelect}
                onFreeInputFromNode={handleFreeInputFromNode}
              />
            </div>
          )}
        </div>

        {loading ? (
          <div className="p-6 border-t border-gray-100 bg-gray-50 text-center">
            <span className="inline-block w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin mr-2"></span>
            <span className="text-gray-500 text-sm">読み込み中...</span>
          </div>
        ) : user ? (
          <div
            className={
              !isInitPhase && viewMode === "tree" ? "hidden md:block" : ""
            }
          >
            <PromptInput
              isStreaming={isStreaming}
              onSubmit={handleSubmit}
              onVisualize={handleToggleVisualize}
              isVisualizeActive={generateUI}
              selectedQuestion={
                isInitPhase ? null : (selectedNode?.text ?? null)
              }
              requiresSelection={
                !isInitPhase && !freeInputMode && activeTreeNodes.length > 0
              }
              hasMessages={
                !isInitPhase && (activeSession?.messages.length ?? 0) > 0
              }
              isInitPhase={isInitPhase}
              freeInputMode={freeInputMode}
              freeInputContext={contextParentNode?.text ?? null}
              onCancelFreeInput={() => {
                setFreeInputMode(false);
                setContextParentNodeId(null);
              }}
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
