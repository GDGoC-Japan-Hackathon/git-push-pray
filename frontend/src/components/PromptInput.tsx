import { ClipboardCheckIcon, SendIcon, SparklesIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface Props {
  isStreaming: boolean;
  onSubmit: (text: string) => void;
  onVisualize?: () => void;
  isVisualizeActive?: boolean;
  selectedQuestion?: string | null; // 会話ツリーで選択中の質問
  selectedNodeType?: "question" | "visualize" | "free_input" | null;
  requiresSelection?: boolean; // 選択必須モード（会話ツリー表示中）
  hasMessages?: boolean; // メッセージがあるか（ビジュアライズボタン表示用）
  isInitPhase?: boolean; // 初期化フェーズ中か
  freeInputMode?: boolean; // 自由入力モード
  freeInputContext?: string | null; // 補足対象のノードテキスト
  onCancelFreeInput?: () => void;
  onRequestReview?: () => void;
  isReviewLoading?: boolean;
}

export function PromptInput({
  isStreaming,
  onSubmit,
  onVisualize,
  isVisualizeActive,
  selectedQuestion,
  selectedNodeType,
  requiresSelection,
  hasMessages,
  isInitPhase,
  freeInputMode,
  freeInputContext,
  onCancelFreeInput,
  onRequestReview,
  isReviewLoading,
}: Props) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isDisabled = isStreaming || (requiresSelection && !selectedQuestion);

  // AIの応答完了時にテキストエリアにフォーカス
  const wasStreaming = useRef(false);
  useEffect(() => {
    if (wasStreaming.current && !isStreaming) {
      textareaRef.current?.focus();
    }
    wasStreaming.current = isStreaming;
  }, [isStreaming]);

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

  const placeholder = isInitPhase
    ? "学びたいテーマを入力... (Enterで送信、Shift+Enterで改行)"
    : freeInputMode
      ? "自由に回答を入力... (Enterで送信)"
      : requiresSelection && !selectedQuestion
        ? "会話ツリーのノードを選択してください"
        : selectedQuestion
          ? `「${selectedQuestion}」に回答する`
          : "学びたいテーマを入力... (Enterで送信、Shift+Enterで改行)";

  return (
    <div className="shrink-0 border-t border-gray-200 bg-white px-4 py-4">
      <div className="max-w-4xl mx-auto">
        {freeInputMode && (
          <div className="mb-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700 flex items-center justify-between">
            <span className="truncate">
              自由回答を入力中{freeInputContext ? `：${freeInputContext}` : ""}
            </span>
            <button
              onClick={onCancelFreeInput}
              className="text-green-500 hover:text-green-700 ml-2"
            >
              キャンセル
            </button>
          </div>
        )}
        {selectedQuestion && !freeInputMode && (
          <div
            className={`mb-2 px-3 py-1.5 rounded-lg text-xs truncate border ${
              selectedNodeType === "visualize"
                ? "bg-purple-50 border-purple-200 text-purple-700"
                : "bg-blue-50 border-blue-200 text-blue-700"
            }`}
          >
            回答中: {selectedQuestion}
          </div>
        )}
        <div className="flex items-end gap-2">
          {hasMessages && !isInitPhase && (
            <div className="shrink-0 px-3 py-3 text-xs font-medium invisible flex items-center gap-1 border">
              <ClipboardCheckIcon size={16} />
              レビューを開始
            </div>
          )}
          <div
            className={`flex gap-2 items-end flex-1 min-w-0 bg-gray-50 border rounded-2xl px-4 py-3 transition-all
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
            {hasMessages && !isInitPhase && (
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
          {hasMessages && !isInitPhase && (
            <button
              onClick={onRequestReview}
              disabled={isStreaming || isReviewLoading}
              className={`
                flex items-center gap-1 px-3 py-3 rounded-2xl text-xs font-medium transition-all shrink-0 border
                ${
                  isStreaming || isReviewLoading
                    ? "border-gray-200 bg-gray-50 text-gray-300 cursor-not-allowed"
                    : "border-orange-200 bg-orange-50 text-orange-600 hover:bg-orange-100 hover:border-orange-300"
                }
              `}
            >
              <ClipboardCheckIcon size={16} />
              {isReviewLoading ? "レビュー中..." : "レビューを開始"}
            </button>
          )}
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
