import { useEffect, useRef } from 'react'
import type { ChatSession } from '../types'
import { SUGGESTIONS } from '../constants'
import { Message } from './Message'
import { TypingIndicator } from './TypingIndicator'
import { BotAvatar } from './BotAvatar'

interface Props {
  session: ChatSession | null
  isStreaming: boolean
  onSuggestionClick: (text: string) => void
}

export function ChatArea({ session, isStreaming, onSuggestionClick }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [session?.messages])

  const isEmpty = !session || session.messages.length === 0
  const showTyping = isStreaming && session?.messages.at(-1)?.role !== 'assistant'

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {isEmpty ? (
          <EmptyState onSuggestionClick={onSuggestionClick} />
        ) : (
          session.messages.map(message => (
            <Message key={message.id} message={message} />
          ))
        )}
        {showTyping && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

interface EmptyStateProps {
  onSuggestionClick: (text: string) => void
}

function EmptyState({ onSuggestionClick }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-[50vh] gap-4 text-center">
      <BotAvatar size="lg" />
      <div>
        <h2 className="text-xl font-semibold text-gray-800 mb-1">何でも聞いてください</h2>
        <p className="text-sm text-gray-400">AIアシスタントがお手伝いします</p>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-2 w-full max-w-sm">
        {SUGGESTIONS.map(suggestion => (
          <button
            key={suggestion}
            onClick={() => onSuggestionClick(suggestion)}
            className="text-xs text-left px-3 py-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  )
}
