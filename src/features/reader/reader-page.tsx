import { useNavigate, useRouter } from '@tanstack/react-router'
import { useCallback, useEffect, useRef } from 'react'

import { ReaderBottomBar, ReaderTopBar } from './reader-bars'
import { ReaderHotZones } from './reader-hot-zones'
import { ReaderImageWindow } from './reader-image'
import { ReaderError, ReaderLoading } from './reader-state'
import { ReaderStripWindow } from './reader-strip-window'
import type { ReaderSearch } from './types'
import { useReaderAutoRead } from './use-reader-auto-read'
import { useReaderChapterInfo } from './use-reader-chapter-info'
import { useReaderKeyboardNavigation } from './use-reader-keyboard-navigation'
import { useNextChapterPrefetch } from './use-next-chapter-prefetch'
import { useReaderPages } from './use-reader-pages'
import { useReaderToolbarVisibility } from './use-reader-toolbar-visibility'
import { cn } from '@/lib/utils'
import { useReadingHistoryStore } from '@/stores/reading-history-store'
import { useSettingsStore } from '@/stores/settings-store'

const DEFAULT_CHAPTER_TITLE = '正文'

export function ReaderPage({ comicId, search }: { comicId: string; search: ReaderSearch }) {
  const navigate = useNavigate()
  const router = useRouter()
  const upsertReadingHistory = useReadingHistoryStore(state => state.upsert)
  const readerReadMode = useSettingsStore(state => state.readerReadMode)
  const readerPageDirection = useSettingsStore(state => state.readerPageDirection)
  const readerDoublePageMode = useSettingsStore(state => state.readerDoublePageMode)
  const readerAutoReadEnabled = useSettingsStore(state => state.readerAutoReadEnabled)
  const isStripMode = readerReadMode === 'strip'
  const isDoublePageMode = !isStripMode && readerDoublePageMode
  const pageStep = isDoublePageMode ? 2 : 1
  const stripScrollRef = useRef<HTMLDivElement | null>(null)
  const {
    isVisible: isToolbarVisible,
    toggle: toggleToolbar,
    hide: hideToolbar
  } = useReaderToolbarVisibility(!readerAutoReadEnabled)
  const initialPageIndex = Number.parseInt(search.pageIndex ?? '', 10)
  const { albumId, title, author, coverUrl, chapter, chapters, previousChapter, nextChapter } =
    useReaderChapterInfo({
      comicId,
      search
    })
  const {
    currentIndex,
    pageCount,
    pageSrc,
    pageWindow,
    navigationRequestId,
    isManifestLoading,
    manifestError,
    isPageLoading,
    pageError,
    isFetching,
    goToPreviousPage,
    goToNextPage,
    goToPage,
    setObservedPage,
    pageQueryKey,
    requestPage,
    retry
  } = useReaderPages(comicId, Number.isNaN(initialPageIndex) ? 0 : initialPageIndex, pageStep)

  useEffect(() => {
    if (!comicId || pageCount <= 0) {
      return
    }

    const historyComicId = albumId || comicId
    const historyTitle = title || `JM ${historyComicId}`
    const historyChapter = chapter || DEFAULT_CHAPTER_TITLE

    upsertReadingHistory({
      comicId: historyComicId,
      albumId,
      title: historyTitle,
      author,
      coverUrl,
      chapterId: comicId,
      chapterTitle: historyChapter,
      pageIndex: currentIndex,
      pageCount
    })
  }, [
    author,
    chapter,
    comicId,
    coverUrl,
    currentIndex,
    pageCount,
    albumId,
    title,
    upsertReadingHistory
  ])

  useEffect(() => {
    if (readerAutoReadEnabled) {
      hideToolbar()
    }
  }, [comicId, hideToolbar, readerAutoReadEnabled])

  const goBack = useCallback(() => {
    if (window.history.length > 1) {
      router.history.back()
      return
    }

    if (search.fromDetail === '1' && albumId.length > 0) {
      void navigate({ to: '/comic/$comicId', params: { comicId: albumId }, replace: true })
      return
    }

    void navigate({ to: '/' })
  }, [albumId, navigate, router, search.fromDetail])
  const scrollStripBy = useCallback((direction: 1 | -1) => {
    const container = stripScrollRef.current

    if (!container) {
      return
    }

    container.scrollBy({
      top: direction * Math.max(220, container.clientHeight * 0.35),
      behavior: 'smooth'
    })
  }, [])

  useReaderKeyboardNavigation({
    readMode: readerReadMode,
    pageDirection: readerPageDirection,
    onPrevious: goToPreviousPage,
    onNext: goToNextPage,
    onScrollPrevious: () => scrollStripBy(-1),
    onScrollNext: () => scrollStripBy(1),
    onBack: goBack,
    onNavigate: hideToolbar
  })
  useNextChapterPrefetch({
    currentIndex,
    pageCount,
    nextChapter,
    pageStep
  })

  const showReaderBars = isToolbarVisible && pageCount > 0
  const canAutoReadAdvance =
    !isManifestLoading &&
    !manifestError &&
    (isStripMode || (!isPageLoading && !pageError && pageSrc.length > 0))
  useReaderAutoRead({
    readMode: readerReadMode,
    pageStep,
    pageCount,
    currentIndex,
    controlsVisible: showReaderBars,
    canAdvance: canAutoReadAdvance,
    stripScrollRef,
    onNextPage: goToNextPage
  })

  return (
    <main
      className="relative flex h-dvh overflow-hidden bg-neutral-950 text-neutral-50"
      onClick={toggleToolbar}
    >
      <ReaderTopBar
        fallbackReadId={comicId}
        title={title}
        chapter={chapter}
        isFetching={isFetching}
        visible={showReaderBars}
        onBack={goBack}
        onRetry={retry}
      />

      {isStripMode ? null : (
        <ReaderHotZones
          pageDirection={readerPageDirection}
          onPrevious={goToPreviousPage}
          onNext={goToNextPage}
        />
      )}

      <section
        className={cn(
          'flex min-w-0 flex-1 items-center justify-center',
          isStripMode ? 'h-dvh' : null
        )}
      >
        {isManifestLoading ? (
          <ReaderLoading label="正在加载阅读信息" />
        ) : manifestError ? (
          <ReaderError title="阅读信息加载失败" description={manifestError.message} />
        ) : pageCount <= 0 ? (
          <ReaderError title="暂无图片" description="当前章节没有可展示的图片" />
        ) : isStripMode ? (
          <ReaderStripWindow
            key={comicId}
            containerRef={stripScrollRef}
            pageCount={pageCount}
            currentIndex={currentIndex}
            navigationRequestId={navigationRequestId}
            pageQueryKey={pageQueryKey}
            requestPage={requestPage}
            onCurrentIndexChange={setObservedPage}
          />
        ) : isPageLoading ? (
          <ReaderLoading label="正在准备图片" />
        ) : pageError ? (
          <ReaderError title="图片加载失败" description={pageError.message} />
        ) : pageSrc.length > 0 ? (
          <ReaderImageWindow
            pages={pageWindow}
            currentIndex={currentIndex}
            pageCount={pageCount}
            doublePageMode={isDoublePageMode}
            pageDirection={readerPageDirection}
          />
        ) : (
          <ReaderError title="暂无图片" description="当前页没有可展示的图片" />
        )}
      </section>

      <ReaderBottomBar
        title={title}
        currentReadId={comicId}
        previousChapter={previousChapter}
        nextChapter={nextChapter}
        chapters={chapters}
        albumId={albumId}
        currentIndex={currentIndex}
        pageCount={pageCount}
        doublePageMode={isDoublePageMode}
        visible={showReaderBars}
        onPageChange={goToPage}
      />
    </main>
  )
}
