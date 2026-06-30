import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ChevronRightIcon, ChevronUpIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { ComicGrid, ComicGridSkeleton, FeedHeader, StatePanel } from '@/components/comic-feed'
import { Button } from '@/components/ui/button'
import { getHomeFeed, type HomeFeedSection, type HomeSectionListMode } from '@/lib/api/home'
import { LIST_QUERY_GC_TIME, LIST_QUERY_STALE_TIME } from '@/lib/query-cache'
import { queryKeys } from '@/lib/query-keys'
import { cn } from '@/lib/utils'
import { useSettingsStore } from '@/stores/settings-store'

export const Route = createFileRoute('/_app/')({
  component: HomePage
})

const HOME_SECTION_PREVIEW_LIMIT = 8
const EMPTY_HOME_SECTIONS: HomeFeedSection[] = []

function HomePage() {
  const endpoint = useSettingsStore(state => state.api)
  const homeFeed = useQuery({
    queryKey: queryKeys.homeFeed(endpoint),
    queryFn: () => getHomeFeed(endpoint),
    staleTime: LIST_QUERY_STALE_TIME,
    gcTime: LIST_QUERY_GC_TIME,
    refetchOnMount: false,
    refetchOnWindowFocus: false
  })
  const sections = homeFeed.data?.sections ?? EMPTY_HOME_SECTIONS

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="grid grid-cols-[minmax(0,1fr)_180px] gap-8 p-[96px_32px_16px_96px]">
        <div className="min-w-0 space-y-10">
          <FeedHeader
            title="首页"
            description="精选漫画作品"
            isFetching={homeFeed.isFetching}
            onRefresh={() => homeFeed.refetch()}
          />

          {homeFeed.isLoading ? (
            <HomeFeedSkeleton />
          ) : homeFeed.isError ? (
            <StatePanel
              title="信息流加载失败"
              description={homeFeed.error.message}
              onRetry={() => homeFeed.refetch()}
            />
          ) : sections.length === 0 ? (
            <StatePanel title="暂无信息流内容" description="当前接口没有返回可展示的分组。" />
          ) : (
            <HomeFeedSections sections={sections} />
          )}
        </div>

        {sections.length > 0 ? <HomeFeedDirectory sections={sections} /> : null}
      </div>
      <BackTop />
    </main>
  )
}

function HomeFeedSections({ sections }: { sections: HomeFeedSection[] }) {
  return (
    <>
      {sections.map(section => {
        const previewItems = section.items.slice(0, HOME_SECTION_PREVIEW_LIMIT)

        return (
          <section key={section.id} id={homeSectionId(section)} className="scroll-mt-8 space-y-6">
            <SectionHeader section={section} />
            {section.items.length === 0 ? (
              <StatePanel title="暂无内容" description="当前分组没有返回可展示的漫画。" />
            ) : (
              <ComicGrid items={previewItems} />
            )}
          </section>
        )
      })}
    </>
  )
}

function SectionHeader({ section }: { section: HomeFeedSection }) {
  const mode = resolveSectionListMode(section)
  const rankTag = mode === 'ranking' ? resolveSectionRankingTag(section) : ''

  return (
    <div className="flex items-end justify-between gap-3">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-normal">{section.title}</h2>
      </div>
      {mode ? (
        <Button asChild variant="outline" size="sm">
          <Link
            to="/list"
            search={{
              mode,
              sectionId: section.id,
              title: section.title,
              slug: section.slug,
              type: section.type,
              filterValue: section.filterValue,
              rankTag
            }}
          >
            查看更多
            <ChevronRightIcon className="size-4" />
          </Link>
        </Button>
      ) : null}
    </div>
  )
}

function HomeFeedDirectory({ sections }: { sections: HomeFeedSection[] }) {
  const sectionIds = useMemo(() => sections.map(homeSectionId), [sections])
  const [activeSectionId, setActiveSectionId] = useActiveHomeSection(sectionIds)

  return (
    <nav className="sticky top-24 h-fit bg-background/80 p-2 text-xs backdrop-blur">
      <div className="px-2 py-1 font-medium text-muted-foreground">导航</div>
      <div className="space-y-1">
        {sections.map(section => {
          const sectionId = homeSectionId(section)
          const isActive = activeSectionId === sectionId

          return (
            <a
              key={section.id}
              href={`#${sectionId}`}
              onClick={event => {
                event.preventDefault()
                setActiveSectionId(sectionId)
                scrollToElement(sectionId)
              }}
              className={cn(
                'block truncate rounded-sm px-2 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                isActive && 'bg-muted font-medium text-foreground'
              )}
            >
              {section.title}
            </a>
          )
        })}
      </div>
    </nav>
  )
}

function BackTop() {
  const isVisible = useBackTopVisibility()

  if (!isVisible) {
    return null
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label="回到顶部"
      className="fixed right-8 bottom-8 z-50 bg-background/80 backdrop-blur"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    >
      <ChevronUpIcon className="size-4" />
    </Button>
  )
}

function HomeFeedSkeleton() {
  return (
    <>
      {Array.from({ length: 2 }).map((_, index) => (
        <section key={index} className="space-y-6">
          <div className="space-y-2">
            <div className="h-6 w-40 animate-pulse rounded bg-muted" />
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          </div>
          <ComicGridSkeleton />
        </section>
      ))}
    </>
  )
}

function homeSectionId(section: HomeFeedSection) {
  return `home-section-${section.id}`
}

function resolveSectionListMode(section: HomeFeedSection): HomeSectionListMode | null {
  const title = section.title.trim()
  const lower = `${section.id} ${section.slug} ${section.type} ${section.filterValue}`.toLowerCase()

  if (
    title.includes('推荐') ||
    title.includes('推薦') ||
    section.id === '30' ||
    title === '禁漫去码&全彩化' ||
    title === '禁漫去碼&全彩化'
  ) {
    return 'promote'
  }

  if (section.id === '26' || title.endsWith('连载更新') || title.endsWith('連載更新')) {
    return 'weekly'
  }

  if (
    section.id === '998' ||
    section.id === '999' ||
    section.id === '1000' ||
    title === '禁漫汉化组' ||
    title === '禁漫漢化組' ||
    title === '韩漫更新' ||
    title === '韓漫更新' ||
    title === '其他更新'
  ) {
    return 'ranking'
  }

  if (title.includes('最新') || lower.includes('latest')) {
    return 'latest'
  }

  return null
}

function resolveSectionRankingTag(section: HomeFeedSection) {
  const title = section.title.trim()

  if (section.id === '998' || title === '禁漫汉化组' || title === '禁漫漢化組') {
    return '禁漫汉化组'
  }

  if (section.id === '999' || title === '韩漫更新' || title === '韓漫更新') {
    return 'hanManTypeMap'
  }

  if (section.id === '1000' || title === '其他更新') {
    return 'qiTaLeiTypeMap'
  }

  return ''
}

function scrollToElement(sectionId: string) {
  document.getElementById(sectionId)?.scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  })
}

function useBackTopVisibility() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    let frame = 0

    function updateVisibility() {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        setIsVisible(window.scrollY > 480)
      })
    }

    updateVisibility()
    window.addEventListener('scroll', updateVisibility, { passive: true })

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', updateVisibility)
    }
  }, [])

  return isVisible
}

function useActiveHomeSection(sectionIds: string[]) {
  const [activeSectionId, setActiveSectionId] = useState(sectionIds[0] ?? '')

  useEffect(() => {
    setActiveSectionId(current =>
      current !== '' && sectionIds.includes(current) ? current : (sectionIds[0] ?? '')
    )
  }, [sectionIds])

  useEffect(() => {
    if (sectionIds.length === 0) {
      return
    }

    let frame = 0

    function updateActiveSection() {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const topOffset = 120
        let nextActiveSectionId = sectionIds[0]

        for (const sectionId of sectionIds) {
          const element = document.getElementById(sectionId)

          if (element == null) {
            continue
          }

          if (element.getBoundingClientRect().top > topOffset) {
            break
          }

          nextActiveSectionId = sectionId
        }

        setActiveSectionId(nextActiveSectionId)
      })
    }

    updateActiveSection()
    window.addEventListener('scroll', updateActiveSection, { passive: true })
    window.addEventListener('resize', updateActiveSection)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', updateActiveSection)
      window.removeEventListener('resize', updateActiveSection)
    }
  }, [sectionIds])

  return [activeSectionId, setActiveSectionId] as const
}
