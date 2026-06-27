import {
  CalendarCheckIcon,
  CheckIcon,
  LoaderCircleIcon,
  RefreshCwIcon
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { SignInDataResult, SignInRecord } from '@/lib/api/user'

import { SignInCalendar } from './sign-in-calendar'

type SignInPanelProps = {
  data?: SignInDataResult
  error: Error | null
  isLoading: boolean
  isSigning: boolean
  streak: number
  todayRecord?: SignInRecord
  onRetry: () => void
  onSignIn: () => void
}

export function SignInPanel({
  data,
  error,
  isLoading,
  isSigning,
  streak,
  todayRecord,
  onRetry,
  onSignIn
}: SignInPanelProps) {
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
        <Button size="sm" onClick={onSignIn} disabled={isLoading || isSigning || todayRecord?.signed}>
          {isSigning ? <LoaderCircleIcon className="size-4 animate-spin" /> : <CheckIcon className="size-4" />}
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
              <BonusItem label="三天奖励" value={`${data.threeDaysCoin} 金币 / ${data.threeDaysExp} 经验`} />
              <BonusItem label="七天奖励" value={`${data.sevenDaysCoin} 金币 / ${data.sevenDaysExp} 经验`} />
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}

function BonusItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/70 bg-muted/30 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 truncate font-medium">{value}</div>
    </div>
  )
}
