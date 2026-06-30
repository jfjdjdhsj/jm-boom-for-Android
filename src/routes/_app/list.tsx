import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'

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
import { parsePositivePage, parseStringSearch } from '@/lib/route-search'
import { useSettingsStore } from '@/stores/settings-store'

type HomeSectionListSearch = {
  mode: HomeSectionListMode
  page: number
  sectionId: string
  title: string
  slug: string
  type: string
  filterValue: string
  rankTag: string
  category: string
  week: string
  order: string
}

export const Route = createFileRoute('/_app/list')({
  validateSearch: (search: Record<string, unknown>): HomeSectionListSearch => {
    const mode = isHomeSectionListMode(search.mode) ? search.mode : 'promote'
    const rankTag = parseStringSearch(search.rankTag)

    return {
      mode,
      page: parsePositivePage(search.page),
      sectionId: parseStringSearch(search.sectionId),
      title: parseStringSearch(search.title),
      slug: parseStringSearch(search.slug),
      type: parseStringSearch(search.type),
      filterValue: parseStringSearch(search.filterValue),
      rankTag,
      category: parseListCategory(mode, rankTag, search.category),
      week: parseListWeek(search.week),
      order: parseListOrder(search.order)
    }
  },
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
  const navigate = useNavigate({ from: Route.fullPath })
  const search = Route.useSearch()

  const query = useQuery({
    queryKey: queryKeys.homeSectionList(endpoint, search),
    queryFn: () =>
      getHomeSectionList({
        mode: search.mode,
        page: search.page,
        sectionId: search.sectionId,
        sectionTitle: search.title,
        slug: search.slug,
        type: search.type,
        filterValue: search.filterValue,
        category:
          search.mode === 'ranking'
            ? rankingCategoryApiValue(search.category, search.rankTag)
            : search.mode === 'weekly'
              ? search.category
              : null,
        week: search.mode === 'weekly' ? search.week : null,
        order: search.mode === 'ranking' ? search.order : null,
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
    void navigate({
      replace: true,
      resetScroll: false,
      search: {
        ...search,
        page: 1,
        category: parseListCategory(search.mode, search.rankTag, value)
      }
    })
  }

  function updateWeek(value: string) {
    void navigate({
      replace: true,
      resetScroll: false,
      search: {
        ...search,
        page: 1,
        week: parseListWeek(value)
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
        order: parseListOrder(value)
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
      <div className="mx-auto w-full max-w-6xl space-y-6 p-[96px_32px_32px_96px]">
        <PageBackButton />
        <FeedHeader
          title={title}
          description={sectionModeDescription(search.mode)}
          isFetching={query.isFetching}
          onRefresh={() => query.refetch()}
        />

        <SectionFilters
          mode={search.mode}
          rankTag={search.rankTag}
          category={search.category}
          week={search.week}
          order={search.order}
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

function defaultCategoryForMode(mode: HomeSectionListMode, rankTag: string) {
  if (mode === 'ranking') {
    return defaultRankingCategory(rankTag)
  }

  return 'all'
}

function parseListCategory(mode: HomeSectionListMode, rankTag: string, value: unknown) {
  const fallback = defaultCategoryForMode(mode, rankTag)
  const category = parseStringSearch(value, fallback)

  if (mode === 'ranking') {
    return rankingCategoryOptions(rankTag).some(option => option.value === category)
      ? category
      : fallback
  }

  if (mode === 'weekly') {
    return WEEK_CATEGORY_OPTIONS.some(option => option.value === category) ? category : fallback
  }

  return fallback
}

function parseListWeek(value: unknown) {
  const week = parseStringSearch(value, String(currentChinaWeekday()))

  return WEEK_OPTIONS.some(option => option.value === week) ? week : String(currentChinaWeekday())
}

function parseListOrder(value: unknown) {
  const order = parseStringSearch(value, 'new')

  return RANKING_ORDER_OPTIONS.some(option => option.value === order) ? order : 'new'
}

function isHomeSectionListMode(value: unknown): value is HomeSectionListMode {
  return value === 'promote' || value === 'weekly' || value === 'latest' || value === 'ranking'
}
