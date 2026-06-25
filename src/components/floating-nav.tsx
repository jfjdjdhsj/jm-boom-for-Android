import { Link } from '@tanstack/react-router'
import type { LucideIcon } from 'lucide-react'
import type { MouseEvent } from 'react'

import { ThemeToggle } from '@/components/theme-toggle'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type FloatingNavItem = {
  id: string
  icon: LucideIcon
  label: string
  to: '/' | '/weekly' | '/favorites' | '/me'
}

type FloatingNavProps = {
  items: FloatingNavItem[]
  activeId?: string
  className?: string
  onItemClick?: (item: FloatingNavItem, event: MouseEvent<HTMLAnchorElement>) => void
}

export function FloatingNav({ items, activeId, className, onItemClick }: FloatingNavProps) {
  const currentId = activeId ?? items[0]?.id

  if (items.length === 0) {
    return null
  }

  return (
    <div
      className={cn(
        'fixed left-1/2 z-50 -translate-x-1/2 rounded-full border border-border/70 bg-background/90 p-1 backdrop-blur',
        className
      )}
    >
      <div className="flex items-center gap-1 sm:flex-col">
        {items.map(item => {
          const isActive = item.id === currentId

          return (
            <Link
              key={item.id}
              to={item.to}
              onClick={event => onItemClick?.(item, event)}
              className={cn(
                buttonVariants({
                  variant: isActive ? 'default' : 'ghost',
                  size: 'icon'
                }),
                'rounded-full border border-transparent'
              )}
            >
              <item.icon className="size-4" />
            </Link>
          )
        })}
        <div className="mx-1 h-5 w-px bg-border sm:mx-0 sm:my-1 sm:h-px sm:w-5" />
        <ThemeToggle />
      </div>
    </div>
  )
}
