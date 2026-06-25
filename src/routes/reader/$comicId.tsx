import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { ArrowLeftIcon, LoaderCircleIcon, RotateCwIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { getComicDetail, type ComicChapter } from '@/lib/api/comic'
import {
  getComicReadManifest,
  getComicReadPage,
  prefetchComicReadPages,
  readerFileSrc
} from '@/lib/api/reader'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/reader/$comicId')({
  validateSearch: (search: Record<string, unknown>) => ({
    title: typeof search.title === 'string' ? search.title : '',
    chapter: typeof search.chapter === 'string' ? search.chapter : '',
    albumId: typeof search.albumId === 'string' ? search.albumId : '',
    nextId: typeof search.nextId === 'string' ? search.nextId : '',
    nextChapter: typeof search.nextChapter === 'string' ? search.nextChapter : ''
  }),
  component: ReaderPage
})

const READER_STALE_TIME = 60 * 60 * 1000
const READER_GC_TIME = 2 * 60 * 60 * 1000
const PREFETCH_RADIUS = 3

type ReaderNextChapter = {
  id: string
  title: string
}

function ReaderPage() {
  const { comicId } = Route.useParams()
  const search = Route.useSearch()
  const router = useRouter()
  const [currentIndex, setCurrentIndex] = useState(0)
  const {
    isVisible: isToolbarVisible,
    show: showToolbar,
    hide: hideToolbar
  } = useReaderToolbarVisibility()
  const albumId = search.albumId.trim()

  const manifest = useQuery({
    queryKey: ['jm-reader-manifest', comicId],
    queryFn: () => getComicReadManifest({ readId: comicId }),
    staleTime: READER_STALE_TIME,
    gcTime: READER_GC_TIME,
    refetchOnMount: false,
    refetchOnWindowFocus: false
  })
  const pageCount = manifest.data?.pageCount ?? 0
  const page = useQuery({
    queryKey: ['jm-reader-page', comicId, currentIndex, manifest.data?.shunt],
    queryFn: () =>
      getComicReadPage({
        readId: comicId,
        index: currentIndex,
        shunt: manifest.data?.shunt
      }),
    enabled: manifest.isSuccess && pageCount > 0,
    staleTime: READER_STALE_TIME,
    gcTime: READER_GC_TIME,
    refetchOnMount: false,
    refetchOnWindowFocus: false
  })
  const pageSrc = useMemo(() => (page.data ? readerFileSrc(page.data.path) : ''), [page.data])
  const isLastPage = pageCount > 0 && currentIndex >= pageCount - 1
  const title = search.title.trim()
  const searchChapter = search.chapter.trim()
  const fallbackNextChapter = useMemo(
    () => toNextChapter(search.nextId, search.nextChapter),
    [search.nextId, search.nextChapter]
  )
  const albumDetail = useQuery({
    queryKey: ['jm-comic-detail', albumId],
    queryFn: () => getComicDetail(albumId),
    enabled: albumId.length > 0,
    staleTime: READER_STALE_TIME,
    gcTime: READER_GC_TIME,
    refetchOnMount: false,
    refetchOnWindowFocus: false
  })
  const nextChapter = useMemo(
    () =>
      resolveNextChapter({
        currentReadId: comicId,
        chapters: albumDetail.data?.comic.series ?? [],
        fallback: fallbackNextChapter
      }),
    [albumDetail.data, comicId, fallbackNextChapter]
  )
  const chapter = useMemo(
    () =>
      resolveCurrentChapterTitle({
        currentReadId: comicId,
        chapters: albumDetail.data?.comic.series ?? [],
        fallback: searchChapter
      }),
    [albumDetail.data, comicId, searchChapter]
  )
  const goToPage = useCallback(
    (index: number) => {
      if (pageCount === 0) {
        return
      }

      setCurrentIndex(Math.min(Math.max(index, 0), pageCount - 1))
    },
    [pageCount]
  )

  useEffect(() => {
    setCurrentIndex(0)
  }, [comicId])

  useEffect(() => {
    if (currentIndex < pageCount || pageCount === 0) {
      return
    }

    setCurrentIndex(Math.max(0, pageCount - 1))
  }, [currentIndex, pageCount])

  useEffect(() => {
    if (!manifest.data || pageCount === 0) {
      return
    }

    void prefetchComicReadPages({
      readId: comicId,
      centerIndex: currentIndex,
      radius: PREFETCH_RADIUS,
      shunt: manifest.data.shunt
    }).catch(error => {
      console.debug('Reader prefetch failed', error)
    })
  }, [comicId, currentIndex, manifest.data, pageCount])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        hideToolbar()
        goToPage(currentIndex - 1)
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        hideToolbar()
        goToPage(currentIndex + 1)
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        hideToolbar()
        router.history.back()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentIndex, goToPage, hideToolbar, router])

  return (
    <main
      className="relative flex h-screen overflow-hidden bg-neutral-950 text-neutral-50"
      onMouseMove={showToolbar}
    >
      <ReaderTopBar
        fallbackReadId={comicId}
        title={title}
        chapter={chapter}
        isFetching={manifest.isFetching || page.isFetching}
        visible={isToolbarVisible}
        onBack={() => router.history.back()}
        onRetry={() => {
          if (manifest.isError) {
            manifest.refetch()
            return
          }

          page.refetch()
        }}
      />

      <button
        type="button"
        aria-label="上一页"
        className="absolute top-20 bottom-20 left-0 z-10 w-1/5 cursor-w-resize"
        onClick={() => goToPage(currentIndex - 1)}
      />
      <button
        type="button"
        aria-label="下一页"
        className="absolute top-20 right-0 bottom-20 z-10 w-1/5 cursor-e-resize"
        onClick={() => goToPage(currentIndex + 1)}
      />

      <section className="flex min-w-0 flex-1 items-center justify-center">
        {manifest.isLoading ? (
          <ReaderLoading label="正在加载阅读信息" />
        ) : manifest.isError ? (
          <ReaderError title="阅读信息加载失败" description={manifest.error.message} />
        ) : page.isLoading || page.isFetching ? (
          <ReaderLoading label="正在准备图片" />
        ) : page.isError ? (
          <ReaderError title="图片加载失败" description={page.error.message} />
        ) : pageSrc.length > 0 ? (
          <ReaderImage src={pageSrc} />
        ) : (
          <ReaderError title="暂无图片" description="当前页没有可展示的图片" />
        )}
      </section>

      <ReaderBottomBar
        title={title}
        nextChapter={nextChapter}
        albumId={albumId}
        currentIndex={currentIndex}
        pageCount={pageCount}
        showNextChapter={isLastPage && nextChapter != null}
        visible={isToolbarVisible}
      />
    </main>
  )
}

function ReaderTopBar({
  fallbackReadId,
  title,
  chapter,
  isFetching,
  visible,
  onBack,
  onRetry
}: {
  fallbackReadId: string
  title: string
  chapter: string
  isFetching: boolean
  visible: boolean
  onBack: () => void
  onRetry: () => void
}) {
  const displayTitle = title || `JM ${fallbackReadId}`

  return (
    <header
      className={cn(
        'absolute inset-x-0 top-0 z-30 grid h-16 grid-cols-[120px_minmax(0,1fr)_120px] items-center bg-neutral-950/85 px-4 backdrop-blur transition-all duration-200',
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-3 opacity-0'
      )}
    >
      <Button
        variant="ghost"
        size="sm"
        className="justify-self-start text-neutral-50 hover:bg-white/10"
        onClick={onBack}
      >
        <ArrowLeftIcon className="size-4" />
        返回
      </Button>

      <div className="min-w-0 text-center">
        <div className="truncate text-sm font-medium text-neutral-50">{displayTitle}</div>
        {chapter ? <div className="mt-1 truncate text-xs text-neutral-400">{chapter}</div> : null}
      </div>

      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="重新加载"
        className="justify-self-end text-neutral-50 hover:bg-white/10"
        onClick={onRetry}
      >
        {isFetching ? (
          <LoaderCircleIcon className="size-4 animate-spin" />
        ) : (
          <RotateCwIcon className="size-4" />
        )}
      </Button>
    </header>
  )
}

function ReaderBottomBar({
  title,
  nextChapter,
  albumId,
  currentIndex,
  pageCount,
  showNextChapter,
  visible
}: {
  title: string
  nextChapter: ReaderNextChapter | null
  albumId: string
  currentIndex: number
  pageCount: number
  showNextChapter: boolean
  visible: boolean
}) {
  const progress = pageCount > 0 ? ((currentIndex + 1) / pageCount) * 100 : 0

  return (
    <>
      <footer
        className={cn(
          'absolute bottom-8 left-1/2 z-30 flex w-80 -translate-x-1/2 flex-col items-center gap-2 rounded-xl bg-neutral-950/85 p-3 text-center backdrop-blur transition-all duration-200',
          visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
        )}
      >
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-background transition-[width]"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="text-xs text-neutral-300">
          {pageCount === 0 ? 0 : currentIndex + 1} of Page {pageCount}
        </div>
      </footer>

      {showNextChapter && nextChapter ? (
        <Button
          asChild
          variant="ghost"
          size="sm"
          className={cn(
            'absolute right-8 bottom-20 z-30 bg-neutral-950/85 text-neutral-50 backdrop-blur transition-all duration-200 hover:bg-white/10',
            visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
          )}
        >
          <Link
            to="/reader/$comicId"
            params={{ comicId: nextChapter.id }}
            search={{
              title,
              chapter: nextChapter.title,
              albumId,
              nextId: '',
              nextChapter: ''
            }}
          >
            下一章
          </Link>
        </Button>
      ) : null}
    </>
  )
}

function ReaderImage({ src }: { src: string }) {
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    setIsLoaded(false)
  }, [src])

  return (
    <div className="relative flex h-screen w-screen items-center justify-center">
      {!isLoaded ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <LoaderCircleIcon className="size-6 animate-spin text-neutral-400" />
        </div>
      ) : null}
      <img
        src={src}
        alt=""
        className={cn(
          'relative z-10 h-screen w-screen object-contain transition-opacity',
          isLoaded ? 'opacity-100' : 'opacity-0'
        )}
        draggable={false}
        onLoad={() => setIsLoaded(true)}
      />
    </div>
  )
}

function toNextChapter(id: string, title: string): ReaderNextChapter | null {
  const trimmedId = id.trim()

  if (trimmedId.length === 0) {
    return null
  }

  return {
    id: trimmedId,
    title: title.trim()
  }
}

function resolveNextChapter({
  currentReadId,
  chapters,
  fallback
}: {
  currentReadId: string
  chapters: ComicChapter[]
  fallback: ReaderNextChapter | null
}) {
  if (chapters.length === 0) {
    return fallback
  }

  const sortedChapters = sortChapters(chapters)
  const currentIndex = sortedChapters.findIndex(chapter => chapter.id === currentReadId)

  if (currentIndex < 0) {
    return fallback
  }

  const nextChapter = sortedChapters[currentIndex + 1]

  if (!nextChapter) {
    return null
  }

  return {
    id: nextChapter.id,
    title: formatChapterTitle(nextChapter, currentIndex + 1)
  }
}

function resolveCurrentChapterTitle({
  currentReadId,
  chapters,
  fallback
}: {
  currentReadId: string
  chapters: ComicChapter[]
  fallback: string
}) {
  const trimmedFallback = fallback.trim()

  if (trimmedFallback.length > 0) {
    return trimmedFallback
  }

  if (chapters.length === 0) {
    return ''
  }

  const sortedChapters = sortChapters(chapters)
  const currentIndex = sortedChapters.findIndex(chapter => chapter.id === currentReadId)

  if (currentIndex < 0) {
    return ''
  }

  return formatChapterTitle(sortedChapters[currentIndex], currentIndex)
}

function formatChapterTitle(chapter: ComicChapter, index: number) {
  const title = chapter.title.trim()

  if (title.length > 0) {
    return title
  }

  return chapter.sort ? `第 ${chapter.sort} 章` : `章节 ${index + 1}`
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

function ReaderLoading({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-neutral-300">
      <LoaderCircleIcon className="size-4 animate-spin" />
      {label}
    </div>
  )
}

function ReaderError({ title, description }: { title: string; description: string }) {
  return (
    <div className="max-w-md space-y-2 text-center">
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="text-sm text-neutral-400">{description}</p>
    </div>
  )
}

function useReaderToolbarVisibility() {
  const [isVisible, setIsVisible] = useState(true)
  const timerRef = useRef<number | null>(null)

  const clearHideTimer = useCallback(() => {
    if (timerRef.current == null) {
      return
    }

    window.clearTimeout(timerRef.current)
    timerRef.current = null
  }, [])

  const hide = useCallback(() => {
    clearHideTimer()
    setIsVisible(false)
  }, [clearHideTimer])

  const show = useCallback(() => {
    clearHideTimer()
    setIsVisible(true)
    timerRef.current = window.setTimeout(() => {
      setIsVisible(false)
      timerRef.current = null
    }, 1800)
  }, [clearHideTimer])

  useEffect(() => {
    show()

    return clearHideTimer
  }, [clearHideTimer, show])

  return { isVisible, show, hide }
}
