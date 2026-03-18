import type { ChatMessage } from '../types'
import { renderMarkdown } from '../utils/markdown'
import { BotAvatar } from './BotAvatar'
import { UserAvatar } from './UserAvatar'

interface Props {
  message: ChatMessage
  onInteract?: (message: string) => void
}

export function Message({ message, onInteract }: Props) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && <BotAvatar />}
      <div
        className={`
          max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed
          ${isUser
            ? 'bg-blue-600 text-white rounded-br-sm'
            : 'bg-gray-100 text-gray-800 rounded-bl-sm'
          }
        `}
      >
        {isUser
          ? message.content
          : <div className="space-y-1">{renderMarkdown(message.content, onInteract)}</div>
        }
      </div>
      {isUser && <UserAvatar />}
    </div>
  )
}
