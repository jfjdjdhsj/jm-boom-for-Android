import type { SignInRecord } from '@/lib/api/user'

export type SignInCalendarDay = {
  isoDate: string
  signed: boolean
  bonus: boolean
  hasRecord: boolean
  tooltip: string
}

export function buildSignInCalendar(records: SignInRecord[]) {
  const today = startOfDay(new Date())
  const currentMonth = today.getMonth()
  const currentYear = today.getFullYear()
  const currentMonthStart = new Date(currentYear, currentMonth, 1)
  const currentMonthEnd = new Date(currentYear, currentMonth + 1, 0)
  const start = startOfWeek(addMonths(currentMonthStart, -5))
  const end = endOfWeek(currentMonthEnd)
  const recordMap = new Map<string, SignInRecord>(
    records.flatMap(record => {
      const recordDate = normalizeSignInRecordDate(record)

      return recordDate ? [[recordDate, record] as const] : []
    })
  )
  const currentMonthFallbackMap = new Map(records.map(record => [record.day, record]))
  const days: Array<SignInCalendarDay | null> = []

  for (let date = new Date(start); date <= end; date = addDays(date, 1)) {
    const isoDate = toIsoDate(date)
    const isCurrentMonth = date.getFullYear() === currentYear && date.getMonth() === currentMonth
    const record =
      recordMap.get(isoDate) ??
      (isCurrentMonth ? currentMonthFallbackMap.get(date.getDate()) : undefined)
    const status = record ? (record.signed ? '已签到' : '未签到') : '无本地记录'

    days.push({
      isoDate,
      signed: record?.signed ?? false,
      bonus: record?.bonus ?? false,
      hasRecord: record != null,
      tooltip: `${formatChineseDate(date)}：${status}${record?.bonus ? '，额外奖励' : ''}`
    })
  }

  while (days.length % 7 !== 0) {
    days.push(null)
  }

  const weeks: Array<Array<SignInCalendarDay | null>> = []

  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7))
  }

  return { weeks }
}

export function longestStreak(records: SignInRecord[]) {
  let best = 0
  let current = 0

  for (const record of records) {
    if (record.signed) {
      current += 1
      best = Math.max(best, current)
    } else {
      current = 0
    }
  }

  return best
}

export function findTodayRecord(records: SignInRecord[]) {
  const today = new Date().getDate()

  return records.find(record => record.day === today)
}

function normalizeSignInRecordDate(record: SignInRecord) {
  const date = record.date.trim()

  if (!date) {
    return null
  }

  const match = /^(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})/.exec(date)

  if (!match) {
    return null
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function addMonths(date: Date, months: number) {
  const next = new Date(date)
  next.setMonth(next.getMonth() + months)
  return next
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function startOfWeek(date: Date) {
  const next = startOfDay(date)
  const offset = (next.getDay() + 6) % 7
  next.setDate(next.getDate() - offset)
  return next
}

function endOfWeek(date: Date) {
  const next = startOfDay(date)
  const offset = (7 - next.getDay()) % 7
  next.setDate(next.getDate() + offset)
  return next
}

function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatChineseDate(date: Date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}
