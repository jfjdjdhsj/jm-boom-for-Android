import { createFileRoute } from '@tanstack/react-router'
import { LoaderCircleIcon, LogOutIcon, RefreshCwIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { GuestPanel } from '@/features/me/guest-panel'
import { ProfileMenuCard } from '@/features/me/profile-menu-card'
import { ProfileSummaryCard } from '@/features/me/profile-summary-card'
import { SignInPanel } from '@/features/me/sign-in-panel'
import { useMeSignIn } from '@/features/me/use-me-sign-in'
import { LoginDialog } from '@/features/user/login-dialog'
import { useSettingsStore } from '@/stores/settings-store'
import { useUserStore } from '@/stores/user-store'

export const Route = createFileRoute('/_app/me')({
  component: MePage
})

function MePage() {
  const user = useUserStore(state => state.user)
  const endpoint = useSettingsStore(state => state.api)
  const logout = useUserStore(state => state.logout)
  const [isLoginOpen, setIsLoginOpen] = useState(false)
  const signInState = useMeSignIn({ user, endpoint })

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-6xl space-y-8 p-[96px_32px_32px_96px]">
        <PageHeader title="个人中心" desc="展示用户信息和其他常用入口">
          {user ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={signInState.refresh}
                disabled={signInState.isFetching}
              >
                {signInState.isFetching ? (
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
            </>
          ) : null}
        </PageHeader>

        {user ? (
          <div className="grid grid-cols-[320px_minmax(0,1fr)] gap-6">
            <ProfileSummaryCard user={user} />
            <div className="min-w-0 space-y-6">
              <SignInPanel
                data={signInState.data}
                error={signInState.error}
                isLoading={signInState.isLoading}
                isSigning={signInState.isSigning}
                streak={signInState.streak}
                todayRecord={signInState.todayRecord}
                onRetry={signInState.refresh}
                onSignIn={signInState.submitSignIn}
              />
              <ProfileMenuCard />
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
