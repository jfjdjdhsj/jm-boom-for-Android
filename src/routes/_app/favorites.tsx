import { useQuery } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { BookmarkIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { useMemo, useState } from 'react'

import { ComicGrid, ComicGridSkeleton, FeedHeader, StatePanel } from '@/components/comic-feed'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { getFavoriteComics } from '@/lib/api/comic'
import { FAVORITES_QUERY_GC_TIME, FAVORITES_QUERY_STALE_TIME } from '@/lib/query-cache'
import { queryKeys } from '@/lib/query-keys'
import { useSettingsStore } from '@/stores/settings-store'
import { useUserStore } from '@/stores/user-store'

export const Route = createFileRoute('/_app/favorites')({
  beforeLoad: () => {
    if (!useUserStore.getState().user) {
      throw redirect({ to: '/' })
    }
  },
  component: FavoritesPage
})

const ALL_FAVORITES_FOLDER = '__all__'

function FavoritesPage() {
  const endpoint = useSettingsStore(state => state.api)
  const [page, setPage] = useState(1)
  const [folderId, setFolderId] = useState(ALL_FAVORITES_FOLDER)
  const activeFolderId = folderId === ALL_FAVORITES_FOLDER ? '' : folderId
  const favorites = useQuery({
    queryKey: queryKeys.favorites(endpoint, activeFolderId, page),
    queryFn: () =>
      getFavoriteComics({
        page,
        folderId: activeFolderId,
        endpoint
      }),
    staleTime: FAVORITES_QUERY_STALE_TIME,
    gcTime: FAVORITES_QUERY_GC_TIME,
    refetchOnWindowFocus: false
  })
  const folders = useMemo(
    () => [
      { id: ALL_FAVORITES_FOLDER, name: '全部收藏' },
      ...(favorites.data?.folders ?? []).map(folder => ({
        id: folder.id,
        name: folder.name || `收藏夹 ${folder.id}`
      }))
    ],
    [favorites.data?.folders]
  )

  function changeFolder(value: string) {
    setFolderId(value)
    setPage(1)
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 pt-5 pb-[calc(env(safe-area-inset-bottom)+6rem)] sm:px-6 md:p-[32px_32px_16px_96px]">
        <FeedHeader
          title="收藏"
          description="云端收藏的漫画作品"
          isFetching={favorites.isFetching}
          onRefresh={() => favorites.refetch()}
        />

        <div className="flex items-center justify-between gap-3">
          <Select value={folderId} onValueChange={changeFolder}>
            <SelectTrigger>
              <BookmarkIcon className="size-4 text-muted-foreground" />
              <SelectValue placeholder="选择收藏夹" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {folders.map(folder => (
                  <SelectItem key={folder.id} value={folder.id}>
                    {folder.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          {favorites.data ? (
            <p className="text-sm text-muted-foreground">
              共 {favorites.data.total} 部作品 · 第 {page} 页
            </p>
          ) : null}
        </div>

        {favorites.isError ? (
          <StatePanel
            title="收藏加载失败"
            description={favorites.error.message}
            onRetry={() => favorites.refetch()}
          />
        ) : favorites.isLoading ? (
          <ComicGridSkeleton />
        ) : favorites.data == null || favorites.data.items.length === 0 ? (
          <StatePanel title="暂无收藏" description="当前收藏夹没有可展示的漫画。" />
        ) : (
          <>
            <ComicGrid items={favorites.data.items} />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1 || favorites.isFetching}
                onClick={() => setPage(current => Math.max(1, current - 1))}
              >
                <ChevronLeftIcon className="size-4" />
                上一页
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!favorites.data.hasMore || favorites.isFetching}
                onClick={() => setPage(current => current + 1)}
              >
                下一页
                <ChevronRightIcon className="size-4" />
              </Button>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
