import { BotIcon } from 'lucide-react'

interface Props {
  size?: 'sm' | 'lg'
}

export function BotAvatar({ size = 'sm' }: Props) {
  if (size === 'lg') {
    return (
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
        <BotIcon size={28} className="text-white" />
      </div>
    )
  }
  return (
    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0">
      <BotIcon size={14} className="text-white" />
    </div>
  )
}
