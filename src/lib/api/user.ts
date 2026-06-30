import { tauriInvoke } from './tauri'

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
  return tauriInvoke<LoginResult>('login', { username, password, endpoint })
}

export async function getSignInData({
  userId,
  endpoint = null
}: {
  userId: number
  endpoint?: string | null
}): Promise<SignInDataResult> {
  return tauriInvoke<SignInDataResult>('get_sign_in_data', { userId, endpoint })
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
  return tauriInvoke<SignInResult>('sign_in', { userId, dailyId, endpoint })
}

export async function clearSession(): Promise<void> {
  return tauriInvoke<void>('clear_session')
}
