import { ExchangeRatePanel } from '../components/settings/ExchangeRatePanel'
import { CurrencyManagePanel } from '../components/settings/CurrencyManagePanel'
import { PlatformManagePanel } from '../components/settings/PlatformManagePanel'
import { CategoryManagePanel } from '../components/settings/CategoryManagePanel'
import { AccountPanel } from '../components/settings/AccountPanel'

export function SettingsView() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-3">帳號設定</h2>
        <AccountPanel />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-3">全域參數</h2>
        <ExchangeRatePanel />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-3">幣別與匯率</h2>
        <CurrencyManagePanel />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-3">商品分類</h2>
        <CategoryManagePanel />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-3">銷售平台</h2>
        <PlatformManagePanel />
      </div>

      <div className="card p-5 text-xs text-gray-400 space-y-1">
        <p className="font-semibold text-gray-500 dark:text-gray-400">關於 SIMS</p>
        <p>SIMS — Simple Inventory Management System</p>
        <p>版本 0.1.0 · Electron + React + SQLite</p>
        <p>資料庫儲存位置：%APPDATA%/SIMS/data（Windows）</p>
        <p>未來擴充：蝦皮 API、酷澎 API 自動抓取與上架</p>
      </div>
    </div>
  )
}
