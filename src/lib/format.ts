const BYTE_UNITS = ['B', 'KB', 'MB', 'GB'] as const

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B'
  }

  let value = bytes
  let unitIndex = 0

  while (value >= 1024 && unitIndex < BYTE_UNITS.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${BYTE_UNITS[unitIndex]}`
}

export function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds} 秒`

  const minutes = Math.ceil(seconds / 60)

  if (minutes < 60) return `${minutes} 分钟`

  return `${Math.ceil(minutes / 60)} 小时`
}
