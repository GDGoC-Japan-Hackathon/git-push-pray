import { MenuIcon } from 'lucide-react'
import { BotAvatar } from './BotAvatar'

interface Props {
  title: string | null
  onMenuClick: () => void
}

export function Header({ title, onMenuClick }: Props) {
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
        <span className="font-semibold text-gray-800 text-sm">AI アシスタント</span>
      </div>
      {title && (
        <span className="text-sm text-gray-400 truncate ml-2">{title}</span>
      )}
    </header>
  )
}
