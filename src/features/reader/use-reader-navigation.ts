import { useCallback, useState } from 'react'

type ReaderNavigationState = {
  chapterKey: string
  index: number
  navigationRequestId: number
}

export function useReaderNavigation({
  comicId,
  endpoint,
  initialIndex,
  pageCount,
  pageStep = 1
}: {
  comicId: string
  endpoint: string
  initialIndex: number
  pageCount: number
  pageStep?: number
}) {
  const initialPageIndex = normalizePageIndex(initialIndex)
  const normalizedPageStep = normalizePageStep(pageStep)
  const chapterKey = `${endpoint}::${comicId}::${initialPageIndex}`
  const [state, setState] = useState<ReaderNavigationState>(() => ({
    chapterKey,
    index: initialPageIndex,
    navigationRequestId: 0
  }))

  // 切换章节时必须在同一次渲染里把页码重置回起始页。
  // 之前重置放在 useEffect 中，切章后的第一次渲染仍然带着上一章的页码：
  // 既会用上一章的页码去请求图片，也会被越界收敛逻辑改写成新章节的最后一页，
  // 于是切章后会跳到末页或残留的旧页码（例如 100 多页）。
  let { index: currentIndex, navigationRequestId } = state

  if (state.chapterKey !== chapterKey) {
    currentIndex = initialPageIndex
    navigationRequestId = state.navigationRequestId + 1
    setState({ chapterKey, index: currentIndex, navigationRequestId })
  }

  const clampPageIndex = useCallback(
    (index: number) => Math.min(Math.max(index, 0), Math.max(pageCount - 1, 0)),
    [pageCount]
  )
  const effectiveCurrentIndex = pageCount > 0 ? clampPageIndex(currentIndex) : currentIndex
  const requestNavigation = useCallback((nextIndex: number) => {
    setState(previous => ({
      ...previous,
      index: nextIndex,
      navigationRequestId: previous.navigationRequestId + 1
    }))
  }, [])
  const goToPreviousPage = useCallback(() => {
    if (pageCount === 0) {
      return
    }

    requestNavigation(clampPageIndex(effectiveCurrentIndex - normalizedPageStep))
  }, [clampPageIndex, effectiveCurrentIndex, normalizedPageStep, pageCount, requestNavigation])
  const goToNextPage = useCallback(() => {
    if (pageCount === 0) {
      return
    }

    requestNavigation(clampPageIndex(effectiveCurrentIndex + normalizedPageStep))
  }, [clampPageIndex, effectiveCurrentIndex, normalizedPageStep, pageCount, requestNavigation])
  const goToPage = useCallback(
    (index: number) => {
      if (pageCount === 0) {
        return
      }

      requestNavigation(clampPageIndex(index))
    },
    [clampPageIndex, pageCount, requestNavigation]
  )
  const setObservedPage = useCallback(
    (index: number) => {
      if (pageCount === 0) {
        return
      }

      setState(previous => {
        const nextIndex = clampPageIndex(index)

        return previous.index === nextIndex ? previous : { ...previous, index: nextIndex }
      })
    },
    [clampPageIndex, pageCount]
  )

  return {
    currentIndex,
    effectiveCurrentIndex,
    navigationRequestId,
    isLastPage: pageCount > 0 && effectiveCurrentIndex >= pageCount - normalizedPageStep,
    goToPreviousPage,
    goToNextPage,
    goToPage,
    setObservedPage
  }
}

function normalizePageIndex(index: number) {
  if (!Number.isFinite(index)) {
    return 0
  }

  return Math.max(0, Math.floor(index))
}

function normalizePageStep(pageStep: number) {
  if (!Number.isFinite(pageStep)) {
    return 1
  }

  return Math.max(1, Math.floor(pageStep))
}
