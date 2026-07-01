import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ListFilterIcon, SearchIcon } from 'lucide-react'
import { FormEvent, useEffect, useMemo, useState } from 'react'

import { ComicGrid, ComicGridSkeleton, FeedHeader, StatePanel } from '@/components/comic-feed'
import { ListPagination } from '@/components/list-pagination'
import { PageBackButton } from '@/components/page-back-button'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput
} from '@/components/ui/input-group'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { searchComic, type ComicListItem } from '@/lib/api/search'
import { LIST_QUERY_GC_TIME, LIST_QUERY_STALE_TIME } from '@/lib/query-cache'
import { queryKeys } from '@/lib/query-keys'
import { parsePositivePage } from '@/lib/route-search'
import { useSettingsStore } from '@/stores/settings-store'

type SearchPageSearch = {
  keyword: string
  page: number
  sortBy: SearchSortBy
}

type SearchSortBy = 1 | 2 | 3 | 4

export const Route = createFileRoute('/_app/search')({
  validateSearch: (search: Record<string, unknown>): SearchPageSearch => ({
    keyword: typeof search.keyword === 'string' ? search.keyword : '',
    page: parsePositivePage(search.page),
    sortBy: parseSortBy(search.sortBy)
  }),
  component: SearchPage
})

const SEARCH_SORT_OPTIONS = [
  { label: '从新到旧', value: '1' },
  { label: '最多观看', value: '2' },
  { label: '最多图片', value: '3' },
  { label: '最多点赞', value: '4' }
] as const

function SearchPage() {
  const endpoint = useSettingsStore(state => state.api)
  const navigate = useNavigate({ from: Route.fullPath })
  const search = Route.useSearch()
  const keyword = search.keyword.trim()
  const [draftKeyword, setDraftKeyword] = useState(search.keyword)

  useEffect(() => {
    setDraftKeyword(search.keyword)
  }, [search.keyword])

  const query = useQuery({
    queryKey: queryKeys.search(endpoint, keyword, search.page, search.sortBy),
    queryFn: () =>
      searchComic({
        keyword,
        page: search.page,
        extern: { sortBy: search.sortBy },
        endpoint
      }),
    enabled: keyword.length > 0,
    staleTime: LIST_QUERY_STALE_TIME,
    gcTime: LIST_QUERY_GC_TIME,
    refetchOnMount: false,
    refetchOnWindowFocus: false
  })
  const items = useMemo(() => mapSearchItems(query.data?.items ?? []), [query.data?.items])
  const paging = query.data?.paging

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextKeyword = draftKeyword.trim()

    void navigate({
      search: {
        keyword: nextKeyword,
        page: 1,
        sortBy: search.sortBy
      }
    })
  }

  function updateSortBy(value: string) {
    void navigate({
      replace: true,
      resetScroll: false,
      search: {
        keyword: search.keyword,
        page: 1,
        sortBy: parseSortBy(value)
      }
    })
  }

  function updatePage(page: number) {
    void navigate({
      replace: true,
      resetScroll: false,
      search: {
        keyword: search.keyword,
        page,
        sortBy: search.sortBy
      }
    })
  }

  return (
    <main className="app-page">
      <div className="app-page-content max-w-6xl space-y-6">
        <PageBackButton />
        <FeedHeader
          title="搜索"
          description="按关键词查找漫画作品"
          isFetching={query.isFetching}
          onRefresh={keyword.length > 0 ? () => query.refetch() : undefined}
        />

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <form className="w-full sm:max-w-xl" onSubmit={submitSearch}>
            <InputGroup className="h-10">
              <InputGroupAddon>
                <SearchIcon className="size-4" />
              </InputGroupAddon>
              <InputGroupInput
                value={draftKeyword}
                onChange={event => setDraftKeyword(event.target.value)}
                placeholder="搜索关键词或 JM 号"
                aria-label="搜索关键词"
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton type="submit" variant="secondary" size="sm">
                  搜索
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </form>

          <Select value={String(search.sortBy)} onValueChange={updateSortBy}>
            <SelectTrigger className="w-full sm:w-fit">
              <ListFilterIcon className="size-4 text-muted-foreground" />
              <SelectValue placeholder="选择排序" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {SEARCH_SORT_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <SearchContent
          keyword={keyword}
          isError={query.isError}
          errorMessage={query.error?.message}
          isLoading={query.isLoading}
          items={items}
          page={search.page}
          hasMore={!paging?.hasReachedMax}
          disabled={query.isFetching}
          onRetry={() => query.refetch()}
          onPageChange={updatePage}
        />
      </div>
    </main>
  )
}

function SearchContent({
  keyword,
  isError,
  errorMessage,
  isLoading,
  items,
  page,
  hasMore,
  disabled,
  onRetry,
  onPageChange
}: {
  keyword: string
  isError: boolean
  errorMessage?: string
  isLoading: boolean
  items: ReturnType<typeof mapSearchItems>
  page: number
  hasMore: boolean
  disabled: boolean
  onRetry: () => void
  onPageChange: (page: number) => void
}) {
  if (keyword.length === 0) {
    return <StatePanel title="输入关键词开始搜索" description="支持作品名、作者、标签或 JM 号。" />
  }

  if (isError) {
    return <StatePanel title="搜索失败" description={errorMessage} onRetry={onRetry} />
  }

  if (isLoading) {
    return <ComicGridSkeleton count={12} />
  }

  if (items.length === 0) {
    return <StatePanel title="没有搜索结果" description="换个关键词或排序方式再试试。" />
  }

  return (
    <>
      <ComicGrid items={items} />
      <ListPagination
        page={page}
        hasMore={hasMore}
        disabled={disabled}
        onPageChange={onPageChange}
      />
    </>
  )
}

function mapSearchItems(items: ComicListItem[]) {
  return items.map(item => ({
    id: item.id,
    title: item.title,
    author: searchItemAuthor(item),
    description: String(item.raw.description ?? ''),
    image: item.cover.url,
    tags: item.metadata
      .filter(meta => meta.type !== 'author')
      .flatMap(meta => meta.value)
      .filter(Boolean),
    updatedAt: Number.parseInt(item.updatedAt, 10) || null
  }))
}

function searchItemAuthor(item: ComicListItem) {
  const authorMeta = item.metadata.find(meta => meta.type === 'author')
  const author = authorMeta?.value.join(' / ').trim()

  return author || String(item.raw.author ?? '')
}

function parseSortBy(value: unknown): SearchSortBy {
  const sortBy = Number.parseInt(String(value ?? ''), 10)

  return sortBy === 2 || sortBy === 3 || sortBy === 4 ? sortBy : 1
}
