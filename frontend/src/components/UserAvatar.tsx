import { UserIcon } from 'lucide-react'

export function UserAvatar() {
  return (
    <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
      <UserIcon size={14} className="text-gray-600" />
    </div>
  )
}
