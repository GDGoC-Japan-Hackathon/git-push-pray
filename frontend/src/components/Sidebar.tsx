import {
  MessageSquareIcon,
  MoreHorizontalIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useState } from "react";
import type { ChatSession } from "../types";
import { formatTimestamp } from "../utils/format";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

interface Props {
  open: boolean;
  sessions: ChatSession[];
  activeSessionId: string | null;
  onClose: () => void;
  onNewChat: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => Promise<void>;
}

export function Sidebar({
  open,
  sessions,
  activeSessionId,
  onClose,
  onNewChat,
  onSelectSession,
  onDeleteSession,
}: Props) {
  return (
    <>
      {/* Overlay */}
      {open && (
        <div className="fixed inset-0 bg-black/20 z-20" onClick={onClose} />
      )}

      {/* Panel */}
      <aside
        className={`
          fixed top-0 left-0 h-full w-72 bg-gray-50 border-r border-gray-200 z-30
          flex flex-col transition-transform duration-300 ease-in-out
          ${open ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <SidebarHeader onClose={onClose} />

        <div className="px-3 py-3">
          <button
            onClick={onNewChat}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white border border-gray-200 text-sm text-gray-700 hover:bg-gray-100 transition-colors shadow-sm"
          >
            <PlusIcon size={16} />
            新しいチャット
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
          {sessions.map((session) => (
            <SessionItem
              key={session.id}
              session={session}
              isActive={session.id === activeSessionId}
              onSelect={onSelectSession}
              onDelete={onDeleteSession}
            />
          ))}
        </div>
      </aside>
    </>
  );
}

function SidebarHeader({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
      <span className="font-semibold text-gray-800 text-sm">チャット履歴</span>
      <button
        onClick={onClose}
        className="p-1.5 rounded-md hover:bg-gray-200 text-gray-500 transition-colors"
      >
        <XIcon size={18} />
      </button>
    </div>
  );
}

interface SessionItemProps {
  session: ChatSession;
  isActive: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
}

function SessionItem({
  session,
  isActive,
  onSelect,
  onDelete,
}: SessionItemProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleting(true);
    try {
      await onDelete(session.id);
    } finally {
      setDeleting(false);
      setPopoverOpen(false);
    }
  };

  return (
    <div className="relative group">
      <button
        onClick={() => onSelect(session.id)}
        className={`
          w-full text-left px-3 py-2.5 rounded-lg transition-colors pr-8
          ${
            isActive
              ? "bg-blue-50 border border-blue-200 text-blue-900"
              : "hover:bg-gray-100 text-gray-700"
          }
        `}
      >
        <div className="flex items-start gap-2">
          <MessageSquareIcon size={15} className="mt-0.5 shrink-0 opacity-60" />
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{session.title}</div>
            <div className="text-xs text-gray-400 mt-0.5 truncate">
              {session.lastMessage || "（メッセージなし）"}
            </div>
          </div>
        </div>
        <div className="text-xs text-gray-400 mt-1 pl-5">
          {formatTimestamp(session.timestamp)}
        </div>
      </button>

      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setPopoverOpen(true);
            }}
            className={`
              absolute right-1.5 top-1/2 -translate-y-1/2
              p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-200
              opacity-0 group-hover:opacity-100 transition-opacity
              ${popoverOpen ? "opacity-100" : ""}
            `}
          >
            <MoreHorizontalIcon size={15} />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" side="right" className="w-52 p-2">
          <p className="text-xs text-gray-500 px-2 py-1 mb-1">
            このチャットを削除しますか？
          </p>
          <div className="flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setPopoverOpen(false);
              }}
              className="flex-1 px-3 py-1.5 text-xs rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
            >
              <Trash2Icon size={12} />
              {deleting ? "削除中..." : "削除"}
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
