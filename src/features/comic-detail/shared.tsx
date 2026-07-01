import { ChevronUpIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

import { StatePanel } from '@/components/comic-feed'
import { Button } from '@/components/ui/button'
import { COMMENT_SKELETON_COUNT } from './constants'

export { ComicCover } from '@/components/comic-cover'

export function BackTop() {
  const isVisible = useBackTopVisibility(560)

  if (!isVisible) {
    return null
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label="回到顶部"
      className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-50 bg-background/80 backdrop-blur md:right-8 md:bottom-8"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    >
      <ChevronUpIcon className="size-4" />
    </Button>
  )
}

export function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-normal">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

export function ComicDetailSkeleton() {
  return (
    <div className="space-y-10">
      <section className="grid gap-5 md:grid-cols-[240px_minmax(0,1fr)] md:gap-8">
        <div className="mx-auto aspect-[3/4] w-full max-w-[240px] animate-pulse rounded-md bg-muted md:max-w-none" />
        <div className="space-y-5 py-1">
          <div className="h-5 w-56 animate-pulse rounded bg-muted" />
          <div className="space-y-3">
            <div className="h-10 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-4 w-64 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-px bg-border" />
          <div className="h-24 max-w-3xl animate-pulse rounded-md bg-muted" />
          <div className="h-px bg-border" />
          <div className="space-y-2">
            <div className="h-4 max-w-3xl animate-pulse rounded bg-muted" />
            <div className="h-4 max-w-2xl animate-pulse rounded bg-muted" />
            <div className="h-4 max-w-xl animate-pulse rounded bg-muted" />
          </div>
        </div>
      </section>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-8">
          <ChapterSkeletonList />
        </div>
        <div className="h-80 animate-pulse rounded-xl bg-muted" />
      </div>
    </div>
  )
}

export function CommentSkeletonList() {
  return (
    <div className="space-y-3">
      {Array.from({ length: COMMENT_SKELETON_COUNT }).map((_, index) => (
        <div key={index} className="space-y-3 px-px py-1">
          <div className="space-y-2">
            <div className="h-4 w-40 animate-pulse rounded bg-muted" />
            <div className="h-3 w-24 animate-pulse rounded bg-muted" />
          </div>
          <div className="space-y-2">
            <div className="h-4 animate-pulse rounded bg-muted" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  )
}

export { StatePanel }

function ChapterSkeletonList() {
  return (
    <section className="space-y-4">
      <div className="space-y-2">
        <div className="h-6 w-24 animate-pulse rounded bg-muted" />
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-18 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </section>
  )
}

function useBackTopVisibility(threshold: number) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    let frame = 0

    function updateVisibility() {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        setIsVisible(window.scrollY > threshold)
      })
    }

    updateVisibility()
    window.addEventListener('scroll', updateVisibility, { passive: true })

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', updateVisibility)
    }
  }, [threshold])

  return isVisible
}
