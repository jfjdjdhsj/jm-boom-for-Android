import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { ArrowLeftIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

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
import { Button } from '@/components/ui/button'
import { getHomeSectionList, type HomeSectionListMode } from '@/lib/api/home'
import { LIST_QUERY_GC_TIME, LIST_QUERY_STALE_TIME } from '@/lib/query-cache'
import { queryKeys } from '@/lib/query-keys'
import {
  defaultRankingCategory,
  rankingCategoryApiValue,
  rankingCategoryOptions,
  RANKING_ORDER_OPTIONS,
  type FilterOption
} from '@/lib/ranking-filters'
import { useSettingsStore } from '@/stores/settings-store'

type HomeSectionListSearch = {
  mode: HomeSectionListMode
  sectionId: string
  title: string
  slug: string
  type: string
  filterValue: string
  rankTag: string
}

export const Route = createFileRoute('/_app/list')({
  validateSearch: (search: Record<string, unknown>): HomeSectionListSearch => ({
    mode: isHomeSectionListMode(search.mode) ? search.mode : 'promote',
    sectionId: typeof search.sectionId === 'string' ? search.sectionId : '',
    title: typeof search.title === 'string' ? search.title : '',
    slug: typeof search.slug === 'string' ? search.slug : '',
    type: typeof search.type === 'string' ? search.type : '',
    filterValue: typeof search.filterValue === 'string' ? search.filterValue : '',
    rankTag: typeof search.rankTag === 'string' ? search.rankTag : ''
  }),
  component: HomeSectionListPage
})

const WEEK_OPTIONS: FilterOption[] = [
  { label: '周一', value: '1' },
  { label: '周二', value: '2' },
  { label: '周三', value: '3' },
  { label: '周四', value: '4' },
  { label: '周五', value: '5' },
  { label: '周六', value: '6' },
  { label: '周日', value: '7' },
  { label: '已完结', value: '0' }
]

const WEEK_CATEGORY_OPTIONS: FilterOption[] = [
  { label: '全部', value: 'all' },
  { label: '日漫', value: 'manga' },
  { label: '韩漫', value: 'hanman' }
]

function HomeSectionListPage() {
  const endpoint = useSettingsStore(state => state.api)
  const search = Route.useSearch()
  const [page, setPage] = useState(1)
  const [category, setCategory] = useState(() => defaultCategoryForSearch(search))
  const [week, setWeek] = useState(String(currentChinaWeekday()))
  const [order, setOrder] = useState('new')

  useEffect(() => {
    setPage(1)
    setCategory(defaultCategoryForSearch(search))
    setWeek(String(currentChinaWeekday()))
    setOrder('new')
  }, [search])

  const query = useQuery({
    queryKey: queryKeys.homeSectionList(endpoint, search, page, category, week, order),
    queryFn: () =>
      getHomeSectionList({
        mode: search.mode,
        page,
        sectionId: search.sectionId,
        sectionTitle: search.title,
        slug: search.slug,
        type: search.type,
        filterValue: search.filterValue,
        category:
          search.mode === 'ranking'
            ? rankingCategoryApiValue(category, search.rankTag)
            : search.mode === 'weekly'
              ? category
              : null,
        week: search.mode === 'weekly' ? week : null,
        order: search.mode === 'ranking' ? order : null,
        endpoint
      }),
    staleTime: LIST_QUERY_STALE_TIME,
    gcTime: LIST_QUERY_GC_TIME,
    refetchOnMount: false,
    refetchOnWindowFocus: false
  })
  const items = query.data?.items ?? []
  const title = query.data?.title || search.title || sectionModeTitle(search.mode)

  function updateCategory(value: string) {
    setCategory(value)
    setPage(1)
  }

  function updateWeek(value: string) {
    setWeek(value)
    setPage(1)
  }

  function updateOrder(value: string) {
    setOrder(value)
    setPage(1)
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-6xl space-y-6 p-[96px_32px_32px_96px]">
        <div className="flex items-start gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="返回"
            onClick={() => window.history.back()}
          >
            <ArrowLeftIcon className="size-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <FeedHeader
              title={title}
              description={sectionModeDescription(search.mode)}
              isFetching={query.isFetching}
              onRefresh={() => query.refetch()}
            />
          </div>
        </div>

        <SectionFilters
          mode={search.mode}
          rankTag={search.rankTag}
          category={category}
          week={week}
          order={order}
          onCategoryChange={updateCategory}
          onWeekChange={updateWeek}
          onOrderChange={updateOrder}
        />

        {query.isError ? (
          <StatePanel
            title="列表加载失败"
            description={query.error.message}
            onRetry={() => query.refetch()}
          />
        ) : query.isLoading ? (
          <ComicGridSkeleton count={12} />
        ) : items.length === 0 ? (
          <StatePanel title="暂无内容" description="当前筛选条件下没有可展示的漫画。" />
        ) : (
          <>
            <ComicGrid items={items} />
            <SectionPagination
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

function SectionFilters({
  mode,
  rankTag,
  category,
  week,
  order,
  onCategoryChange,
  onWeekChange,
  onOrderChange
}: {
  mode: HomeSectionListMode
  rankTag: string
  category: string
  week: string
  order: string
  onCategoryChange: (value: string) => void
  onWeekChange: (value: string) => void
  onOrderChange: (value: string) => void
}) {
  if (mode === 'weekly') {
    return (
      <div className="flex justify-end gap-3">
        <FilterSelect
          value={week}
          options={WEEK_OPTIONS}
          placeholder="星期"
          onValueChange={onWeekChange}
        />
        <FilterSelect
          value={category}
          options={WEEK_CATEGORY_OPTIONS}
          placeholder="分类"
          onValueChange={onCategoryChange}
        />
      </div>
    )
  }

  if (mode === 'ranking') {
    const categoryOptions = rankingCategoryOptions(rankTag)

    return (
      <div className="flex justify-end gap-3">
        <FilterSelect
          value={order}
          options={RANKING_ORDER_OPTIONS}
          placeholder="排序"
          onValueChange={onOrderChange}
        />
        {categoryOptions.length > 1 ? (
          <FilterSelect
            value={category}
            options={categoryOptions}
            placeholder="分类"
            onValueChange={onCategoryChange}
          />
        ) : null}
      </div>
    )
  }

  return null
}

function FilterSelect({
  value,
  options,
  placeholder,
  onValueChange
}: {
  value: string
  options: FilterOption[]
  placeholder: string
  onValueChange: (value: string) => void
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options.map(option => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

function SectionPagination({
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

function sectionModeDescription(mode: HomeSectionListMode) {
  switch (mode) {
    case 'weekly':
      return '按星期和分类筛选连载更新'
    case 'latest':
      return '最新更新内容'
    case 'ranking':
      return '按分类和排序筛选更新内容'
    case 'promote':
    default:
      return '精选分组作品'
  }
}

function sectionModeTitle(mode: HomeSectionListMode) {
  switch (mode) {
    case 'weekly':
      return '每周连载更新'
    case 'latest':
      return '最新'
    case 'ranking':
      return '分类更新'
    case 'promote':
    default:
      return '推荐'
  }
}

function currentChinaWeekday() {
  const date = new Date()
  const chinaDate = new Date(date.getTime() + (date.getTimezoneOffset() + 480) * 60 * 1000)
  const day = chinaDate.getDay()

  return day === 0 ? 7 : day
}

function defaultCategoryForSearch(search: HomeSectionListSearch) {
  if (search.mode === 'ranking') {
    return defaultRankingCategory(search.rankTag)
  }

  return 'all'
}

function isHomeSectionListMode(value: unknown): value is HomeSectionListMode {
  return value === 'promote' || value === 'weekly' || value === 'latest' || value === 'ranking'
}
