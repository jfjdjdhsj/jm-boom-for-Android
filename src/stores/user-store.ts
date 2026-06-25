import { create } from 'zustand'

import { clearSession, login as loginRequest, type UserProfile } from '@/lib/api/user'

type UserStore = {
  user: UserProfile | null
  endpoint: string | null
  isLoggingIn: boolean
  login: (params: { username: string; password: string; endpoint?: string | null }) => Promise<UserProfile>
  logout: () => Promise<void>
}

export const useUserStore = create<UserStore>()(set => ({
  user: null,
  endpoint: null,
  isLoggingIn: false,
  login: async ({ username, password, endpoint = null }) => {
    set({ isLoggingIn: true })

    try {
      const result = await loginRequest({ username, password, endpoint })

      set({
        user: result.user,
        endpoint: result.endpoint,
        isLoggingIn: false
      })

      return result.user
    } catch (error) {
      set({ isLoggingIn: false })
      throw error
    }
  },
  logout: async () => {
    await clearSession()
    set({ user: null, endpoint: null })
  }
}))
