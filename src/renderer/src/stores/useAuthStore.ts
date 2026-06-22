import { create } from 'zustand'
import type { User } from '@shared/types'

interface AuthState {
  user: User | null
  ready: boolean              // startup auto-login check finished
  setUser: (u: User | null) => void
  bootstrap: () => Promise<void>   // attempt remembered auto-login
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  ready: false,

  setUser: (user) => set({ user }),

  bootstrap: async () => {
    const user = await window.api.auth.autoLogin()
    set({ user: user ?? null, ready: true })
  },

  logout: async () => {
    await window.api.auth.logout()
    set({ user: null })
  }
}))
