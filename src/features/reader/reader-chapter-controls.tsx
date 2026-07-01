import { Link } from '@tanstack/react-router'
import { ChevronLeftIcon, ChevronRightIcon, ListIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ReaderChapterDrawer } from './reader-chapter-drawer'
import { toReaderChapterSearch } from './reader-chapter-link'
import { ReaderSettingsMenu } from './reader-settings-menu'
import type { ReaderChapterItem } from './types'

const CHAPTER_BUTTON_CLASS =
  'h-7 shrink-0 rounded-md px-2 text-xs text-neutral-200 hover:bg-white/10 hover:text-neutral-50 focus-visible:text-neutral-50 disabled:text-neutral-500'

export function ReaderChapterControls({
  title,
  albumId,
  currentReadId,
  chapters,
  previousChapter,
  nextChapter,
  currentIndex,
  pageCount,
  doublePageMode
}: {
  title: string
  albumId: string
  currentReadId: string
  chapters: ReaderChapterItem[]
  previousChapter: ReaderChapterItem | null
  nextChapter: ReaderChapterItem | null
  currentIndex: number
  pageCount: number
  doublePageMode: boolean
}) {
  const [chapterDrawerOpen, setChapterDrawerOpen] = useState(false)
  const hasChapterList = chapters.length > 1
  const pageLabel =
    doublePageMode && currentIndex + 1 < pageCount
      ? `${currentIndex + 1}-${currentIndex + 2} / ${pageCount}`
      : `${currentIndex + 1} / ${pageCount}`

  return (
    <>
      <div className="grid w-full gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          <ChapterNavButton
            title={title}
            albumId={albumId}
            chapter={hasChapterList ? previousChapter : null}
            chapters={chapters}
          >
            <ChevronLeftIcon className="size-3.5" />
            上一章
          </ChapterNavButton>

          <ChapterNavButton
            title={title}
            albumId={albumId}
            chapter={hasChapterList ? nextChapter : null}
            chapters={chapters}
          >
            下一章
            <ChevronRightIcon className="size-3.5" />
          </ChapterNavButton>

          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={!hasChapterList}
            className={CHAPTER_BUTTON_CLASS}
            onClick={() => setChapterDrawerOpen(true)}
          >
            <ListIcon className="size-3.5" />
            章节目录
          </Button>

          <ReaderSettingsMenu />
        </div>

        <div className="justify-self-end rounded-md bg-white/5 px-2 py-1 text-xs tabular-nums text-neutral-300">
          {pageLabel}
        </div>
      </div>

      <ReaderChapterDrawer
        open={chapterDrawerOpen}
        onOpenChange={setChapterDrawerOpen}
        title={title}
        albumId={albumId}
        currentReadId={currentReadId}
        chapters={chapters}
      />
    </>
  )
}

function ChapterNavButton({
  title,
  albumId,
  chapter,
  chapters,
  children
}: {
  title: string
  albumId: string
  chapter: ReaderChapterItem | null
  chapters: ReaderChapterItem[]
  children: ReactNode
}) {
  if (!chapter) {
    return (
      <Button variant="ghost" size="xs" disabled className={CHAPTER_BUTTON_CLASS}>
        {children}
      </Button>
    )
  }

  return (
    <Button asChild variant="ghost" size="xs" className={cn(CHAPTER_BUTTON_CLASS)}>
      <Link
        to="/reader/$comicId"
        params={{ comicId: chapter.id }}
        replace
        search={toReaderChapterSearch({ title, albumId, chapter, chapters })}
      >
        {children}
      </Link>
    </Button>
  )
}
