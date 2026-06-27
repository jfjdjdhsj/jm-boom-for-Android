import { BookmarkIcon, CoinsIcon, ShieldHalfIcon, TrendingUpIcon } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import type { UserProfile } from '@/lib/api/user'

export function ProfileSummaryCard({ user }: { user: UserProfile }) {
  const stats = [
    {
      icon: TrendingUpIcon,
      label: '经验',
      value: `${user.currentLevelExp}/${user.nextLevelExp}`
    },
    {
      icon: ShieldHalfIcon,
      label: '等级',
      value: `${user.level}（${user.levelName || '未命名'}）`
    },
    {
      icon: CoinsIcon,
      label: '金币',
      value: user.jCoin.toLocaleString('zh-CN')
    },
    {
      icon: BookmarkIcon,
      label: '收藏',
      value: `${user.currentCollectCount}/${user.maxCollectCount}`
    }
  ]
  const progress = Math.min(Math.max(user.expPercent, 0), 100)

  return (
    <Card className="h-fit">
      <CardContent className="space-y-6">
        <div className="flex items-center gap-4">
          <Avatar className="size-20">
            <AvatarImage src={user.avatarUrl} alt={`${user.username}的头像`} />
            <AvatarFallback>{user.username.slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold tracking-normal">{user.username}</h2>
            <p className="mt-1 truncate text-sm text-muted-foreground">UID {user.id}</p>
            {user.email ? <p className="mt-1 truncate text-xs text-muted-foreground">{user.email}</p> : null}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>等级进度</span>
            <span>{Math.round(user.expPercent)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {stats.map(item => (
            <div
              key={item.label}
              className="flex flex-col gap-2 rounded-md border border-border/70 bg-muted/30 p-3"
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <item.icon className="size-4" />
                {item.label}
              </div>
              <div className="truncate text-sm">{item.value}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
