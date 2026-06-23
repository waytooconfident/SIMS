import { Package, BarChart2, Settings, Receipt } from 'lucide-react'
import type { ActiveView } from '../../App'

const NAV_ITEMS: { id: ActiveView; label: string; icon: React.ReactNode }[] = [
  { id: 'inventory',  label: '庫存管理',   icon: <Package size={18} /> },
  { id: 'sales',      label: '銷售紀錄',   icon: <Receipt size={18} /> },
  { id: 'analytics',  label: '數據分析',   icon: <BarChart2 size={18} /> },
  { id: 'settings',   label: '系統設定',   icon: <Settings size={18} /> }
]

interface SidebarProps {
  activeView: ActiveView
  onNavigate: (v: ActiveView) => void
}

export function Sidebar({ activeView, onNavigate }: SidebarProps) {
  return (
    <aside className="w-52 shrink-0 flex flex-col bg-white text-gray-600 border-r border-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:border-transparent">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-200 dark:border-gray-700">
        <p className="text-xs font-semibold text-indigo-600 tracking-widest uppercase dark:text-indigo-400">SIMS</p>
        <p className="text-base font-bold text-gray-900 mt-0.5 dark:text-white">庫存系統</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map(({ id, label, icon }) => {
          const active = id === activeView
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                ${active
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white'
                }`}
            >
              {icon}
              {label}
            </button>
          )
        })}
      </nav>

      <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-400 dark:text-gray-600">v0.1.0</p>
      </div>
    </aside>
  )
}
