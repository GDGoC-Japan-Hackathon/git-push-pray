import type { ChatMessage } from "../types";
import { renderMarkdown } from "../utils/markdown";
import { ArtifactRenderer } from "./ArtifactRenderer";
import { BotAvatar } from "./BotAvatar";
import { UserAvatar } from "./UserAvatar";

interface Props {
  message: ChatMessage;
}

export function Message({ message }: Props) {
  const isUser = message.role === "user";

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
          ) : (
            <div className="space-y-1">{renderMarkdown(message.content)}</div>
          )}
        </div>
        {!isUser && message.artifact && (
          <ArtifactRenderer artifact={message.artifact} />
        )}
      </div>
      {isUser && <UserAvatar />}
    </div>
  );
}
