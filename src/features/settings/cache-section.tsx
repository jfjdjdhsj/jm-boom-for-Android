import type { UseQueryResult } from '@tanstack/react-query'
import { HardDriveIcon, LoaderCircleIcon, Trash2Icon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import type { ReaderCacheStatsResult } from '@/lib/api/reader'
import { formatBytes } from '@/lib/format'
import { READER_CACHE_LIMITS_MB } from '@/stores/settings-store'
import { SettingRow, SettingsSection } from './shared'

export function CacheSection({
  readerCacheLimitMb,
  stats,
  isClearingCache,
  onCacheLimitChange,
  onClearCache
}: {
  readerCacheLimitMb: number
  stats: UseQueryResult<ReaderCacheStatsResult, Error>
  isClearingCache: boolean
  onCacheLimitChange: (limitMb: number) => void
  onClearCache: () => void
}) {
  return (
    <SettingsSection icon={<HardDriveIcon className="size-4" />} title="缓存">
      <SettingRow title="当前缓存大小" description="已解码图片当前占用的磁盘空间">
        <CacheSize stats={stats} />
      </SettingRow>
      <SettingRow title="缓存大小设置" description="超过上限后会自动清理较旧的图片缓存">
        <Select
          value={String(readerCacheLimitMb)}
          onValueChange={value => onCacheLimitChange(Number(value))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {READER_CACHE_LIMITS_MB.map(limit => (
                <SelectItem key={limit} value={String(limit)}>
                  {formatCacheLimit(limit)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </SettingRow>
      <SettingRow title="清理缓存" description="删除已解码的图片缓存">
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={isClearingCache || stats.data?.totalBytes === 0}
          onClick={onClearCache}
        >
          {isClearingCache ? (
            <LoaderCircleIcon className="size-4 animate-spin" />
          ) : (
            <Trash2Icon className="size-4" />
          )}
          清理缓存
        </Button>
      </SettingRow>
    </SettingsSection>
  )
}

function CacheSize({ stats }: { stats: UseQueryResult<ReaderCacheStatsResult, Error> }) {
  if (stats.isLoading) {
    return <span className="text-sm text-muted-foreground">正在计算</span>
  }

  if (stats.isError) {
    return <span className="text-sm text-destructive">读取失败</span>
  }

  if (!stats.data) {
    return <span className="text-sm text-muted-foreground">0 B</span>
  }

  return (
    <div className="text-right">
      <div className="text-sm font-medium">{formatBytes(stats.data.totalBytes)}</div>
      <div className="mt-1 text-xs text-muted-foreground">{stats.data.fileCount} 个文件</div>
    </div>
  )
}

function formatCacheLimit(limitMb: number) {
  return limitMb >= 1024 ? `${limitMb / 1024} GB` : `${limitMb} MB`
}
