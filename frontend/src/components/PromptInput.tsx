import { useRef, useState } from 'react'
import { SendIcon } from 'lucide-react'

interface Props {
  isStreaming: boolean
  onSubmit: (text: string) => void
}

export function PromptInput({ isStreaming, onSubmit }: Props) {
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = () => {
    if (!input.trim() || isStreaming) return
    onSubmit(input.trim())
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = '24px'
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px'
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const canSubmit = Boolean(input.trim()) && !isStreaming

  return (
    <div className="shrink-0 border-t border-gray-200 bg-white px-4 py-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex gap-2 items-end bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="メッセージを入力... (Enterで送信、Shift+Enterで改行)"
            rows={1}
            className="flex-1 bg-transparent resize-none outline-none text-sm text-gray-800 placeholder-gray-400 max-h-[200px] leading-relaxed"
            style={{ height: '24px' }}
          />
          <SubmitButton onClick={handleSubmit} disabled={!canSubmit} />
        </div>
        <p className="text-center text-xs text-gray-300 mt-2">
          AIは誤情報を生成することがあります。重要な情報は確認してください。
        </p>
      </div>
    </div>
  )
}

interface SubmitButtonProps {
  onClick: () => void
  disabled: boolean
}

function SubmitButton({ onClick, disabled }: SubmitButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        p-1.5 rounded-lg transition-all shrink-0
        ${!disabled
          ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
          : 'bg-gray-200 text-gray-400 cursor-not-allowed'
        }
      `}
    >
      <SendIcon size={16} />
    </button>
  )
}
