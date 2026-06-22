import { useEffect, useMemo, useState } from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown, X } from 'lucide-react'
import type { MappingWithCalc } from '@shared/types'
import { useMappings } from '../hooks/useMappings'
import { usePlatforms } from '../hooks/usePlatforms'
import { useCategories } from '../hooks/useCategories'
import { useExchangeRateStore } from '../stores/useExchangeRateStore'
import { useSalesFilterStore } from '../stores/useSalesFilterStore'
import { Thumbnail } from '../components/inventory/Thumbnail'

type SortKey = 'date' | 'product' | 'detail' | 'platform' | 'price' | 'volume' | 'profit' | 'margin' | 'earnings'

const TIME_PRESETS: { value: Parameters<ReturnType<typeof useSalesFilterStore.getState>['setTimePreset']>[0]; label: string }[] = [
  { value: 'all', label: '全部' }, { value: '7d', label: '近7天' }, { value: '30d', label: '近30天' },
  { value: '90d', label: '近90天' }, { value: '365d', label: '近一年' }
]

const val = (m: MappingWithCalc, k: SortKey): number | string => {
  switch (k) {
    case 'date': return m.DateRecorded
    case 'product': return m.ProductID
    case 'detail': return m.DetailName ?? ''
    case 'platform': return m.PlatformName
    case 'price': return m.SellingPrice
    case 'volume': return m.SalesVolume
    case 'profit': return m.NetProfit
    case 'margin': return m.NetProfitMargin
    case 'earnings': return m.TotalEarnings
  }
}

export function SalesRecordsView() {
  const { mappings, loadMappings } = useMappings()
  const { platforms, load: loadPlatforms } = usePlatforms()
  const { categories, load: loadCategories, nameOf } = useCategories()
  const rate = useExchangeRateStore((s) => s.rate)
  const f = useSalesFilterStore()
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  useEffect(() => { loadPlatforms(); loadCategories() }, [loadPlatforms, loadCategories])
  useEffect(() => {
    loadMappings(f.buildFilter(rate))
  }, [rate, f.timePreset, f.platformID, f.productID, f.categoryID, loadMappings])

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(k); setSortDir(k === 'date' ? 'desc' : 'asc') }
  }

  const sorted = useMemo(() => {
    const rows = [...mappings]
    rows.sort((a, b) => {
      const av = val(a, sortKey), bv = val(b, sortKey)
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })
    return rows
  }, [mappings, sortKey, sortDir])

  const SortTh = ({ k, label, right }: { k: SortKey; label: string; right?: boolean }) => (
    <th className={`table-th cursor-pointer select-none hover:text-indigo-600 ${right ? 'text-right' : ''}`} onClick={() => toggleSort(k)}>
      <span className={`inline-flex items-center gap-1 ${right ? 'flex-row-reverse' : ''}`}>
        {label}
        {sortKey === k ? (sortDir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : <ArrowUpDown size={11} className="opacity-40" />}
      </span>
    </th>
  )

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <select className="input !w-auto text-sm" value={f.platformID ?? ''} onChange={(e) => f.setPlatformID(e.target.value || null)}>
          <option value="">全部平台</option>
          {platforms.map((p) => <option key={p.PlatformID} value={p.PlatformID}>{p.PlatformName}</option>)}
        </select>
        <select className="input !w-auto text-sm" value={f.categoryID ?? ''} onChange={(e) => f.setCategoryID(e.target.value || null)}>
          <option value="">全部分類</option>
          {categories.map((c) => <option key={c.CategoryID} value={c.CategoryID}>{c.CategoryName}</option>)}
        </select>
        <div className="flex gap-0.5 bg-gray-100 dark:bg-gray-800 p-0.5 rounded-lg">
          {TIME_PRESETS.map((t) => (
            <button key={t.value} onClick={() => f.setTimePreset(t.value)}
              className={`px-3 py-1 rounded-md text-xs font-medium ${f.timePreset === t.value ? 'bg-white dark:bg-gray-700 shadow text-indigo-700 dark:text-indigo-300' : 'text-gray-500'}`}>{t.label}</button>
          ))}
        </div>
        {f.productID && (
          <button onClick={() => f.setProductID(null)} className="badge badge-blue gap-1">
            商品 {f.productID} <X size={11} />
          </button>
        )}
        <span className="ml-auto text-xs text-gray-400">{sorted.length} 筆紀錄</span>
      </div>

      {sorted.length === 0 ? (
        <div className="card p-12 text-center text-gray-400 text-sm">此條件下尚無銷售紀錄。</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="bg-gray-50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <SortTh k="date" label="日期" />
                <th className="table-th">首圖</th>
                <SortTh k="product" label="商品編號" />
                <SortTh k="detail" label="細項" />
                <SortTh k="platform" label="平台" />
                <SortTh k="price" label="售價" right />
                <SortTh k="volume" label="銷售量" right />
                <SortTh k="profit" label="淨利潤/件" right />
                <SortTh k="margin" label="利潤率" right />
                <SortTh k="earnings" label="總收益" right />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {sorted.map((m) => (
                <tr key={m.MappingID} className="table-tr">
                  <td className="table-td">{m.DateRecorded.slice(0, 10)}</td>
                  <td className="table-td"><Thumbnail path={m.ImagePath} size={32} /></td>
                  <td className="table-td font-mono text-indigo-700 dark:text-indigo-300">{m.ProductID}<span className="ml-1 text-[10px] text-gray-400">{nameOf(m.CategoryID)}</span></td>
                  <td className="table-td">{m.DetailName ?? <span className="text-gray-300">—</span>}</td>
                  <td className="table-td"><span className="badge badge-gray">{m.PlatformName}</span></td>
                  <td className="table-td text-right">NT${m.SellingPrice}</td>
                  <td className="table-td text-right">{m.SalesVolume}</td>
                  <td className={`table-td text-right ${m.NetProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>NT${m.NetProfit.toFixed(0)}</td>
                  <td className={`table-td text-right ${m.NetProfitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>{m.NetProfitMargin.toFixed(1)}%</td>
                  <td className={`table-td text-right font-semibold ${m.TotalEarnings >= 0 ? 'text-green-600' : 'text-red-600'}`}>NT${m.TotalEarnings.toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
