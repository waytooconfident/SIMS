import { RefreshCw, LogOut } from 'lucide-react'
import { useExchangeRateStore } from '../../stores/useExchangeRateStore'
import { useAuthStore } from '../../stores/useAuthStore'
import { AvatarView } from '../common/AvatarView'
import { ThemeToggle } from '../common/ThemeToggle'
import type { ActiveView } from '../../App'

const VIEW_LABELS: Record<ActiveView, string> = {
  sales:      '銷售紀錄',
  inventory:  '庫存管理',
  analytics:  '數據分析',
  settings:   '系統設定'
}

export function TopBar({ activeView }: { activeView: ActiveView }) {
  const rate = useExchangeRateStore((s) => s.rate)
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  return (
    <header className="h-14 shrink-0 bg-white border-b border-gray-200 flex items-center px-6 gap-4 dark:bg-gray-800 dark:border-gray-700">
      <h1 className="text-base font-semibold text-gray-800 flex-1 dark:text-gray-100">{VIEW_LABELS[activeView]}</h1>

      {/* Global exchange rate badge */}
      <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-medium dark:bg-indigo-500/10 dark:border-indigo-500/40 dark:text-indigo-300">
        <RefreshCw size={12} />
        匯率 1 RMB = {rate.toFixed(2)} NTD
      </div>

      <ThemeToggle />

      {/* Current user + logout */}
      {user && (
        <div className="flex items-center gap-2">
          <AvatarView avatar={user.Avatar} size={32} rounded="rounded-full" bg="bg-gray-100" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{user.Username}</span>
          <button onClick={logout} title="登出" className="btn-ghost p-1.5 hover:text-red-600"><LogOut size={15} /></button>
        </div>
      )}
    </header>
  )
}
