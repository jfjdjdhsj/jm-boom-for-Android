import { LogInIcon, UserIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export function GuestPanel({ onLogin }: { onLogin: () => void }) {
  return (
    <section className="flex min-h-[420px] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-6 text-center">
          <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-muted">
            <UserIcon className="size-8 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold tracking-normal">尚未登录</h2>
            <p className="text-sm text-muted-foreground">登录后查看等级、金币、收藏容量和签到记录。</p>
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
