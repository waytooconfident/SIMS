import { create } from 'zustand'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'sims-theme'

function apply(theme: Theme): void {
  const root = document.documentElement
  if (theme === 'dark') root.classList.add('dark')
  else root.classList.remove('dark')
}

function initialTheme(): Theme {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

// Resolve & apply once at module load (before first paint) to avoid a flash.
const start = initialTheme()
apply(start)

interface ThemeState {
  theme: Theme
  toggle: () => void
  setTheme: (t: Theme) => void
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: start,
  toggle: () => {
    const next: Theme = get().theme === 'dark' ? 'light' : 'dark'
    localStorage.setItem(STORAGE_KEY, next)
    apply(next)
    set({ theme: next })
  },
  setTheme: (t) => {
    localStorage.setItem(STORAGE_KEY, t)
    apply(t)
    set({ theme: t })
  }
}))
