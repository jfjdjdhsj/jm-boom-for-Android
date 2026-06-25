import { createFileRoute, Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { CalendarDaysIcon, HeartIcon, HouseIcon, UserRoundIcon } from 'lucide-react'
import { useState } from 'react'

import { FloatingNav, type FloatingNavItem } from '@/components/floating-nav'
import { LoginDialog } from '@/features/user/login-dialog'
import { useUserStore } from '@/stores/user-store'

export const Route = createFileRoute('/_app')({
  component: AppRoute
})

function AppRoute() {
  const navigate = useNavigate()
  const user = useUserStore(state => state.user)
  const [isLoginOpen, setIsLoginOpen] = useState(false)
  const pathname = useRouterState({
    select: state => state.location.pathname
  })

  const items: FloatingNavItem[] = [
    { id: 'home', icon: HouseIcon, label: 'Home', to: '/' },
    { id: 'weekly', icon: CalendarDaysIcon, label: 'Weekly', to: '/weekly' },
    { id: 'favorites', icon: HeartIcon, label: 'Favorites', to: '/favorites' },
    { id: 'me', icon: UserRoundIcon, label: 'Me', to: '/me' }
  ]

  const activeId = pathname.startsWith('/favorites')
    ? 'favorites'
    : pathname.startsWith('/me')
      ? 'me'
      : pathname.startsWith('/weekly')
        ? 'weekly'
        : 'home'

  return (
    <div className="relative h-screen">
      <FloatingNav
        items={items}
        activeId={activeId}
        onItemClick={(item, event) => {
          if (item.id !== 'me' || user) {
            return
          }

          event.preventDefault()
          setIsLoginOpen(true)
        }}
        className="sm:top-1/2 sm:bottom-auto sm:left-6 sm:translate-x-0 sm:-translate-y-1/2"
      />
      <LoginDialog
        open={isLoginOpen}
        onOpenChange={setIsLoginOpen}
        onLoginSuccess={() => void navigate({ to: '/me' })}
      />
      <Outlet />
    </div>
  )
}
