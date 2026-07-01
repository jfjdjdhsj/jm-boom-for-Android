import { LoaderCircleIcon } from 'lucide-react'

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle
} from '@/components/ui/drawer'
import type { ComicComment } from '@/lib/api/comic'
import { CommentSkeletonList, StatePanel } from './shared'
import { formatCommentTime, formatNumber, htmlToText } from './utils'

export type CommentsState = {
  isLoading: boolean
  isFetchingNextPage: boolean
  isError: boolean
  errorMessage?: string
  total: number
  comments: ComicComment[]
  hasNextPage: boolean
  onRetry: () => void
  onLoadMore: () => void
}

export function CommentsDrawer({
  open,
  onOpenChange,
  state
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  state: CommentsState
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="h-full w-full max-w-[440px] overflow-hidden rounded-l-2xl p-0 before:inset-0 before:rounded-l-2xl before:rounded-r-none data-[vaul-drawer-direction=right]:w-full data-[vaul-drawer-direction=right]:sm:max-w-[440px]">
        <DrawerHeader>
          <DrawerTitle>评论</DrawerTitle>
          <DrawerDescription>共 {formatNumber(state.total)} 条评论</DrawerDescription>
        </DrawerHeader>

        <div
          className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 sm:px-6"
          onScroll={event => handleCommentsScroll(event.currentTarget, state)}
        >
          {state.isLoading ? (
            <CommentSkeletonList />
          ) : state.isError ? (
            <StatePanel
              title="评论加载失败"
              description={state.errorMessage}
              onRetry={state.onRetry}
            />
          ) : state.comments.length === 0 ? (
            <StatePanel title="暂无评论" description="当前作品还没有返回评论内容。" />
          ) : (
            <div className="space-y-5">
              {state.comments.map(comment => (
                <CommentItem key={comment.id} comment={comment} />
              ))}
              <CommentsEndState state={state} />
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}

function CommentsEndState({ state }: { state: CommentsState }) {
  if (state.isFetchingNextPage) {
    return (
      <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
        <LoaderCircleIcon className="size-3.5 animate-spin" />
        正在加载评论
      </div>
    )
  }

  if (state.hasNextPage) {
    return <p className="py-2 text-center text-xs text-muted-foreground">继续向下滚动加载更多</p>
  }

  return <p className="py-2 text-center text-xs text-muted-foreground">暂无更多评论</p>
}

function CommentItem({ comment }: { comment: ComicComment }) {
  const name = comment.nickname || comment.username || `用户 ${comment.userId}`
  const content = htmlToText(comment.content)

  return (
    <div className="space-y-3 px-px py-1">
      <div className="space-y-1">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium">{name}</span>
          </div>
          <div className="text-xs text-muted-foreground">{formatCommentTime(comment.time)}</div>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs text-card-foreground">{content || '这条评论没有内容'}</p>

        {comment.replies.length > 0 ? (
          <div className="space-y-2 rounded-md bg-muted/60 p-3">
            {comment.replies.map(reply => (
              <ReplyItem key={reply.id} reply={reply} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function ReplyItem({ reply }: { reply: ComicComment }) {
  const name = reply.nickname || reply.username || `用户 ${reply.userId}`
  const content = htmlToText(reply.content)

  return (
    <div className="text-xs">
      <span className="font-medium">{name}</span>
      <span className="text-muted-foreground"> ：{content || '这条回复没有内容'}</span>
    </div>
  )
}

function handleCommentsScroll(element: HTMLDivElement, state: CommentsState) {
  if (!state.hasNextPage || state.isFetchingNextPage) {
    return
  }

  const distanceToBottom = element.scrollHeight - element.scrollTop - element.clientHeight

  if (distanceToBottom <= 80) {
    state.onLoadMore()
  }
}
