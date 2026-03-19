import { useEffect, useRef } from 'react'
import type { ChatSession, TreeNode } from '../types'
import { SUGGESTIONS } from '../constants'
import { Message } from './Message'
import { TypingIndicator } from './TypingIndicator'
import { BotAvatar } from './BotAvatar'

interface Props {
  session: ChatSession | null
  isStreaming: boolean
  onSuggestionClick?: (text: string) => void
  latestQuestions?: TreeNode[]
  onQuestionCardSelect?: (id: string) => void
}

export function ChatArea({ session, isStreaming, onSuggestionClick, latestQuestions = [], onQuestionCardSelect }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [session?.messages, latestQuestions])

  const isEmpty = !session || session.messages.length === 0
  const showTyping = isStreaming && session?.messages.at(-1)?.role !== 'assistant'
  const showQuestionCards = !isStreaming && latestQuestions.length > 0

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
        {showQuestionCards && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-gray-400 font-medium">次の質問を選択してください</p>
            <div className="flex flex-wrap gap-2">
              {latestQuestions.map(q => (
                <button
                  key={q.id}
                  onClick={() => onQuestionCardSelect?.(q.id)}
                  className="flex-1 min-w-[140px] max-w-xs text-left px-4 py-3 rounded-xl border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 hover:border-blue-400 text-sm text-gray-800 leading-snug transition-all shadow-sm hover:shadow-md"
                >
                  <span className="text-xs font-semibold text-blue-500 block mb-0.5">Q</span>
                  {q.text}
                </button>
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

interface EmptyStateProps {
  onSuggestionClick?: (text: string) => void
}

function EmptyState({ onSuggestionClick }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-[50vh] gap-4 text-center">
      <BotAvatar size="lg" />
      <div>
        <h2 className="text-xl font-semibold text-gray-800 mb-1">何について説明しますか？</h2>
        <p className="text-sm text-gray-400">AIに聞いてほしいテーマを入力してください</p>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-2 w-full max-w-sm">
        {SUGGESTIONS.map(suggestion => (
          <button
            key={suggestion}
            onClick={() => onSuggestionClick?.(suggestion)}
            className="text-xs text-left px-3 py-2.5 rounded-lg border border-gray-200 hover:bg-blue-50 hover:border-blue-200 text-gray-600 transition-colors"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  )
}
