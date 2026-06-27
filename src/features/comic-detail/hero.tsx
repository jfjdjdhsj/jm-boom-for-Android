import { Link } from '@tanstack/react-router'
import {
  BookOpenIcon,
  BookmarkIcon,
  BookmarkCheckIcon,
  DownloadIcon,
  EyeIcon,
  HeartIcon,
  LayersIcon,
  MessageCircleIcon,
  UserRoundIcon,
  type LucideIcon
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type { ComicDetail } from '@/lib/api/comic'
import { ComicCover } from './shared'
import { formatNumber, getNextChapter, resolveAlbumId } from './utils'

export function ComicHero({
  comic,
  onCommentsClick,
  onFavoriteClick,
  favoriteBusy = false
}: {
  comic: ComicDetail
  onCommentsClick: () => void
  onFavoriteClick: () => void
  favoriteBusy?: boolean
}) {
  const authors = comic.author.length > 0 ? comic.author.join(' / ') : 'N/A'
  const albumId = resolveAlbumId(comic)
  const nextChapter = getNextChapter(comic.id, comic.series)
  const statusBadges = [
    comic.price > 0 ? `${comic.price} 积分` : '免费',
    comic.purchased ? '已购买' : '',
    comic.isFavorite ? '已收藏' : '',
    comic.liked ? '已点赞' : ''
  ].filter(Boolean)

  return (
    <section className="grid grid-cols-[240px_minmax(0,1fr)] gap-8">
      <ComicCover id={comic.id} title={comic.title} image={comic.image} className="w-full" />

      <div className="min-w-0 space-y-5 py-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="default">JM {comic.id}</Badge>
          {statusBadges.map(badge => (
            <Badge key={badge} variant="outline">
              {badge}
            </Badge>
          ))}
        </div>

        <div className="space-y-2">
          <h1 className="text-4xl leading-tight font-bold tracking-normal">{comic.title}</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <UserRoundIcon className="size-4" />
            <span className="truncate">{authors}</span>
          </div>
        </div>

        <Separator />
        <StatsRow comic={comic} onCommentsClick={onCommentsClick} />
        <Separator />

        <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
          {comic.description || '暂无简介'}
        </p>

        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link
              to="/reader/$comicId"
              params={{ comicId: comic.id }}
              search={{
                title: comic.title,
                chapter: '正文',
                albumId,
                fromDetail: '1',
                pageIndex: '0',
                nextId: nextChapter?.id ?? '',
                nextChapter: nextChapter?.title ?? ''
              }}
            >
              <BookOpenIcon className="size-4" />
              开始阅读
            </Link>
          </Button>
          <Button variant="outline" disabled>
            <DownloadIcon className="size-4" />
            下载
          </Button>
          <Button variant={comic.isFavorite ? 'secondary' : 'outline'} onClick={onFavoriteClick} disabled={favoriteBusy}>
            {comic.isFavorite ? <BookmarkCheckIcon className="size-4" /> : <BookmarkIcon className="size-4" />}
            {comic.isFavorite ? '已收藏' : '收藏'}
          </Button>
        </div>

        <div className="space-y-3">
          <PillGroup title="标签" items={comic.tags} />
          <PillGroup title="角色" items={comic.actors} variant="secondary" />
          <PillGroup title="作品" items={comic.works} variant="secondary" />
        </div>
      </div>
    </section>
  )
}

function StatsRow({ comic, onCommentsClick }: { comic: ComicDetail; onCommentsClick: () => void }) {
  const stats: Array<{
    id: string
    label: string
    value: string
    icon: LucideIcon
    onClick?: () => void
  }> = [
    { id: 'views', label: '浏览', value: formatNumber(comic.totalViews), icon: EyeIcon },
    { id: 'likes', label: '喜欢', value: formatNumber(comic.likes), icon: HeartIcon },
    {
      id: 'comments',
      label: '评论',
      value: formatNumber(comic.commentTotal),
      icon: MessageCircleIcon,
      onClick: onCommentsClick
    },
    { id: 'chapters', label: '章节', value: formatNumber(comic.series.length), icon: LayersIcon }
  ]

  return (
    <div className="flex items-stretch rounded-md bg-card/60 text-center text-sm">
      {stats.map((stat, index) => {
        const content = (
          <>
            <div className="flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground">
              <stat.icon className="size-4" />
              {stat.label}
            </div>
            <div className="text-xl font-semibold">{stat.value}</div>
          </>
        )

        return (
          <div key={stat.id} className="flex min-w-0 flex-1 items-stretch">
            {stat.onClick ? (
              <button
                type="button"
                className="flex min-w-0 flex-1 cursor-pointer flex-col items-center justify-center space-y-1 rounded-sm p-4 transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                onClick={stat.onClick}
              >
                {content}
              </button>
            ) : (
              <div className="flex min-w-0 flex-1 flex-col items-center justify-center space-y-1 p-4">
                {content}
              </div>
            )}
            {index < stats.length - 1 ? <Separator orientation="vertical" /> : null}
          </div>
        )
      })}
    </div>
  )
}

function PillGroup({
  title,
  items,
  variant = 'outline'
}: {
  title: string
  items: string[]
  variant?: 'outline' | 'secondary'
}) {
  if (items.length === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-10 text-xs text-muted-foreground">{title}</span>
      {items.map(item => (
        <Badge key={`${title}-${item}`} variant={variant}>
          {item}
        </Badge>
      ))}
    </div>
  )
}
