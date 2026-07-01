import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { BarChart3Icon, ListFilterIcon } from 'lucide-react'

import { ComicGrid, ComicGridSkeleton, FeedHeader, StatePanel } from '@/components/comic-feed'
import { ListPagination } from '@/components/list-pagination'
import { PageBackButton } from '@/components/page-back-button'
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
import { parsePositivePage, parseStringSearch } from '@/lib/route-search'
import { useSettingsStore } from '@/stores/settings-store'

type RankingSearch = {
  page: number
  category: string
  order: string
}

export const Route = createFileRoute('/_app/ranking')({
  validateSearch: (search: Record<string, unknown>): RankingSearch => ({
    page: parsePositivePage(search.page),
    category: parseRankingCategory(search.category),
    order: parseRankingOrder(search.order)
  }),
  component: RankingPage
})

function RankingPage() {
  const endpoint = useSettingsStore(state => state.api)
  const navigate = useNavigate({ from: Route.fullPath })
  const search = Route.useSearch()
  const categories = rankingCategoryOptions()

  const query = useQuery({
    queryKey: queryKeys.ranking(endpoint, search.page, search.category, search.order),
    queryFn: () =>
      getHomeSectionList({
        mode: 'ranking',
        page: search.page,
        sectionTitle: '排行榜',
        category: rankingCategoryApiValue(search.category),
        order: search.order,
        endpoint
      }),
    staleTime: LIST_QUERY_STALE_TIME,
    gcTime: LIST_QUERY_GC_TIME,
    refetchOnMount: false,
    refetchOnWindowFocus: false
  })
  const items = query.data?.items ?? []

  function updateCategory(value: string) {
    void navigate({
      replace: true,
      resetScroll: false,
      search: {
        ...search,
        page: 1,
        category: parseRankingCategory(value)
      }
    })
  }

  function updateOrder(value: string) {
    void navigate({
      replace: true,
      resetScroll: false,
      search: {
        ...search,
        page: 1,
        order: parseRankingOrder(value)
      }
    })
  }

  function updatePage(page: number) {
    void navigate({
      replace: true,
      resetScroll: false,
      search: {
        ...search,
        page
      }
    })
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 pt-5 pb-[calc(env(safe-area-inset-bottom)+6rem)] sm:px-6 md:p-[32px_32px_16px_96px]">
        <PageBackButton />
        <FeedHeader
          title="排行榜"
          description="按分类和热度浏览作品"
          isFetching={query.isFetching}
          onRefresh={() => query.refetch()}
        />

        <div className="mb-4 flex items-center justify-end gap-3">
          <Select value={search.order} onValueChange={updateOrder}>
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

          <Select value={search.category} onValueChange={updateCategory}>
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
            <ListPagination
              page={search.page}
              hasMore={query.data?.hasMore ?? false}
              disabled={query.isFetching}
              onPageChange={updatePage}
            />
          </>
        )}
      </div>
    </main>
  )
}

function parseRankingCategory(value: unknown) {
  const category = parseStringSearch(value, defaultRankingCategory())

  return rankingCategoryOptions().some(option => option.value === category)
    ? category
    : defaultRankingCategory()
}

function parseRankingOrder(value: unknown) {
  const order = parseStringSearch(value, 'new')

  return RANKING_ORDER_OPTIONS.some(option => option.value === order) ? order : 'new'
}
