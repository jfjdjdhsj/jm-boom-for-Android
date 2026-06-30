import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import {
  BanIcon,
  CheckCircle2Icon,
  ClockIcon,
  FolderOpenIcon,
  LoaderCircleIcon,
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
  Trash2Icon
} from 'lucide-react'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  cancelDownloadTask,
  listDownloadTasks,
  openDownloadRootDir,
  openDownloadTaskDir,
  pauseDownloadTask,
  removeDownloadTask,
  resumeDownloadTask,
  type DownloadTask,
  type DownloadTaskListResult,
  type DownloadTaskStatus
} from '@/lib/api/download'
import { formatBytes, formatDuration } from '@/lib/format'
import { queryKeys } from '@/lib/query-keys'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_app/downloads')({
  component: DownloadsPage
})

const DOWNLOAD_FILTERS = [
  { value: 'all', label: '全部' },
  { value: 'active', label: '下载中' },
  { value: 'paused', label: '已暂停' },
  { value: 'completed', label: '已完成' }
] as const
const EMPTY_DOWNLOAD_TASKS: DownloadTask[] = []

type DownloadFilter = (typeof DOWNLOAD_FILTERS)[number]['value']

function DownloadsPage() {
  const [filter, setFilter] = useState<DownloadFilter>('all')
  const tasks = useQuery({
    queryKey: queryKeys.downloadTasks(),
    queryFn: listDownloadTasks,
    refetchInterval: 1000,
    refetchOnWindowFocus: false
  })
  const cancelTask = useTaskMutation(cancelDownloadTask, '已取消下载任务')
  const pauseTask = useTaskMutation(pauseDownloadTask, '已暂停下载任务')
  const resumeTask = useTaskMutation(resumeDownloadTask, '已加入下载队列')
  const removeTask = useTaskMutation(removeDownloadTask, '已删除下载任务和文件')
  const openTaskDir = useMutation({
    mutationFn: openDownloadTaskDir,
    onError: showError
  })
  const openRootDir = useMutation({
    mutationFn: openDownloadRootDir,
    onError: showError
  })
  const taskList = tasks.data?.tasks ?? EMPTY_DOWNLOAD_TASKS
  const filterCounts = useMemo(() => getFilterCounts(taskList), [taskList])
  const filteredTasks = useMemo(
    () => taskList.filter(task => matchesFilter(task, filter)),
    [filter, taskList]
  )

  return (
    <main className="min-h-screen bg-background p-[96px_32px_32px_96px] text-foreground">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-normal">下载</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              查看下载进度、剩余时间和已完成文件目录
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={openRootDir.isPending}
            onClick={() => openRootDir.mutate()}
          >
            <FolderOpenIcon className="size-4" />
            下载目录
          </Button>
        </header>

        <Tabs value={filter} onValueChange={value => setFilter(value as DownloadFilter)}>
          <TabsList>
            {DOWNLOAD_FILTERS.map(item => (
              <TabsTrigger key={item.value} value={item.value} className="min-w-20">
                {item.label}
                <span className="ml-1 tabular-nums text-muted-foreground">
                  {filterCounts[item.value]}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {tasks.isLoading ? (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            <LoaderCircleIcon className="mr-2 size-4 animate-spin" />
            正在读取下载任务
          </div>
        ) : tasks.isError ? (
          <Card>
            <CardContent className="p-6 text-sm text-destructive">
              {tasks.error.message}
            </CardContent>
          </Card>
        ) : taskList.length === 0 ? (
          <DownloadEmptyState label="暂无下载任务" />
        ) : filteredTasks.length === 0 ? (
          <DownloadEmptyState label="当前筛选下暂无任务" />
        ) : (
          <div className="space-y-3">
            {filteredTasks.map(task => (
              <DownloadTaskCard
                key={task.taskId}
                task={task}
                isCancelling={cancelTask.isPending}
                isPausing={pauseTask.isPending}
                isResuming={resumeTask.isPending}
                isRemoving={removeTask.isPending}
                isOpening={openTaskDir.isPending}
                onCancel={() => cancelTask.mutate(task.taskId)}
                onPause={() => pauseTask.mutate(task.taskId)}
                onResume={() => resumeTask.mutate(task.taskId)}
                onRemove={() => removeTask.mutate(task.taskId)}
                onOpen={() => openTaskDir.mutate(task.taskId)}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

function useTaskMutation(
  mutationFn: (taskId: string) => Promise<DownloadTaskListResult>,
  message: string
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn,
    onSuccess: result => {
      queryClient.setQueryData(queryKeys.downloadTasks(), result)
      toast.success(message)
    },
    onError: showError
  })
}

function DownloadTaskCard({
  task,
  isCancelling,
  isPausing,
  isResuming,
  isRemoving,
  isOpening,
  onCancel,
  onPause,
  onResume,
  onRemove,
  onOpen
}: {
  task: DownloadTask
  isCancelling: boolean
  isPausing: boolean
  isResuming: boolean
  isRemoving: boolean
  isOpening: boolean
  onCancel: () => void
  onPause: () => void
  onResume: () => void
  onRemove: () => void
  onOpen: () => void
}) {
  const progress = task.totalPages > 0 ? task.completedPages / task.totalPages : 0
  const progressPercent = Math.min(100, Math.round(progress * 100))
  const canPause = task.status === 'queued' || task.status === 'running'
  const canResume = task.status === 'paused'
  const canRetry = task.status === 'failed'
  const canCancel = task.status === 'queued' || task.status === 'running' || task.status === 'paused'
  const canRemove = task.status !== 'running'

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <StatusIcon status={task.status} />
              <OverflowTooltipTitle title={task.comicTitle} />
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {formatChapterSummary(task)}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" disabled={isOpening} onClick={onOpen}>
              <FolderOpenIcon className="size-4" />
              目录
            </Button>
            {canPause ? (
              <Button variant="outline" size="sm" disabled={isPausing} onClick={onPause}>
                <PauseIcon className="size-4" />
                暂停
              </Button>
            ) : null}
            {canResume ? (
              <Button variant="outline" size="sm" disabled={isResuming} onClick={onResume}>
                <PlayIcon className="size-4" />
                恢复
              </Button>
            ) : null}
            {canRetry ? (
              <Button variant="outline" size="sm" disabled={isResuming} onClick={onResume}>
                <RotateCcwIcon className="size-4" />
                重试
              </Button>
            ) : null}
            {canCancel ? (
              <Button variant="outline" size="sm" disabled={isCancelling} onClick={onCancel}>
                <BanIcon className="size-4" />
                取消
              </Button>
            ) : null}
            {canRemove ? (
              <DeleteTaskDialog
                comicTitle={task.comicTitle}
                disabled={isRemoving}
                onConfirm={onRemove}
              />
            ) : null}
          </div>
        </div>

        <div className="space-y-2">
          <Progress value={progressPercent} className="h-1.5" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{formatProgressLabel(task, progressPercent)}</span>
            <span>{formatTaskMeta(task)}</span>
          </div>
        </div>

        {task.error ? <div className="text-xs text-destructive">{task.error}</div> : null}
      </CardContent>
    </Card>
  )
}

function getFilterCounts(tasks: DownloadTask[]): Record<DownloadFilter, number> {
  return {
    all: tasks.length,
    active: tasks.filter(task => task.status === 'running' || task.status === 'queued').length,
    paused: tasks.filter(task => task.status === 'paused').length,
    completed: tasks.filter(task => task.status === 'completed').length
  }
}

function matchesFilter(task: DownloadTask, filter: DownloadFilter) {
  if (filter === 'active') return task.status === 'running' || task.status === 'queued'
  if (filter === 'paused') return task.status === 'paused'
  if (filter === 'completed') return task.status === 'completed'
  return true
}

function formatChapterSummary(task: DownloadTask) {
  const chapterCount = task.chapters.length

  return chapterCount > 1 ? `${chapterCount} 个章节` : task.chapters[0]?.title || '正文'
}

function formatProgressLabel(task: DownloadTask, progressPercent: number) {
  return task.totalPages > 0 ? `${progressPercent}%` : '准备中'
}

function StatusIcon({ status }: { status: DownloadTaskStatus }) {
  if (status === 'completed') {
    return <CheckCircle2Icon className="size-4 text-emerald-600" />
  }

  if (status === 'running') {
    return <LoaderCircleIcon className="size-4 animate-spin text-primary" />
  }

  if (status === 'queued') {
    return <ClockIcon className="size-4 text-muted-foreground" />
  }

  if (status === 'paused') {
    return <PauseIcon className="size-4 text-muted-foreground" />
  }

  return (
    <BanIcon
      className={cn('size-4', status === 'failed' ? 'text-destructive' : 'text-muted-foreground')}
    />
  )
}

function formatTaskMeta(task: DownloadTask) {
  const speed = `${formatBytes(task.speedBytesPerSecond)}/S`

  if (task.status === 'running') {
    return task.etaSeconds && task.etaSeconds > 0
      ? `${speed} · 剩余约 ${formatDuration(task.etaSeconds)}`
      : `${speed} · 正在下载`
  }

  if (task.status === 'queued') return `${speed} · 等待中`
  if (task.status === 'paused') return '已暂停'
  if (task.status === 'completed') return '已完成'
  if (task.status === 'cancelled') return '已取消'
  return '失败'
}

function showError(error: unknown) {
  toast.error(error instanceof Error ? error.message : String(error))
}

function DownloadEmptyState({ label }: { label: string }) {
  return (
    <Card>
      <CardContent className="flex h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
        <ClockIcon className="size-10" />
        <div className="text-sm">{label}</div>
      </CardContent>
    </Card>
  )
}

function OverflowTooltipTitle({ title }: { title: string }) {
  const titleRef = useRef<HTMLHeadingElement>(null)
  const [isOverflowing, setIsOverflowing] = useState(false)
  const titleElement = (
    <h2 ref={titleRef} className="min-w-0 flex-1 truncate text-base font-medium">
      {title}
    </h2>
  )

  useEffect(() => {
    const element = titleRef.current

    if (!element) {
      return
    }

    const target = element
    let frame = 0

    function updateOverflow() {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        setIsOverflowing(target.scrollWidth > target.clientWidth + 1)
      })
    }

    updateOverflow()

    const resizeObserver = new ResizeObserver(updateOverflow)
    resizeObserver.observe(target)

    return () => {
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
    }
  }, [title])

  if (!isOverflowing) {
    return titleElement
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{titleElement}</TooltipTrigger>
      <TooltipContent side="top">{title}</TooltipContent>
    </Tooltip>
  )
}

function DeleteTaskDialog({
  comicTitle,
  disabled,
  onConfirm
}: {
  comicTitle: string
  disabled: boolean
  onConfirm: () => void
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" disabled={disabled}>
          <Trash2Icon className="size-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogTitle className="text-sm font-semibold">删除下载任务</AlertDialogTitle>
        <AlertDialogDescription className="text-sm text-muted-foreground">
          将删除“{comicTitle}”的下载任务和已保存文件，此操作不可撤销。
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            删除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
