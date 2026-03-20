import {
  ColumnsIcon,
  MenuIcon,
  MessageSquareIcon,
  NetworkIcon,
} from "lucide-react";
import { BotAvatar } from "./BotAvatar";
import { LoginButton } from "./auth/LoginButton";

export type ViewMode = "chat" | "both" | "tree";

interface Props {
  title: string | null;
  onMenuClick: () => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  hideToggle?: boolean;
}

export function Header({
  title,
  onMenuClick,
  viewMode,
  onViewModeChange,
  hideToggle,
}: Props) {
  return (
    <header className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white shrink-0">
      <button
        onClick={onMenuClick}
        className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
        aria-label="メニューを開く"
      >
        <MenuIcon size={20} />
      </button>
      <div className="flex items-center gap-2">
        <BotAvatar />
        <span className="font-semibold text-gray-800 text-sm italic">
          Pray Log
        </span>
      </div>
      {title && (
        <span className="text-sm text-gray-400 truncate ml-2 flex-1">
          {title}
        </span>
      )}
      <div className="ml-auto flex items-center gap-2">
        {!hideToggle && (
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => onViewModeChange("chat")}
              className={`p-2 transition-colors ${viewMode === "chat" ? "bg-blue-50 text-blue-600" : "text-gray-500 hover:bg-gray-50"}`}
              aria-label="チャット表示"
              title="チャットのみ"
            >
              <MessageSquareIcon size={16} />
            </button>
            <button
              onClick={() => onViewModeChange("both")}
              className={`p-2 transition-colors ${viewMode === "both" ? "bg-blue-50 text-blue-600" : "text-gray-500 hover:bg-gray-50"}`}
              aria-label="両方表示"
              title="チャット＋ツリー"
            >
              <ColumnsIcon size={16} />
            </button>
            <button
              onClick={() => onViewModeChange("tree")}
              className={`p-2 transition-colors ${viewMode === "tree" ? "bg-blue-50 text-blue-600" : "text-gray-500 hover:bg-gray-50"}`}
              aria-label="ツリー表示"
              title="ツリーのみ"
            >
              <NetworkIcon size={16} />
            </button>
          </div>
        )}
        <LoginButton />
      </div>
    </header>
  );
}
