import { Sun, Moon } from 'lucide-react'
import { useThemeStore } from '../../stores/useThemeStore'

// Light/dark mode toggle, shared by the login screen and the top bar so the
// whole app keeps a consistent colour scheme.
export function ThemeToggle({ className = '' }: { className?: string }) {
  const theme = useThemeStore((s) => s.theme)
  const toggle = useThemeStore((s) => s.toggle)
  return (
    <button
      onClick={toggle}
      title={theme === 'dark' ? '切換為亮色模式' : '切換為深色模式'}
      className={`p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700
        dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100 transition-colors ${className}`}
    >
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  )
}
