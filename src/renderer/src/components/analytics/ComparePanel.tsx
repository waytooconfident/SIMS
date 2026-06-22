import { useEffect, useState } from 'react'
import { ExternalLink, X } from 'lucide-react'
import { useMappings } from '../../hooks/useMappings'
import { SalesChart } from './SalesChart'
import { StatsCards } from './StatsCards'
import { ProductCategoryFilter } from './ProductCategoryFilter'
import type { Platform, Product, Category, TimePreset } from '@shared/types'

const TIME_OPTIONS: { value: TimePreset; label: string }[] = [
  { value: 'today', label: '本日' }, { value: '7d', label: '一週' }, { value: '30d', label: '一個月' },
  { value: '90d', label: '三個月' }, { value: '180d', label: '半年' }, { value: '365d', label: '一年' }, { value: 'all', label: '全部' }
]

export function dateRange(preset: TimePreset) {
  const now = new Date()
  const end = now.toISOString()
  const ago = (d: number) => { const dt = new Date(now); dt.setDate(dt.getDate() - d); return dt.toISOString() }
  const startDate =
    preset === 'today' ? new Date(now.toDateString()).toISOString() :
    preset === '7d' ? ago(7) : preset === '30d' ? ago(30) : preset === '90d' ? ago(90) :
    preset === '180d' ? ago(180) : preset === '365d' ? ago(365) : '1970-01-01T00:00:00.000Z'
  return { startDate, endDate: end }
}

interface ComparePanelProps {
  label: string
  platforms: Platform[]
  products: Product[]
  categories: Category[]
  exchangeRate: number
  onRemove?: () => void
  embedded?: boolean   // inside a pop-out window: hide remove/pop-out
  initial?: { platformID: string | null; productID: string | null; categoryID: string | null; time: TimePreset }
}

export function ComparePanel({ label, platforms, products, categories, exchangeRate, onRemove, embedded, initial }: ComparePanelProps) {
  const { chartData, loading, overallTotals, loadMappings } = useMappings()
  const [platformID, setPlatformID] = useState<string | null>(initial?.platformID ?? null)
  const [productID, setProductID] = useState<string | null>(initial?.productID ?? null)
  const [categoryID, setCategoryID] = useState<string | null>(initial?.categoryID ?? null)
  const [time, setTime] = useState<TimePreset>(initial?.time ?? '30d')
  const [mode, setMode] = useState<'revenue' | 'sales'>('revenue')

  const range = dateRange(time)
  useEffect(() => {
    loadMappings({ platformID, productID, categoryID, startDate: range.startDate, endDate: range.endDate, exchangeRate })
  }, [platformID, productID, categoryID, time, exchangeRate, loadMappings])

  const popOut = () =>
    window.api.window.openCompare({ platformID, productID, categoryID, time, label, mode })

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0">{label}</span>
        <select value={platformID ?? ''} onChange={(e) => setPlatformID(e.target.value || null)} className="input !w-auto !py-1 text-xs">
          <option value="">全平台加總</option>
          {platforms.map((p) => <option key={p.PlatformID} value={p.PlatformID}>{p.PlatformName}</option>)}
        </select>
        <ProductCategoryFilter
          categories={categories} products={products} productID={productID} categoryID={categoryID}
          onSelectAll={() => { setProductID(null); setCategoryID(null) }}
          onSelectCategory={(id) => { setCategoryID(id); setProductID(null) }}
          onSelectProduct={(id) => { setProductID(id); setCategoryID(null) }}
        />
        <div className="flex gap-0.5 bg-gray-100 p-0.5 rounded-lg">
          {TIME_OPTIONS.map(({ value, label: lbl }) => (
            <button key={value} onClick={() => setTime(value)}
              className={`px-1.5 py-1 rounded text-xs font-medium ${time === value ? 'bg-white shadow text-indigo-700' : 'text-gray-500'}`}>{lbl}</button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => setMode((m) => (m === 'revenue' ? 'sales' : 'revenue'))} className="btn-secondary text-xs">
            {mode === 'revenue' ? '看銷售量' : '看總收益'}
          </button>
          {!embedded && <button onClick={popOut} title="拉出獨立視窗（雙螢幕）" className="btn-ghost p-1.5"><ExternalLink size={14} /></button>}
          {!embedded && onRemove && <button onClick={onRemove} title="移除此圖" className="btn-ghost p-1.5 hover:text-red-600"><X size={14} /></button>}
        </div>
      </div>

      {loading ? (
        <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">載入中…</div>
      ) : (
        <>
          <StatsCards {...overallTotals} />
          <SalesChart data={chartData} platforms={platforms} mode={mode} rangeStart={range.startDate} rangeEnd={range.endDate} />
        </>
      )}
    </div>
  )
}
