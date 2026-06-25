import { useMutation, useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import {
  BookmarkIcon,
  CalendarCheckIcon,
  CheckIcon,
  CoinsIcon,
  HistoryIcon,
  LoaderCircleIcon,
  LogInIcon,
  LogOutIcon,
  MessageCircleIcon,
  RefreshCwIcon,
  ShieldHalfIcon,
  TrendingUpIcon,
  UserIcon
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { LoginDialog } from '@/features/user/login-dialog'
import { getSignInData, signIn, type SignInDataResult, type SignInRecord } from '@/lib/api/user'
import { cn } from '@/lib/utils'
import { useUserStore } from '@/stores/user-store'

export const Route = createFileRoute('/_app/me')({
  component: ProfilePage
})

function ProfilePage() {
  const user = useUserStore(state => state.user)
  const endpoint = useUserStore(state => state.endpoint)
  const logout = useUserStore(state => state.logout)
  const [isLoginOpen, setIsLoginOpen] = useState(false)
  const signInData = useQuery({
    queryKey: ['jm-sign-in-data', endpoint, user?.id],
    queryFn: async () => {
      if (!user) {
        throw new Error('请先登录')
      }

      return getSignInData({ userId: user.id, endpoint })
    },
    enabled: user != null,
    staleTime: 2 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false
  })
  const signInMutation = useMutation({
    mutationFn: async () => {
      const dailyId = signInData.data?.dailyId

      if (!user || !dailyId) {
        throw new Error('签到信息尚未准备好')
      }

      return signIn({ userId: user.id, dailyId, endpoint })
    },
    onSuccess: result => {
      toast.success(result.message || '签到成功')
      void signInData.refetch()
    },
    onError: error => {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  })

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-6xl space-y-8 p-[96px_32px_32px_96px]">
        <header className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-normal">个人中心</h1>
            <p className="mt-2 text-sm text-muted-foreground">账户信息、签到记录和常用入口</p>
          </div>
          {user ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => signInData.refetch()}
                disabled={signInData.isFetching}
              >
                {signInData.isFetching ? (
                  <LoaderCircleIcon className="size-4 animate-spin" />
                ) : (
                  <RefreshCwIcon className="size-4" />
                )}
                刷新
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void logout()
                  toast.success('已退出登录')
                }}
              >
                <LogOutIcon className="size-4" />
                退出
              </Button>
            </div>
          ) : null}
        </header>

        {user ? (
          <div className="grid grid-cols-[320px_minmax(0,1fr)] gap-6">
            <ProfileSummary />
            <div className="min-w-0 space-y-6">
              <SignInPanel
                data={signInData.data}
                isLoading={signInData.isLoading}
                error={signInData.error}
                isSigning={signInMutation.isPending}
                onRetry={() => signInData.refetch()}
                onSignIn={() => signInMutation.mutate()}
              />
              <ProfileMenu />
            </div>
          </div>
        ) : (
          <GuestPanel onLogin={() => setIsLoginOpen(true)} />
        )}
      </div>

      <LoginDialog open={isLoginOpen} onOpenChange={setIsLoginOpen} />
    </main>
  )
}

function GuestPanel({ onLogin }: { onLogin: () => void }) {
  return (
    <section className="flex min-h-[420px] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-6 text-center">
          <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-muted">
            <UserIcon className="size-8 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold tracking-normal">尚未登录</h2>
            <p className="text-sm text-muted-foreground">
              登录后查看等级、金币、收藏容量和签到记录。
            </p>
          </div>
          <Button className="w-full" onClick={onLogin}>
            <LogInIcon className="size-4" />
            登录
          </Button>
        </CardContent>
      </Card>
    </section>
  )
}

function ProfileSummary() {
  const user = useUserStore(state => state.user)

  if (!user) {
    return null
  }

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
            {user.email ? (
              <p className="mt-1 truncate text-xs text-muted-foreground">{user.email}</p>
            ) : null}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>等级进度</span>
            <span>{Math.round(user.expPercent)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.min(Math.max(user.expPercent, 0), 100)}%` }}
            />
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

function SignInPanel({
  data,
  isLoading,
  error,
  isSigning,
  onRetry,
  onSignIn
}: {
  data?: SignInDataResult
  isLoading: boolean
  error: Error | null
  isSigning: boolean
  onRetry: () => void
  onSignIn: () => void
}) {
  const streak = useMemo(() => longestStreak(data?.records ?? []), [data])
  const todayRecord = useMemo(() => findTodayRecord(data?.records ?? []), [data])

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarCheckIcon className="size-4" />
            每日签到
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {data?.eventName || '每日签到活动'} • 连续签到 {streak} 天
          </p>
        </div>
        <Button
          size="sm"
          onClick={onSignIn}
          disabled={isLoading || isSigning || todayRecord?.signed}
        >
          {isSigning ? (
            <LoaderCircleIcon className="size-4 animate-spin" />
          ) : (
            <CheckIcon className="size-4" />
          )}
          {todayRecord?.signed ? '已签到' : '签到'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        {isLoading ? (
          <div className="flex h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
            <LoaderCircleIcon className="size-4 animate-spin" />
            正在加载签到数据
          </div>
        ) : error ? (
          <div className="flex h-32 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
            <span>{error.message}</span>
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RefreshCwIcon className="size-4" />
              重试
            </Button>
          </div>
        ) : data ? (
          <>
            <SignInCalendar records={data.records} />
            <div className="grid grid-cols-3 gap-3 text-sm">
              <BonusItem label="当前进度" value={data.currentProgress || `${streak} 天`} />
              <BonusItem
                label="三天奖励"
                value={`${data.threeDaysCoin} 金币 / ${data.threeDaysExp} 经验`}
              />
              <BonusItem
                label="七天奖励"
                value={`${data.sevenDaysCoin} 金币 / ${data.sevenDaysExp} 经验`}
              />
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}

function SignInCalendar({ records }: { records: SignInRecord[] }) {
  const calendar = useMemo(() => buildSignInCalendar(records), [records])

  return (
    <div className="min-w-0 pb-1">
      <div className="flex w-max max-w-full gap-1">
        {calendar.weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-rows-7 gap-1">
            {week.map((day, dayIndex) =>
              day ? (
                <Tooltip key={day.isoDate}>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        'size-3 rounded-[2px] border border-border/60 bg-muted/30 transition-colors outline-none',
                        day.hasRecord && 'bg-muted/70',
                        day.signed && 'border-emerald-500/60 bg-emerald-500',
                        day.bonus && 'border-yellow-400'
                      )}
                    />
                  </TooltipTrigger>
                  <TooltipContent>{day.tooltip}</TooltipContent>
                </Tooltip>
              ) : (
                <div key={`empty-${weekIndex}-${dayIndex}`} className="size-3 rounded-[2px]" />
              )
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

type SignInCalendarDay = {
  isoDate: string
  label: string
  signed: boolean
  bonus: boolean
  hasRecord: boolean
  tooltip: string
}

function buildSignInCalendar(records: SignInRecord[]) {
  const today = startOfDay(new Date())
  const currentMonth = today.getMonth()
  const currentYear = today.getFullYear()
  const currentMonthStart = new Date(currentYear, currentMonth, 1)
  const currentMonthEnd = new Date(currentYear, currentMonth + 1, 0)
  const start = startOfWeek(addMonths(currentMonthStart, -5))
  const end = endOfWeek(currentMonthEnd)
  const recordMap = new Map<string, SignInRecord>(
    records.flatMap(record => {
      const recordDate = normalizeSignInRecordDate(record)

      return recordDate ? [[recordDate, record] as const] : []
    })
  )
  const currentMonthFallbackMap = new Map(records.map(record => [record.day, record]))
  const days: Array<SignInCalendarDay | null> = []

  for (let date = new Date(start); date <= end; date = addDays(date, 1)) {
    const isoDate = toIsoDate(date)
    const isCurrentMonth = date.getFullYear() === currentYear && date.getMonth() === currentMonth
    const record =
      recordMap.get(isoDate) ??
      (isCurrentMonth ? currentMonthFallbackMap.get(date.getDate()) : undefined)
    const status = record ? (record.signed ? '已签到' : '未签到') : '无本地记录'

    days.push({
      isoDate,
      label: formatChineseDate(date),
      signed: record?.signed ?? false,
      bonus: record?.bonus ?? false,
      hasRecord: record != null,
      tooltip: `${formatChineseDate(date)}：${status}${record?.bonus ? '，额外奖励' : ''}`
    })
  }

  while (days.length % 7 !== 0) {
    days.push(null)
  }

  const weeks: Array<Array<SignInCalendarDay | null>> = []

  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7))
  }

  return { weeks }
}

function normalizeSignInRecordDate(record: SignInRecord) {
  const date = record.date.trim()

  if (!date) {
    return null
  }

  const match = /^(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})/.exec(date)

  if (!match) {
    return null
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function addMonths(date: Date, months: number) {
  const next = new Date(date)
  next.setMonth(next.getMonth() + months)
  return next
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function startOfWeek(date: Date) {
  const next = startOfDay(date)
  const offset = (next.getDay() + 6) % 7
  next.setDate(next.getDate() - offset)
  return next
}

function endOfWeek(date: Date) {
  const next = startOfDay(date)
  const offset = (7 - next.getDay()) % 7
  next.setDate(next.getDate() + offset)
  return next
}

function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatChineseDate(date: Date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

function BonusItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/70 bg-muted/30 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 truncate font-medium">{value}</div>
    </div>
  )
}

function ProfileMenu() {
  const items = [
    { icon: BookmarkIcon, label: '我的收藏', disabled: true },
    { icon: HistoryIcon, label: '历史观看', disabled: true },
    { icon: MessageCircleIcon, label: '我的评论', disabled: true }
  ]

  return (
    <Card>
      <CardContent className="grid grid-cols-3 gap-3">
        {items.map(item => (
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

function longestStreak(records: SignInRecord[]) {
  let best = 0
  let current = 0

  for (const record of records) {
    if (record.signed) {
      current += 1
      best = Math.max(best, current)
    } else {
      current = 0
    }
  }

  return best
}

function findTodayRecord(records: SignInRecord[]) {
  const today = new Date().getDate()

  return records.find(record => record.day === today)
}
