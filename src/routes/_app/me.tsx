import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { BadgeCheckIcon } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/page-header'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { LogoutConfirmDialog } from '@/features/me/logout-confirm-dialog'
import { useMeSignIn } from '@/features/me/use-me-sign-in'
import { useSettingsStore } from '@/stores/settings-store'
import { useUserStore } from '@/stores/user-store'

export const Route = createFileRoute('/_app/me')({
  beforeLoad: () => {
    if (!useUserStore.getState().user) {
      throw redirect({ to: '/' })
    }
  },
  component: MePage
})

function MePage() {
  const navigate = useNavigate()
  const user = useUserStore(state => state.user)
  const endpoint = useSettingsStore(state => state.api)
  const logout = useUserStore(state => state.logout)
  const signInState = useMeSignIn({ user, endpoint })
  const autoSignInKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (
      !user ||
      !signInState.data ||
      signInState.isLoading ||
      signInState.isFetching ||
      signInState.isSigning ||
      signInState.todayRecord?.signed
    ) {
      return
    }

    const autoSignInKey = `${endpoint ?? ''}:${user.id}:${new Date().toDateString()}`

    if (autoSignInKeyRef.current === autoSignInKey) {
      return
    }

    autoSignInKeyRef.current = autoSignInKey
    signInState.submitSignIn()
  }, [endpoint, signInState, user])

  if (!user) {
    return null
  }

  async function handleLogout() {
    try {
      await logout()
      toast.success('已退出登录')
      void navigate({ to: '/' })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <main className="app-page">
      <div className="app-page-content flex min-h-dvh max-w-6xl flex-col">
        <PageHeader title="个人中心" desc="展示用户信息">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" disabled>
              <BadgeCheckIcon className="size-4" />
              {signInState.isSigning
                ? '签到中'
                : signInState.todayRecord?.signed
                  ? '已签到'
                  : '未签到'}
            </Button>
            <LogoutConfirmDialog onConfirm={() => void handleLogout()} />
          </div>
        </PageHeader>

        <div className="flex flex-1 flex-col items-center justify-center py-10">
          <Avatar className="size-32">
            <AvatarImage src={user.avatarUrl} />
            <AvatarFallback>{user.username.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="mt-4 flex flex-col items-center gap-2">
            <h2 className="max-w-full truncate text-center text-3xl font-bold sm:text-4xl">
              {user.username}
            </h2>
            <p className="text-sm text-muted-foreground">UID {user.id}</p>
          </div>

          <div className="mt-12 grid w-full max-w-3xl grid-cols-2 gap-6 sm:grid-cols-4 sm:gap-8 lg:gap-16">
            {[
              {
                label: '经验',
                value: `${user.currentLevelExp}/${user.nextLevelExp}`
              },
              {
                label: '等级',
                value: `${user.level}（${user.levelName || '未命名'}）`
              },
              {
                label: '金币',
                value: user.jCoin.toLocaleString('zh-CN')
              },
              {
                label: '收藏',
                value: `${user.currentCollectCount}/${user.maxCollectCount}`
              }
            ].map(item => (
              <div key={item.label} className="flex min-w-0 flex-col items-center gap-2">
                <div className="text-sm text-muted-foreground">{item.label}</div>
                <div className="max-w-full truncate text-xl font-bold">{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
