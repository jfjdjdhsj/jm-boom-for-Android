import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { differenceInCalendarDays } from 'date-fns/differenceInCalendarDays'
import { format } from 'date-fns/format'
import { formatDistanceToNowStrict } from 'date-fns/formatDistanceToNowStrict'
import { isValid } from 'date-fns/isValid'
import { parse } from 'date-fns/parse'
import { enUS } from 'date-fns/locale/en-US'
import { zhCN } from 'date-fns/locale/zh-CN'
import {
  ArrowLeftIcon,
  BookOpenIcon,
  BookmarkIcon,
  ChevronUpIcon,
  DownloadIcon,
  EyeIcon,
  HeartIcon,
  ImageIcon,
  LayersIcon,
  LoaderCircleIcon,
  MessageCircleIcon,
  UserRoundIcon,
  type LucideIcon
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { StatePanel } from '@/components/comic-feed'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle
} from '@/components/ui/drawer'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
} from '@/components/ui/pagination'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  getComicComments,
  getComicDetail,
  type ComicChapter,
  type ComicComment,
  type ComicDetail,
  type RelatedComic
} from '@/lib/api/comic'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_app/comic/$comicId')({
  component: ComicDetailPage
})

const DETAIL_STALE_TIME = 10 * 60 * 1000
const DETAIL_GC_TIME = 60 * 60 * 1000
const COMMENTS_STALE_TIME = 2 * 60 * 1000
const COMMENTS_GC_TIME = 10 * 60 * 1000
const COMMENT_SKELETON_COUNT = 6
const CHAPTER_PAGE_SIZE = 10
const SHOW_COVER_MASK = true

function ComicDetailPage() {
  const { comicId } = Route.useParams()
  const router = useRouter()

  const detail = useQuery({
    queryKey: ['jm-comic-detail', comicId],
    queryFn: () => getComicDetail(comicId),
    staleTime: DETAIL_STALE_TIME,
    gcTime: DETAIL_GC_TIME,
    refetchOnMount: false,
    refetchOnWindowFocus: false
  })

  return (
    <main className="min-h-screen bg-background p-[48px_32px_32px_96px] text-foreground">
      <div className="mx-auto max-w-7xl space-y-8">
        <Button variant="ghost" size="sm" onClick={() => router.history.back()}>
          <ArrowLeftIcon className="size-4" />
          返回
        </Button>

        {detail.isLoading ? (
          <ComicDetailSkeleton />
        ) : detail.isError ? (
          <StatePanel
            title="详情加载失败"
            description={detail.error.message}
            onRetry={() => detail.refetch()}
          />
        ) : detail.data == null ? (
          <StatePanel title="暂无详情" description="当前作品没有返回可展示的详情。" />
        ) : (
          <ComicDetailView comic={detail.data.comic} />
        )}
      </div>
      <BackTop />
    </main>
  )
}

function ComicDetailView({ comic }: { comic: ComicDetail }) {
  const [isCommentsOpen, setIsCommentsOpen] = useState(false)
  const albumId = comic.seriesId || comic.id

  const commentsQuery = useInfiniteQuery({
    queryKey: ['jm-comic-comments', comic.id],
    queryFn: ({ pageParam }) => getComicComments({ comicId: comic.id, page: pageParam }),
    initialPageParam: 1,
    enabled: isCommentsOpen,
    staleTime: COMMENTS_STALE_TIME,
    gcTime: COMMENTS_GC_TIME,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    getNextPageParam: (lastPage, allPages) => {
      const loadedCount = allPages.reduce((sum, page) => sum + page.comments.length, 0)

      if (lastPage.comments.length === 0 || loadedCount >= lastPage.total) {
        return undefined
      }

      return lastPage.page + 1
    }
  })

  const comments = useMemo(
    () => commentsQuery.data?.pages.flatMap(page => page.comments) ?? [],
    [commentsQuery.data]
  )
  const commentTotal = commentsQuery.data?.pages[0]?.total ?? comic.commentTotal

  return (
    <div className="space-y-10">
      <ComicHero comic={comic} onCommentsClick={() => setIsCommentsOpen(true)} />

      <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-8">
        <div className="min-w-0">
          <ChaptersSection albumId={albumId} comicTitle={comic.title} chapters={comic.series} />
        </div>

        <aside className="sticky top-8 h-fit">
          <RelatedPanel items={comic.relatedList} />
        </aside>
      </div>

      <CommentsDrawer
        open={isCommentsOpen}
        onOpenChange={setIsCommentsOpen}
        state={{
          isLoading: commentsQuery.isLoading,
          isFetchingNextPage: commentsQuery.isFetchingNextPage,
          isError: commentsQuery.isError,
          errorMessage: commentsQuery.error?.message,
          total: commentTotal,
          comments,
          hasNextPage: commentsQuery.hasNextPage,
          onRetry: () => commentsQuery.refetch(),
          onLoadMore: () => commentsQuery.fetchNextPage({ cancelRefetch: false })
        }}
      />
    </div>
  )
}

function ComicHero({
  comic,
  onCommentsClick
}: {
  comic: ComicDetail
  onCommentsClick: () => void
}) {
  const authors = comic.author.length > 0 ? comic.author.join(' / ') : 'N/A'
  const albumId = comic.seriesId || comic.id
  const nextChapter = getNextChapter(comic.id, comic.series)
  const statusBadges = [
    comic.price > 0 ? `${comic.price} 积分` : '免费',
    comic.purchased ? '已购买' : '',
    comic.isFavorite ? '已收藏' : '',
    comic.liked ? '已点赞' : ''
  ].filter(Boolean)

  return (
    <section className="grid grid-cols-[240px_minmax(0,1fr)] gap-8">
      <ComicCover id={comic.id} title={comic.title} image={comic.image} className="w-full" />

      <div className="min-w-0 space-y-5 py-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="default">JM {comic.id}</Badge>
          {statusBadges.map(badge => (
            <Badge key={badge} variant="outline">
              {badge}
            </Badge>
          ))}
        </div>

        <div className="space-y-2">
          <h1 className="text-4xl leading-tight font-bold tracking-normal">{comic.title}</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <UserRoundIcon className="size-4" />
            <span className="truncate">{authors}</span>
          </div>
        </div>

        <Separator />

        <StatsRow comic={comic} onCommentsClick={onCommentsClick} />

        <Separator />

        <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
          {comic.description || '暂无简介'}
        </p>

        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link
              to="/reader/$comicId"
              params={{ comicId: comic.id }}
              search={{
                title: comic.title,
                chapter: '',
                albumId,
                nextId: nextChapter?.id ?? '',
                nextChapter: nextChapter?.title ?? ''
              }}
            >
              <BookOpenIcon className="size-4" />
              开始阅读
            </Link>
          </Button>
          <Button variant="outline" disabled>
            <BookmarkIcon className="size-4" />
            收藏
          </Button>
          <Button variant="outline" disabled>
            <DownloadIcon className="size-4" />
            下载
          </Button>
        </div>

        <div className="space-y-3">
          <PillGroup title="标签" items={comic.tags} />
          <PillGroup title="角色" items={comic.actors} variant="secondary" />
          <PillGroup title="作品" items={comic.works} variant="secondary" />
        </div>
      </div>
    </section>
  )
}

function StatsRow({ comic, onCommentsClick }: { comic: ComicDetail; onCommentsClick: () => void }) {
  const stats: Array<{
    id: string
    label: string
    value: string
    icon: LucideIcon
    onClick?: () => void
  }> = [
    { id: 'views', label: '浏览', value: formatNumber(comic.totalViews), icon: EyeIcon },
    { id: 'likes', label: '喜欢', value: formatNumber(comic.likes), icon: HeartIcon },
    {
      id: 'comments',
      label: '评论',
      value: formatNumber(comic.commentTotal),
      icon: MessageCircleIcon,
      onClick: onCommentsClick
    },
    { id: 'chapters', label: '章节', value: formatNumber(comic.series.length), icon: LayersIcon }
  ]

  return (
    <div className="flex items-stretch rounded-md bg-card/60 text-center text-sm">
      {stats.map((stat, index) => {
        const content = (
          <>
            <div className="flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground">
              <stat.icon className="size-4" />
              {stat.label}
            </div>
            <div className="text-xl font-semibold">{stat.value}</div>
          </>
        )

        return (
          <div key={stat.id} className="flex min-w-0 flex-1 items-stretch">
            {stat.onClick ? (
              <button
                type="button"
                className="flex min-w-0 flex-1 cursor-pointer flex-col items-center justify-center space-y-1 rounded-sm p-4 transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                onClick={stat.onClick}
              >
                {content}
              </button>
            ) : (
              <div className="flex min-w-0 flex-1 flex-col items-center justify-center space-y-1 p-4">
                {content}
              </div>
            )}
            {index < stats.length - 1 ? <Separator orientation="vertical" /> : null}
          </div>
        )
      })}
    </div>
  )
}

function PillGroup({
  title,
  items,
  variant = 'outline'
}: {
  title: string
  items: string[]
  variant?: 'outline' | 'secondary'
}) {
  if (items.length === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-10 text-xs text-muted-foreground">{title}</span>
      {items.map(item => (
        <Badge key={`${title}-${item}`} variant={variant}>
          {item}
        </Badge>
      ))}
    </div>
  )
}

function ChaptersSection({
  albumId,
  comicTitle,
  chapters
}: {
  albumId: string
  comicTitle: string
  chapters: ComicChapter[]
}) {
  const sortedChapters = useMemo(() => sortChapters(chapters), [chapters])
  const [page, setPage] = useState(1)
  const pageCount = Math.max(1, Math.ceil(sortedChapters.length / CHAPTER_PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const visibleChapters = sortedChapters.slice(
    (safePage - 1) * CHAPTER_PAGE_SIZE,
    safePage * CHAPTER_PAGE_SIZE
  )

  useEffect(() => {
    setPage(current => Math.min(current, pageCount))
  }, [pageCount])

  function changePage(nextPage: number) {
    const clampedPage = Math.min(Math.max(nextPage, 1), pageCount)
    setPage(clampedPage)
    document.getElementById('chapters')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    })
  }

  return (
    <section id="chapters" className="scroll-mt-8 space-y-4">
      <SectionHeading
        title="章节"
        description={`${chapters.length} 个章节${pageCount > 1 ? `，第 ${safePage}/${pageCount} 页` : ''}`}
      />
      {sortedChapters.length === 0 ? (
        <StatePanel title="暂无章节" description="当前作品没有返回章节列表。" />
      ) : (
        <>
          <div className="space-y-2">
            {visibleChapters.map((chapter, index) => {
              const chapterIndex = (safePage - 1) * CHAPTER_PAGE_SIZE + index
              const nextChapter = sortedChapters[chapterIndex + 1] ?? null
              const chapterTitle = formatChapterTitle(chapter, chapterIndex)
              const nextChapterTitle = nextChapter
                ? formatChapterTitle(nextChapter, chapterIndex + 1)
                : ''

              return (
                <Link
                  key={chapter.id}
                  to="/reader/$comicId"
                  params={{ comicId: chapter.id }}
                  search={{
                    title: comicTitle,
                    chapter: chapterTitle,
                    albumId,
                    nextId: nextChapter?.id ?? '',
                    nextChapter: nextChapterTitle
                  }}
                  className="block"
                >
                  <Card size="sm" className="py-0 transition-colors hover:bg-muted/40">
                    <CardContent className="flex items-center justify-between gap-4 p-4">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{chapterTitle}</div>
                        <div className="text-xs text-muted-foreground">
                          {chapter.sort
                            ? `第 ${chapter.sort} 章`
                            : `章节 ${(safePage - 1) * CHAPTER_PAGE_SIZE + index + 1}`}
                        </div>
                      </div>
                      <Badge variant="outline">JM {chapter.id}</Badge>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>

          {pageCount > 1 ? (
            <ChapterPagination page={safePage} pageCount={pageCount} onPageChange={changePage} />
          ) : null}
        </>
      )}
    </section>
  )
}

function ChapterPagination({
  page,
  pageCount,
  onPageChange
}: {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
}) {
  const pages = getVisiblePages(page, pageCount)

  return (
    <Pagination className="pt-2">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href="#"
            text="上一页"
            className={cn(page === 1 && 'pointer-events-none opacity-50')}
            onClick={event => {
              event.preventDefault()
              onPageChange(page - 1)
            }}
          />
        </PaginationItem>
        {pages.map((item, index) =>
          item === 'ellipsis' ? (
            <PaginationItem key={`ellipsis-${index}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={item}>
              <PaginationLink
                href="#"
                isActive={item === page}
                onClick={event => {
                  event.preventDefault()
                  onPageChange(item)
                }}
              >
                {item}
              </PaginationLink>
            </PaginationItem>
          )
        )}
        <PaginationItem>
          <PaginationNext
            href="#"
            text="下一页"
            className={cn(page === pageCount && 'pointer-events-none opacity-50')}
            onClick={event => {
              event.preventDefault()
              onPageChange(page + 1)
            }}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}

function CommentsDrawer({
  open,
  onOpenChange,
  state
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  state: CommentsState
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="h-full w-[440px] overflow-hidden rounded-l-2xl p-0 before:inset-0 before:rounded-l-2xl before:rounded-r-none data-[vaul-drawer-direction=right]:w-[440px] data-[vaul-drawer-direction=right]:sm:max-w-[440px]">
        <DrawerHeader>
          <DrawerTitle>评论</DrawerTitle>
          <DrawerDescription>共 {formatNumber(state.total)} 条评论</DrawerDescription>
        </DrawerHeader>

        <div
          className="min-h-0 flex-1 overflow-y-auto px-6 pb-6"
          onScroll={event => handleCommentsScroll(event.currentTarget, state)}
        >
          {state.isLoading ? (
            <CommentSkeletonList />
          ) : state.isError ? (
            <StatePanel
              title="评论加载失败"
              description={state.errorMessage}
              onRetry={state.onRetry}
            />
          ) : state.comments.length === 0 ? (
            <StatePanel title="暂无评论" description="当前作品还没有返回评论内容。" />
          ) : (
            <div className="space-y-5">
              {state.comments.map(comment => (
                <CommentItem key={comment.id} comment={comment} />
              ))}
              <CommentsEndState state={state} />
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}

function CommentsEndState({ state }: { state: CommentsState }) {
  if (state.isFetchingNextPage) {
    return (
      <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
        <LoaderCircleIcon className="size-3.5 animate-spin" />
        正在加载评论
      </div>
    )
  }

  if (state.hasNextPage) {
    return <p className="py-2 text-center text-xs text-muted-foreground">继续向下滚动加载更多</p>
  }

  return <p className="py-2 text-center text-xs text-muted-foreground">暂无更多评论</p>
}

function CommentItem({ comment }: { comment: ComicComment }) {
  const name = comment.nickname || comment.username || `用户 ${comment.userId}`
  const content = htmlToText(comment.content)

  return (
    <div className="space-y-3 px-px py-1">
      <div className="space-y-1">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium">{name}</span>
          </div>
          <div className="text-xs text-muted-foreground">{formatCommentTime(comment.time)}</div>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs text-card-foreground">{content || '这条评论没有内容'}</p>

        {comment.replies.length > 0 ? (
          <div className="space-y-2 rounded-md bg-muted/60 p-3">
            {comment.replies.map(reply => (
              <ReplyItem key={reply.id} reply={reply} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function ReplyItem({ reply }: { reply: ComicComment }) {
  const name = reply.nickname || reply.username || `用户 ${reply.userId}`
  const content = htmlToText(reply.content)

  return (
    <div className="text-xs">
      <span className="font-medium">{name}</span>
      <span className="text-muted-foreground"> ：{content || '这条回复没有内容'}</span>
    </div>
  )
}

function RelatedPanel({ items }: { items: RelatedComic[] }) {
  return (
    <section className="space-y-4">
      <div className="space-y-1 px-1">
        <h2 className="text-xl font-semibold tracking-normal">相关推荐</h2>
        <p className="text-sm text-muted-foreground">{items.length} 部作品</p>
      </div>
      <div className="space-y-3">
        {items.length === 0 ? (
          <p className="px-1 text-sm text-muted-foreground">暂无相关推荐</p>
        ) : (
          items.map(item => <RelatedItem key={item.id} item={item} />)
        )}
      </div>
    </section>
  )
}

function RelatedItem({ item }: { item: RelatedComic }) {
  return (
    <Link
      to="/comic/$comicId"
      params={{ comicId: item.id }}
      className="grid grid-cols-[64px_minmax(0,1fr)] gap-3 rounded-md p-1"
    >
      <ComicCover id={item.id} title={item.title} image={item.image} className="w-16" />
      <div className="min-w-0 space-y-1 self-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="truncate text-sm font-medium">{item.title}</div>
          </TooltipTrigger>
          <TooltipContent>{item.title}</TooltipContent>
        </Tooltip>
        <div className="truncate text-xs text-muted-foreground">{item.author || 'N/A'}</div>
        <Badge variant="outline">JM {item.id}</Badge>
      </div>
    </Link>
  )
}

function ComicCover({
  title,
  image,
  className
}: {
  id: string
  title: string
  image: string
  className?: string
}) {
  const [hasImageError, setHasImageError] = useState(false)
  const shouldShowImage = image.length > 0 && !hasImageError

  useEffect(() => {
    setHasImageError(false)
  }, [image])

  return (
    <div
      className={cn(
        'relative aspect-[3/4] overflow-hidden rounded-md bg-muted ring-1 ring-border',
        className
      )}
    >
      {shouldShowImage ? (
        <img
          src={image}
          alt={title}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
          onError={() => setHasImageError(true)}
        />
      ) : (
        <CoverPlaceholder />
      )}
      {SHOW_COVER_MASK ? <CoverMask /> : null}
    </div>
  )
}

function CoverPlaceholder() {
  return (
    <div className="flex h-full items-center justify-center bg-muted text-muted-foreground">
      <ImageIcon className="size-6" />
    </div>
  )
}

function CoverMask() {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted/90 text-muted-foreground backdrop-blur-sm">
      <ImageIcon className="size-6" />
    </div>
  )
}

function BackTop() {
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
      className="fixed right-8 bottom-8 z-50 bg-background/80 backdrop-blur"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    >
      <ChevronUpIcon className="size-4" />
    </Button>
  )
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-normal">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

function ComicDetailSkeleton() {
  return (
    <div className="space-y-10">
      <section className="grid grid-cols-[240px_minmax(0,1fr)] gap-8">
        <div className="aspect-[3/4] animate-pulse rounded-md bg-muted" />
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
      <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-8">
        <div className="space-y-8">
          <ChapterSkeletonList />
        </div>
        <div className="h-80 animate-pulse rounded-xl bg-muted" />
      </div>
    </div>
  )
}

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

function CommentSkeletonList() {
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

type CommentsState = {
  isLoading: boolean
  isFetchingNextPage: boolean
  isError: boolean
  errorMessage?: string
  total: number
  comments: ComicComment[]
  hasNextPage: boolean
  onRetry: () => void
  onLoadMore: () => void
}

function handleCommentsScroll(element: HTMLDivElement, state: CommentsState) {
  if (!state.hasNextPage || state.isFetchingNextPage) {
    return
  }

  const distanceToBottom = element.scrollHeight - element.scrollTop - element.clientHeight

  if (distanceToBottom <= 80) {
    state.onLoadMore()
  }
}

function sortChapters(chapters: ComicChapter[]) {
  return [...chapters].sort((left, right) => {
    const leftSort = Number.parseInt(left.sort, 10)
    const rightSort = Number.parseInt(right.sort, 10)

    if (Number.isNaN(leftSort) || Number.isNaN(rightSort)) {
      return 0
    }

    return rightSort - leftSort
  })
}

function formatChapterTitle(chapter: ComicChapter, index: number) {
  const title = chapter.title.trim()

  if (title.length > 0) {
    return title
  }

  return chapter.sort ? `第 ${chapter.sort} 章` : `章节 ${index + 1}`
}

function getNextChapter(currentId: string, chapters: ComicChapter[]) {
  const sortedChapters = sortChapters(chapters)
  const currentIndex = sortedChapters.findIndex(chapter => chapter.id === currentId)

  if (currentIndex < 0) {
    return null
  }

  return sortedChapters[currentIndex + 1] ?? null
}

function getVisiblePages(currentPage: number, pageCount: number) {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1)
  }

  const pages = new Set([1, pageCount, currentPage - 1, currentPage, currentPage + 1])
  const sortedPages = [...pages]
    .filter(page => page >= 1 && page <= pageCount)
    .sort((left, right) => left - right)
  const visiblePages: Array<number | 'ellipsis'> = []

  for (const page of sortedPages) {
    const previousPage = visiblePages[visiblePages.length - 1]

    if (typeof previousPage === 'number' && page - previousPage > 1) {
      visiblePages.push('ellipsis')
    }

    visiblePages.push(page)
  }

  return visiblePages
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('zh-CN', {
    notation: value >= 10000 ? 'compact' : 'standard',
    maximumFractionDigits: 1
  }).format(value)
}

function formatCommentTime(value: string) {
  const parsed = parseCommentDate(value)

  if (parsed == null) {
    return value || '未知时间'
  }

  const days = differenceInCalendarDays(new Date(), parsed.date)

  if (!parsed.hasTime) {
    if (days > 7 || days < 0) {
      return format(parsed.date, 'yyyy年M月d日', { locale: zhCN })
    }

    if (days === 0) {
      return '今天'
    }

    if (days === 1) {
      return '昨天'
    }

    return `${days}天前`
  }

  if (days > 7) {
    return format(parsed.date, 'yyyy年M月d日 HH:mm', { locale: zhCN })
  }

  return formatDistanceToNowStrict(parsed.date, {
    addSuffix: true,
    locale: zhCN
  })
}

function parseCommentDate(value: string) {
  const normalizedValue = value.trim()

  if (normalizedValue.length === 0) {
    return null
  }

  if (/^\d{10}$/.test(normalizedValue)) {
    return {
      date: new Date(Number(normalizedValue) * 1000),
      hasTime: true
    }
  }

  if (/^\d{13}$/.test(normalizedValue)) {
    return {
      date: new Date(Number(normalizedValue)),
      hasTime: true
    }
  }

  const directDate = new Date(normalizedValue)

  if (isValid(directDate)) {
    return {
      date: directDate,
      hasTime: hasTimeComponent(normalizedValue)
    }
  }

  const formats = [
    { format: 'yyyy-MM-dd HH:mm:ss', locale: zhCN, hasTime: true },
    { format: 'yyyy-MM-dd HH:mm', locale: zhCN, hasTime: true },
    { format: 'yyyy/MM/dd HH:mm:ss', locale: zhCN, hasTime: true },
    { format: 'yyyy/MM/dd HH:mm', locale: zhCN, hasTime: true },
    { format: 'MMM dd, yyyy', locale: enUS, hasTime: false },
    { format: 'MMM d, yyyy', locale: enUS, hasTime: false }
  ]

  for (const item of formats) {
    const parsedDate = parse(normalizedValue, item.format, new Date(), {
      locale: item.locale
    })

    if (isValid(parsedDate)) {
      return {
        date: parsedDate,
        hasTime: item.hasTime
      }
    }
  }

  return null
}

function hasTimeComponent(value: string) {
  return /(?:\d{1,2}:\d{2}|T\d{2})/.test(value)
}

function htmlToText(value: string) {
  if (value.trim().length === 0) {
    return ''
  }

  const document = new DOMParser().parseFromString(value, 'text/html')

  return document.body.textContent?.trim() ?? value
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
