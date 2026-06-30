import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { CalendarDaysIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { ComicGrid, ComicGridSkeleton, FeedHeader, StatePanel } from '@/components/comic-feed'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getWeekFilters, getWeekItems } from '@/lib/api/home'
import {
  LIST_QUERY_GC_TIME,
  LIST_QUERY_STALE_TIME,
  LONG_LIVED_FILTERS_GC_TIME,
  LONG_LIVED_FILTERS_STALE_TIME
} from '@/lib/query-cache'
import { queryKeys } from '@/lib/query-keys'
import { useSettingsStore } from '@/stores/settings-store'

export const Route = createFileRoute('/_app/weekly')({
  component: WeeklyPage
})

function WeeklyPage() {
  const endpoint = useSettingsStore(state => state.api)
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [typeId, setTypeId] = useState<string | null>(null)

  const filters = useQuery({
    queryKey: queryKeys.weekFilters(endpoint),
    queryFn: () => getWeekFilters(endpoint),
    staleTime: LONG_LIVED_FILTERS_STALE_TIME,
    gcTime: LONG_LIVED_FILTERS_GC_TIME,
    refetchOnMount: false,
    refetchOnWindowFocus: false
  })
  const categories = useMemo(() => filters.data?.categories ?? [], [filters.data])
  const types = useMemo(() => filters.data?.types ?? [], [filters.data])

  useEffect(() => {
    if (filters.data == null) {
      return
    }

    setCategoryId(current =>
      current != null && categories.some(category => category.id === current)
        ? current
        : (filters.data.defaultCategoryId ?? categories[0]?.id ?? null)
    )
    setTypeId(current =>
      current != null && types.some(type => type.id === current)
        ? current
        : (filters.data.defaultTypeId ?? types[0]?.id ?? null)
    )
  }, [categories, filters.data, types])

  const selectedCategoryId =
    categoryId ?? filters.data?.defaultCategoryId ?? categories[0]?.id ?? ''
  const selectedTypeId = typeId ?? filters.data?.defaultTypeId ?? types[0]?.id ?? ''
  const canLoadItems = selectedCategoryId.length > 0 && selectedTypeId.length > 0

  const items = useQuery({
    queryKey: queryKeys.weekItems(endpoint, selectedCategoryId, selectedTypeId, 1),
    queryFn: () =>
      getWeekItems({
        categoryId: selectedCategoryId,
        typeId: selectedTypeId,
        endpoint
    }),
    enabled: canLoadItems,
    staleTime: LIST_QUERY_STALE_TIME,
    gcTime: LIST_QUERY_GC_TIME,
    refetchOnMount: false,
    refetchOnWindowFocus: false
  })

  function refresh() {
    filters.refetch()
    if (canLoadItems) {
      items.refetch()
    }
  }

  return (
    <div className="flex flex-col gap-4 p-[96px_32px_16px_96px]">
      <FeedHeader
        title="每周推荐"
        description="为你精选的本周热门作品"
        isFetching={filters.isFetching || items.isFetching}
        onRefresh={refresh}
      />

      {filters.isError ? (
        <StatePanel
          title="每周推荐筛选加载失败"
          description={filters.error.message}
          onRetry={() => filters.refetch()}
        />
      ) : (
        <>
          <div className="mb-4 flex justify-between gap-3">
            {types.length > 0 ? (
              <Tabs value={selectedTypeId} onValueChange={value => setTypeId(value)}>
                <TabsList>
                  {types.map(type => (
                    <TabsTrigger key={type.id} value={type.id} className="min-w-16">
                      {type.title}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            ) : (
              <div className="h-9 w-64 animate-pulse rounded-md bg-muted" />
            )}

            {categories.length > 0 ? (
              <Select value={selectedCategoryId} onValueChange={value => setCategoryId(value)}>
                <SelectTrigger>
                  <CalendarDaysIcon className="size-4 text-muted-foreground" />
                  <SelectValue placeholder="选择期数" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {categories.map(category => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            ) : (
              <div className="h-9 w-full animate-pulse rounded-md bg-muted lg:w-[320px]" />
            )}
          </div>

          <section>
            {items.isError ? (
              <StatePanel
                title="每周推荐加载失败"
                description={items.error.message}
                onRetry={() => items.refetch()}
              />
            ) : !canLoadItems || items.isLoading ? (
              <ComicGridSkeleton />
            ) : items.data == null || items.data.items.length === 0 ? (
              <StatePanel title="暂无每周推荐" description="当前筛选条件下没有内容。" />
            ) : (
              <ComicGrid items={items.data.items} />
            )}
          </section>
        </>
      )}
    </div>
  )
}
