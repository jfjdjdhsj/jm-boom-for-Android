import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  getComicReadManifest,
  getComicReadPage,
  readerFileSrc
} from '@/lib/api/reader'
import { queryKeys } from '@/lib/query-keys'
import { READER_GC_TIME, READER_STALE_TIME } from './constants'
import { useSettingsStore } from '@/stores/settings-store'

const BREEZE_ROW_PREFETCH_RADIUS = 1

export function useReaderPages(comicId: string, initialIndex = 0) {
  const queryClient = useQueryClient()
  const endpoint = useSettingsStore(state => state.api)
  const readerCacheLimitMb = useSettingsStore(state => state.readerCacheLimitMb)
  const cacheLimitBytes = readerCacheLimitMb * 1024 * 1024
  const initialPageIndex = normalizePageIndex(initialIndex)
  const [currentIndex, setCurrentIndex] = useState(initialPageIndex)
  const prefetchKeyRef = useRef('')

  const manifest = useQuery({
    queryKey: queryKeys.readerManifest(endpoint, comicId),
    queryFn: () => getComicReadManifest({ readId: comicId, endpoint }),
    staleTime: READER_STALE_TIME,
    gcTime: READER_GC_TIME,
    refetchOnMount: false,
    refetchOnWindowFocus: false
  })
  const pageCount = manifest.data?.pageCount ?? 0
  const clampPageIndex = useCallback(
    (index: number) => Math.min(Math.max(index, 0), Math.max(pageCount - 1, 0)),
    [pageCount]
  )
  const effectiveCurrentIndex = pageCount > 0 ? clampPageIndex(currentIndex) : currentIndex
  const pageQueryKey = useCallback(
    (index: number) => queryKeys.readerPage(endpoint, comicId, cacheLimitBytes, index),
    [cacheLimitBytes, comicId, endpoint]
  )
  const requestPage = useCallback(
    (index: number, requestOrigin: 'visible' | 'prefetch') =>
      getComicReadPage({
        readId: comicId,
        index,
        endpoint,
        requestOrigin,
        cacheLimitBytes
      }),
    [cacheLimitBytes, comicId, endpoint]
  )
  const page = useQuery({
    queryKey: pageQueryKey(effectiveCurrentIndex),
    queryFn: () => requestPage(effectiveCurrentIndex, 'visible'),
    enabled: manifest.isSuccess && pageCount > 0,
    staleTime: READER_STALE_TIME,
    gcTime: READER_GC_TIME,
    refetchOnMount: false,
    refetchOnWindowFocus: false
  })
  const isPageReady = page.data?.index === effectiveCurrentIndex
  const goToPreviousPage = useCallback(() => {
    if (pageCount === 0) {
      return
    }

    setCurrentIndex(index => clampPageIndex(index - 1))
  }, [clampPageIndex, pageCount])
  const goToNextPage = useCallback(() => {
    if (pageCount === 0) {
      return
    }

    setCurrentIndex(index => clampPageIndex(index + 1))
  }, [clampPageIndex, pageCount])
  const retry = useCallback(() => {
    if (manifest.isError) {
      void manifest.refetch()
      return
    }

    void page.refetch()
  }, [manifest, page])
  const pageSrc = useMemo(
    () => (isPageReady && page.data ? readerFileSrc(page.data.path) : ''),
    [isPageReady, page.data]
  )
  const isLastPage = pageCount > 0 && currentIndex >= pageCount - 1

  useEffect(() => {
    setCurrentIndex(initialPageIndex)
  }, [comicId, endpoint, initialPageIndex])

  useEffect(() => {
    if (currentIndex < pageCount || pageCount === 0) {
      return
    }

    setCurrentIndex(Math.max(0, pageCount - 1))
  }, [currentIndex, pageCount])

  useEffect(() => {
    if (!manifest.isSuccess || !isPageReady || pageCount === 0) {
      return
    }

    const prefetchIndexes = readerPrefetchIndexes(
      effectiveCurrentIndex,
      pageCount,
      BREEZE_ROW_PREFETCH_RADIUS
    )

    if (prefetchIndexes.length === 0) {
      return
    }

    const prefetchKey = [
      endpoint,
      cacheLimitBytes,
      comicId,
      effectiveCurrentIndex,
      prefetchIndexes.join(',')
    ].join('|')

    if (prefetchKeyRef.current === prefetchKey) {
      return
    }

    prefetchKeyRef.current = prefetchKey
    let isActive = true

    void (async () => {
      for (const index of prefetchIndexes) {
        if (!isActive) {
          return
        }

        await queryClient
          .prefetchQuery({
            queryKey: pageQueryKey(index),
            queryFn: () => requestPage(index, 'prefetch'),
            staleTime: READER_STALE_TIME,
            gcTime: READER_GC_TIME
          })
          .catch(error => {
            if (import.meta.env.DEV) {
              console.debug('Reader page prefetch failed', error)
            }
          })
      }
    })()

    return () => {
      isActive = false
    }
  }, [
    cacheLimitBytes,
    comicId,
    effectiveCurrentIndex,
    endpoint,
    isPageReady,
    manifest.isSuccess,
    pageCount,
    pageQueryKey,
    queryClient,
    requestPage
  ])

  return {
    currentIndex,
    pageCount,
    pageSrc,
    isLastPage,
    isManifestLoading: manifest.isLoading,
    manifestError: manifest.isError ? manifest.error : null,
    isPageLoading: page.isLoading && !page.data,
    pageError: page.isError ? page.error : null,
    isFetching: manifest.isFetching || page.isFetching,
    goToPreviousPage,
    goToNextPage,
    retry
  }
}

function normalizePageIndex(index: number) {
  if (!Number.isFinite(index)) {
    return 0
  }

  return Math.max(0, Math.floor(index))
}

function readerPrefetchIndexes(currentIndex: number, pageCount: number, radius: number) {
  const indexes: number[] = []

  for (let distance = 1; distance <= radius; distance += 1) {
    const nextIndex = currentIndex + distance
    const previousIndex = currentIndex - distance

    if (nextIndex < pageCount) {
      indexes.push(nextIndex)
    }

    if (previousIndex >= 0) {
      indexes.push(previousIndex)
    }
  }

  return indexes
}
