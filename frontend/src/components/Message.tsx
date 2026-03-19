import { useEffect, useRef } from "react";
import { Code } from "lucide-react";
import type { ChatMessage } from "../types";
import { renderMarkdown } from "../utils/markdown";
import { ArtifactRenderer } from "./ArtifactRenderer";
import { BotAvatar } from "./BotAvatar";
import { UserAvatar } from "./UserAvatar";
import "@/components/shadcn-space/animated-text/animated-text-01.css";

interface Props {
  message: ChatMessage;
}

export function Message({ message }: Props) {
  const isUser = message.role === "user";
  const codeEndRef = useRef<HTMLPreElement>(null);

  // ストリーミング中のコードを自動スクロール
  useEffect(() => {
    if (message.streamingCode && codeEndRef.current) {
      codeEndRef.current.scrollTop = codeEndRef.current.scrollHeight;
    }
  }, [message.streamingCode]);

  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && <BotAvatar />}
      <div className={`max-w-[80%] ${!isUser ? "space-y-0" : ""}`}>
        <div
          className={`
            rounded-2xl px-4 py-3 text-sm leading-relaxed
            ${
              isUser
                ? "bg-blue-600 text-white rounded-br-sm"
                : "bg-gray-100 text-gray-800 rounded-bl-sm"
            }
          `}
        >
          {isUser ? (
            <span className="whitespace-pre-wrap">{message.content}</span>
          ) : !message.content && message.isStreaming ? (
            <p className="shiny inline-block bg-[linear-gradient(120deg,#9ca3af_40%,#111827_50%,#9ca3af_60%)] bg-[length:200%_100%] bg-clip-text text-transparent text-sm font-medium">
              Thinking...
            </p>
          ) : (
            <div className="space-y-1">{renderMarkdown(message.content)}</div>
          )}
        </div>
        {/* ストリーミング中: コードをリアルタイム表示 */}
        {!isUser && message.isStreaming && message.streamingCode && (
          <div className="mt-3 rounded-xl border border-purple-200 overflow-hidden bg-white shadow-sm">
            <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 border-b border-purple-200">
              <Code size={14} className="text-purple-500" />
              <span className="text-xs font-medium text-purple-600">
                コード生成中...
              </span>
              <span className="ml-auto inline-block w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            </div>
            <pre
              ref={codeEndRef}
              className="p-3 text-xs overflow-auto bg-gray-900 text-gray-100 max-h-[400px]"
            >
              <code>{message.streamingCode}</code>
            </pre>
          </div>
        )}
        {/* 完了後: iframeプレビュー */}
        {!isUser && !message.isStreaming && message.artifact && (
          <ArtifactRenderer artifact={message.artifact} />
        )}
      </div>
      {isUser && <UserAvatar />}
    </div>
  );
}
