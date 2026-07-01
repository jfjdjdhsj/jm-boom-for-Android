import { Link } from '@tanstack/react-router'
import type { LucideIcon } from 'lucide-react'
import { Fragment, type MouseEvent } from 'react'

import { buttonVariants } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { FileRoutesByTo } from '@/routeTree.gen'

type FloatingNavTo = keyof FileRoutesByTo

export type FloatingNavItem = {
  id: string
  icon: LucideIcon
  label: string
  to: FloatingNavTo
  separatorBefore?: boolean
}

type FloatingNavProps = {
  items: FloatingNavItem[]
  activeId: string
  onItemClick: (item: FloatingNavItem, event: MouseEvent<HTMLAnchorElement>) => void
}

export function FloatingNav({ items, activeId, onItemClick }: FloatingNavProps) {
  if (items.length === 0) return null

  return (
    <nav className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-50 rounded-2xl border border-border/70 bg-background/85 p-1 shadow-lg backdrop-blur md:top-1/2 md:right-auto md:bottom-auto md:left-6 md:w-auto md:-translate-y-1/2 md:rounded-full md:bg-background/40 md:shadow-none">
      <ul className="flex items-center gap-1 overflow-x-auto md:flex-col md:overflow-visible">
        {items.map(item => (
          <Fragment key={item.id}>
            {item.separatorBefore ? (
              <li aria-hidden="true" className="mx-1 h-6 w-px shrink-0 bg-border/70 md:my-1 md:h-px md:w-6" />
            ) : null}
            <NavItem item={item} isActive={item.id === activeId} onItemClick={onItemClick} />
          </Fragment>
        ))}
      </ul>
    </nav>
  )
}

type NavItemProps = {
  item: FloatingNavItem
  isActive: boolean
  onItemClick: (item: FloatingNavItem, event: MouseEvent<HTMLAnchorElement>) => void
}

function NavItem({ item, isActive, onItemClick }: NavItemProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onItemClick(item, event)
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          to={item.to}
          onClick={handleClick}
          aria-label={item.label}
          className={buttonVariants({
            variant: isActive ? 'default' : 'ghost',
            size: 'icon',
            className: 'shrink-0'
          })}
        >
          <item.icon className="size-4" />
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  )
}
