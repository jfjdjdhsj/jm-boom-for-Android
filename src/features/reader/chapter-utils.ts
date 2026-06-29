import type { ComicChapter } from '@/lib/api/comic'
import type { ReaderNextChapter } from './types'

export function toNextChapter(id: string, title: string): ReaderNextChapter | null {
  const trimmedId = id.trim()

  if (trimmedId.length === 0) {
    return null
  }

  return {
    id: trimmedId,
    title: title.trim()
  }
}

export function resolveNextChapter({
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

  const nextChapter = sortedChapters[currentIndex - 1]

  if (!nextChapter) {
    return null
  }

  return {
    id: nextChapter.id,
    title: formatChapterTitle(nextChapter, currentIndex - 1)
  }
}

export function resolveCurrentChapterTitle({
  currentReadId,
  chapters,
  fallback
}: {
  currentReadId: string
  chapters: ComicChapter[]
  fallback: string
}) {
  const trimmedFallback = fallback.trim()

  if (chapters.length === 0) {
    return trimmedFallback
  }

  const sortedChapters = sortChapters(chapters)
  const currentIndex = sortedChapters.findIndex(chapter => chapter.id === currentReadId)

  if (currentIndex < 0) {
    return trimmedFallback
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
