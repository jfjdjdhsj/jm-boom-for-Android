import { invoke } from '@tauri-apps/api/core'

export type UserProfile = {
  id: number
  username: string
  email: string
  avatar: string
  avatarUrl: string
  level: number
  levelName: string
  currentLevelExp: number
  nextLevelExp: number
  expPercent: number
  currentCollectCount: number
  maxCollectCount: number
  jCoin: number
}

export type LoginResult = {
  endpoint: string
  user: UserProfile
}

export type SignInRecord = {
  day: number
  date: string
  signed: boolean
  bonus: boolean
}

export type SignInDataResult = {
  endpoint: string
  dailyId: number
  threeDaysCoin: number
  threeDaysExp: number
  sevenDaysCoin: number
  sevenDaysExp: number
  eventName: string
  currentProgress: string
  backgroundPc: string
  backgroundPhone: string
  records: SignInRecord[]
}

export type SignInResult = {
  endpoint: string
  message: string
}

export async function login({
  username,
  password,
  endpoint = null
}: {
  username: string
  password: string
  endpoint?: string | null
}): Promise<LoginResult> {
  ensureTauriRuntime()

  return invoke<LoginResult>('login', { username, password, endpoint })
}

export async function getSignInData({
  userId,
  endpoint = null
}: {
  userId: number
  endpoint?: string | null
}): Promise<SignInDataResult> {
  ensureTauriRuntime()

  return invoke<SignInDataResult>('get_sign_in_data', { userId, endpoint })
}

export async function signIn({
  userId,
  dailyId,
  endpoint = null
}: {
  userId: number
  dailyId: number
  endpoint?: string | null
}): Promise<SignInResult> {
  ensureTauriRuntime()

  return invoke<SignInResult>('sign_in', { userId, dailyId, endpoint })
}

export async function clearSession() {
  ensureTauriRuntime()

  return invoke('clear_session')
}

function ensureTauriRuntime() {
  if (!('__TAURI_INTERNALS__' in window)) {
    throw new Error('This content needs the Tauri desktop runtime.')
  }
}
