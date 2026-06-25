import { FaBookmark } from 'react-icons/fa'
import { FiBookmark } from 'react-icons/fi'
import { cn } from '@/lib/utils'

type BookmarkIconProps = {
  active: boolean
  className?: string
}

export function BookmarkIcon({ active, className }: BookmarkIconProps) {
  if (active) {
    return <FaBookmark className={cn('text-emerald-600', className)} />
  }

  return <FiBookmark className={cn('text-black dark:text-white', className)} />
}
