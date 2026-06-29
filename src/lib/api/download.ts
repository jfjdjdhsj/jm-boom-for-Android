import { invoke } from '@tauri-apps/api/core'

export type DownloadChapterRequest = {
  chapterId: string
  title: string
  order: number
}

export type EnqueueDownloadRequest = {
  albumId: string
  comicTitle: string
  endpoint?: string | null
  chapters: DownloadChapterRequest[]
}

export type DownloadTaskStatus =
  | 'queued'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type DownloadTask = {
  taskId: string
  albumId: string
  comicTitle: string
  endpoint: string
  chapters: DownloadChapterRequest[]
  status: DownloadTaskStatus
  currentChapterTitle: string
  totalPages: number
  completedPages: number
  etaSeconds: number | null
  speedBytesPerSecond: number
  outputDir: string
  error: string | null
  createdAt: number
  startedAt: number | null
  updatedAt: number
  completedAt: number | null
}

export type DownloadTaskListResult = {
  rootDir: string
  tasks: DownloadTask[]
}

export async function enqueueComicDownload(
  request: EnqueueDownloadRequest
): Promise<DownloadTaskListResult> {
  ensureTauriRuntime()

  return invoke<DownloadTaskListResult>('enqueue_comic_download', { request })
}

export async function listDownloadTasks(): Promise<DownloadTaskListResult> {
  ensureTauriRuntime()

  return invoke<DownloadTaskListResult>('list_download_tasks')
}

export async function cancelDownloadTask(taskId: string): Promise<DownloadTaskListResult> {
  ensureTauriRuntime()

  return invoke<DownloadTaskListResult>('cancel_download_task', { taskId })
}

export async function pauseDownloadTask(taskId: string): Promise<DownloadTaskListResult> {
  ensureTauriRuntime()

  return invoke<DownloadTaskListResult>('pause_download_task', { taskId })
}

export async function resumeDownloadTask(taskId: string): Promise<DownloadTaskListResult> {
  ensureTauriRuntime()

  return invoke<DownloadTaskListResult>('resume_download_task', { taskId })
}

export async function removeDownloadTask(taskId: string): Promise<DownloadTaskListResult> {
  ensureTauriRuntime()

  return invoke<DownloadTaskListResult>('remove_download_task', { taskId })
}

export async function openDownloadTaskDir(taskId: string): Promise<void> {
  ensureTauriRuntime()

  return invoke('open_download_task_dir', { taskId })
}

export async function openDownloadRootDir(): Promise<void> {
  ensureTauriRuntime()

  return invoke('open_download_root_dir')
}

function ensureTauriRuntime() {
  if (!('__TAURI_INTERNALS__' in window)) {
    throw new Error('This content needs the Tauri desktop runtime.')
  }
}
