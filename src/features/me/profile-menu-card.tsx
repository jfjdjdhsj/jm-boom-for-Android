import { BookmarkIcon, HistoryIcon, MessageCircleIcon } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'

const PROFILE_MENU_ITEMS = [
  { icon: BookmarkIcon, label: '我的收藏', disabled: true },
  { icon: HistoryIcon, label: '历史观看', disabled: true },
  { icon: MessageCircleIcon, label: '我的评论', disabled: true }
] as const

export function ProfileMenuCard() {
  return (
    <Card>
      <CardContent className="grid grid-cols-3 gap-3">
        {PROFILE_MENU_ITEMS.map(item => (
          <button
            key={item.label}
            type="button"
            disabled={item.disabled}
            className="flex items-center gap-3 rounded-md border border-border/70 bg-muted/20 p-4 text-left text-sm transition-colors enabled:hover:bg-muted disabled:opacity-60"
          >
            <item.icon className="size-4 text-muted-foreground" />
            {item.label}
          </button>
        ))}
      </CardContent>
    </Card>
  )
}
