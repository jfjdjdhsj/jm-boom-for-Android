import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { BarChart3Icon, ListFilterIcon } from 'lucide-react'
import { useState } from 'react'

import { ComicGrid, ComicGridSkeleton, FeedHeader, StatePanel } from '@/components/comic-feed'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious
} from '@/components/ui/pagination'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { getHomeSectionList } from '@/lib/api/home'
import { LIST_QUERY_GC_TIME, LIST_QUERY_STALE_TIME } from '@/lib/query-cache'
import { queryKeys } from '@/lib/query-keys'
import {
  defaultRankingCategory,
  rankingCategoryApiValue,
  rankingCategoryOptions,
  RANKING_ORDER_OPTIONS
} from '@/lib/ranking-filters'
import { useSettingsStore } from '@/stores/settings-store'

export const Route = createFileRoute('/_app/ranking')({
  component: RankingPage
})

function RankingPage() {
  const endpoint = useSettingsStore(state => state.api)
  const [page, setPage] = useState(1)
  const [category, setCategory] = useState(defaultRankingCategory())
  const [order, setOrder] = useState('new')
  const categories = rankingCategoryOptions()

  const query = useQuery({
    queryKey: queryKeys.ranking(endpoint, page, category, order),
    queryFn: () =>
      getHomeSectionList({
        mode: 'ranking',
        page,
        sectionTitle: '排行榜',
        category: rankingCategoryApiValue(category),
        order,
        endpoint
      }),
    staleTime: LIST_QUERY_STALE_TIME,
    gcTime: LIST_QUERY_GC_TIME,
    refetchOnMount: false,
    refetchOnWindowFocus: false
  })
  const items = query.data?.items ?? []

  function updateCategory(value: string) {
    setCategory(value)
    setPage(1)
  }

  function updateOrder(value: string) {
    setOrder(value)
    setPage(1)
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-6xl space-y-6 p-[96px_32px_32px_96px]">
        <FeedHeader
          title="排行榜"
          description="按分类和热度浏览作品"
          isFetching={query.isFetching}
          onRefresh={() => query.refetch()}
        />

        <div className="mb-4 flex items-center justify-end gap-3">
          <Select value={order} onValueChange={updateOrder}>
            <SelectTrigger>
              <ListFilterIcon className="size-4 text-muted-foreground" />
              <SelectValue placeholder="选择排序" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {RANKING_ORDER_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <Select value={category} onValueChange={updateCategory}>
            <SelectTrigger>
              <BarChart3Icon className="size-4 text-muted-foreground" />
              <SelectValue placeholder="选择分类" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {categories.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        {query.isError ? (
          <StatePanel
            title="排行榜加载失败"
            description={query.error.message}
            onRetry={() => query.refetch()}
          />
        ) : query.isLoading ? (
          <ComicGridSkeleton count={12} />
        ) : items.length === 0 ? (
          <StatePanel title="暂无排行内容" description="当前筛选条件下没有内容。" />
        ) : (
          <>
            <ComicGrid items={items} />
            <RankingPagination
              page={page}
              hasMore={query.data?.hasMore ?? false}
              disabled={query.isFetching}
              onPageChange={setPage}
            />
          </>
        )}
      </div>
    </main>
  )
}

function RankingPagination({
  page,
  hasMore,
  disabled,
  onPageChange
}: {
  page: number
  hasMore: boolean
  disabled: boolean
  onPageChange: (page: number) => void
}) {
  function changePage(nextPage: number) {
    if (disabled || nextPage < 1 || nextPage === page) {
      return
    }

    onPageChange(nextPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <Pagination className="py-3">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href="#"
            text="上一页"
            aria-disabled={page <= 1 || disabled}
            className={page <= 1 || disabled ? 'pointer-events-none opacity-50' : undefined}
            onClick={event => {
              event.preventDefault()
              changePage(page - 1)
            }}
          />
        </PaginationItem>
        <PaginationItem>
          <PaginationNext
            href="#"
            text="下一页"
            aria-disabled={disabled || !hasMore}
            className={disabled || !hasMore ? 'pointer-events-none opacity-50' : undefined}
            onClick={event => {
              event.preventDefault()
              changePage(page + 1)
            }}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}
