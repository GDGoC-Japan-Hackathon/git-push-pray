import { useRef, useState } from "react";
import { SendIcon, SparklesIcon } from "lucide-react";

interface Props {
  isStreaming: boolean;
  onSubmit: (text: string) => void;
  onVisualize?: () => void;
  isVisualizeActive?: boolean;
  selectedQuestion?: string | null; // 会話ツリーで選択中の質問
  requiresSelection?: boolean; // 選択必須モード（会話ツリー表示中）
  hasMessages?: boolean; // メッセージがあるか（ビジュアライズボタン表示用）
}

export function PromptInput({
  isStreaming,
  onSubmit,
  onVisualize,
  isVisualizeActive,
  selectedQuestion,
  requiresSelection,
  hasMessages,
}: Props) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isDisabled = isStreaming || (requiresSelection && !selectedQuestion);

  const handleSubmit = () => {
    if (!input.trim() || isDisabled) return;
    onSubmit(input.trim());
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "24px";
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const canSubmit = Boolean(input.trim()) && !isDisabled;

  const placeholder =
    requiresSelection && !selectedQuestion
      ? "会話ツリーのノードを選択してください"
      : selectedQuestion
        ? `「${selectedQuestion}」に回答する`
        : "学びたいテーマを入力... (Enterで送信、Shift+Enterで改行)";

  return (
    <div className="shrink-0 border-t border-gray-200 bg-white px-4 py-4">
      <div className="max-w-3xl mx-auto">
        {selectedQuestion && (
          <div className="mb-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 truncate">
            回答中: {selectedQuestion}
          </div>
        )}
        <div
          className={`flex gap-2 items-end bg-gray-50 border rounded-2xl px-4 py-3 transition-all
          ${isDisabled ? "border-gray-100 opacity-60" : "border-gray-200 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100"}
        `}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isDisabled}
            rows={1}
            className="flex-1 bg-transparent resize-none outline-none text-sm text-gray-800 placeholder-gray-400 max-h-[200px] leading-relaxed disabled:cursor-not-allowed"
            style={{ height: "24px" }}
          />
          {hasMessages && (
            <button
              onClick={onVisualize}
              disabled={isDisabled}
              className={`
                flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all shrink-0
                ${
                  isDisabled
                    ? "text-gray-300 cursor-not-allowed"
                    : isVisualizeActive
                      ? "bg-purple-100 text-purple-700 ring-1 ring-purple-300"
                      : "text-purple-500 hover:bg-purple-50 hover:text-purple-600"
                }
              `}
            >
              <SparklesIcon size={14} />
              ビジュアライズ
            </button>
          )}
          <SubmitButton onClick={handleSubmit} disabled={!canSubmit} />
        </div>
        <p className="text-center text-xs text-gray-300 mt-2">
          AIは誤情報を生成することがあります。重要な情報は確認してください。
        </p>
      </div>
    </div>
  );
}

interface SubmitButtonProps {
  onClick: () => void;
  disabled: boolean;
}

function SubmitButton({ onClick, disabled }: SubmitButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        p-1.5 rounded-lg transition-all shrink-0
        ${
          !disabled
            ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
            : "bg-gray-200 text-gray-400 cursor-not-allowed"
        }
      `}
    >
      <SendIcon size={16} />
    </button>
  );
}
