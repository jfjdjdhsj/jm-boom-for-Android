import { convertFileSrc, invoke } from '@tauri-apps/api/core'

export type ComicReadManifestResult = {
  endpoint: string
  readId: string
  shunt: string
  pageCount: number
  cacheLimitBytes: number
}

export type ComicReadPageResult = {
  readId: string
  index: number
  path: string
  width: number
  height: number
  aspectRatio: number
  isCached: boolean
}

export type ComicReadPrefetchResult = {
  requested: number
  completed: number
}

export async function getComicReadManifest({
  readId,
  shunt = null,
  endpoint = null
}: {
  readId: string
  shunt?: string | null
  endpoint?: string | null
}): Promise<ComicReadManifestResult> {
  ensureTauriRuntime()

  return invoke<ComicReadManifestResult>('get_comic_read_manifest', {
    readId,
    shunt,
    endpoint
  })
}

export async function getComicReadPage({
  readId,
  index,
  shunt = null,
  endpoint = null
}: {
  readId: string
  index: number
  shunt?: string | null
  endpoint?: string | null
}): Promise<ComicReadPageResult> {
  ensureTauriRuntime()

  return invoke<ComicReadPageResult>('get_comic_read_page', {
    readId,
    index,
    shunt,
    endpoint
  })
}

export async function prefetchComicReadPages({
  readId,
  centerIndex,
  radius = 3,
  shunt = null,
  endpoint = null
}: {
  readId: string
  centerIndex: number
  radius?: number
  shunt?: string | null
  endpoint?: string | null
}): Promise<ComicReadPrefetchResult> {
  ensureTauriRuntime()

  return invoke<ComicReadPrefetchResult>('prefetch_comic_read_pages', {
    readId,
    centerIndex,
    radius,
    shunt,
    endpoint
  })
}

export function readerFileSrc(path: string) {
  return convertFileSrc(path)
}

function ensureTauriRuntime() {
  if (!('__TAURI_INTERNALS__' in window)) {
    throw new Error('This content needs the Tauri desktop runtime.')
  }
}
