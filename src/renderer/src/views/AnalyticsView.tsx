import { useEffect, useMemo, useState } from 'react'
import { ArrowUp, ArrowDown, ArrowUpDown, Plus } from 'lucide-react'
import { usePlatforms } from '../hooks/usePlatforms'
import { useProducts } from '../hooks/useProducts'
import { useCategories } from '../hooks/useCategories'
import { useMappings } from '../hooks/useMappings'
import { useDetails } from '../hooks/useDetails'
import { useFilterStore } from '../stores/useFilterStore'
import { FilterBar } from '../components/analytics/FilterBar'
import { ProductCategoryFilter } from '../components/analytics/ProductCategoryFilter'
import { StatsCards } from '../components/analytics/StatsCards'
import { SalesChart } from '../components/analytics/SalesChart'
import { ComparePanel } from '../components/analytics/ComparePanel'
import { Thumbnail } from '../components/inventory/Thumbnail'
import type { TimePreset, AnalyticsSummary } from '@shared/types'

type SortField = 'platform' | 'date' | 'sales' | 'price' | 'earnings' | 'margin'
const sortValue = (r: AnalyticsSummary, f: SortField): number | string => {
  switch (f) {
    case 'platform': return r.PlatformName
    case 'date': return r.date
    case 'sales': return r.TotalSalesVolume
    case 'price': return r.AvgSellingPrice
    case 'earnings': return r.TotalEarnings
    case 'margin': return r.NetProfitMargin
  }
}

export function AnalyticsView() {
  const { platforms, load: loadPlatforms } = usePlatforms()
  const { products, load: loadProducts } = useProducts()
  const { categories, load: loadCategories } = useCategories()
  const { analytics, chartData, loading, overallTotals, loadMappings } = useMappings()
  const { byProduct: detailsByProduct, load: loadDetails } = useDetails()
  const { timePreset, platformID, productID, detailID, categoryID, setTimePreset, setPlatformID, setProductID, setDetail, setCategoryID, buildFilter } = useFilterStore()

  const [chartMode, setChartMode] = useState<'revenue' | 'sales'>('revenue')
  const [sortField, setSortField] = useState<SortField>('earnings')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  // Dynamic comparison charts (multi-platform / multi-product). Starts with two.
  const [comparePanels, setComparePanels] = useState<number[]>([1, 2])
  const [nextPanelId, setNextPanelId] = useState(3)

  const filter = useMemo(() => buildFilter(), [timePreset, platformID, productID, detailID, categoryID, buildFilter])

  useEffect(() => { loadPlatforms(); loadProducts(); loadCategories(); loadDetails() }, [])
  useEffect(() => { loadMappings(filter) }, [filter, loadMappings])

  const sortedAnalytics = useMemo(() => {
    const arr = [...analytics]
    arr.sort((a, b) => {
      const av = sortValue(a, sortField)
      const bv = sortValue(b, sortField)
      const d = typeof av === 'string' ? String(av).localeCompare(String(bv)) : av - (bv as number)
      return sortDir === 'asc' ? d : -d
    })
    return arr
  }, [analytics, sortField, sortDir])

  // Click a header: same column toggles direction; a new column starts 大→小
  // (and 新→舊 for date), i.e. descending.
  const onSort = (field: SortField) => {
    if (field === sortField) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortField(field); setSortDir('desc') }
  }
  const SortHeader = ({ field, label }: { field: SortField; label: string }) => {
    const active = sortField === field
    const Icon = !active ? ArrowUpDown : sortDir === 'desc' ? ArrowDown : ArrowUp
    return (
      <th className="table-th">
        <button onClick={() => onSort(field)} className={`inline-flex items-center gap-1 hover:text-indigo-600 ${active ? 'text-indigo-600' : ''}`}>
          {label}<Icon size={12} />
        </button>
      </th>
    )
  }

  return (
    <div className="space-y-5">
      <div className="card p-4 space-y-3">
        <FilterBar
          timePreset={timePreset}
          platformID={platformID}
          platforms={platforms}
          onTimeChange={(p: TimePreset) => setTimePreset(p)}
          onPlatformChange={setPlatformID}
        />
        <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 pt-3">
          <span className="text-xs text-gray-500">商品：</span>
          <ProductCategoryFilter
            categories={categories}
            products={products}
            detailID={detailID}
            detailsByProduct={detailsByProduct}
            onSelectDetail={setDetail}
            productID={productID}
            categoryID={categoryID}
            onSelectAll={() => { setProductID(null); setCategoryID(null) }}
            onSelectCategory={setCategoryID}
            onSelectProduct={setProductID}
          />
          <span className="text-xs text-gray-400 ml-2">（彙總表點欄位標題即可排序）</span>
        </div>
      </div>

      {loading ? (
        <div className="card p-12 text-center text-gray-400">載入中…</div>
      ) : (
        <>
          <StatsCards {...overallTotals} />

          <div className="flex gap-2">
            {(['revenue', 'sales'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setChartMode(m)}
                className={`btn text-xs ${chartMode === m ? 'btn-primary' : 'btn-secondary'}`}
              >
                {m === 'revenue' ? '總收益趨勢' : '銷售量趨勢'}
              </button>
            ))}
          </div>

          {/* Chart always renders — even with no data it shows the time / NTD axes. */}
          <SalesChart
            data={chartData}
            platforms={platforms}
            mode={chartMode}
            rangeStart={filter.startDate}
            rangeEnd={filter.endDate}
          />

          {/* Analytics summary table */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-200 bg-gray-50">
              <p className="text-sm font-semibold text-gray-700">商品 × 平台 彙總</p>
            </div>
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="table-th">首圖</th>
                  <th className="table-th">商品編號</th>
                  <SortHeader field="platform" label="平台" />
                  <SortHeader field="date" label="日期" />
                  <SortHeader field="sales" label="銷售量" />
                  <SortHeader field="price" label="平均售價" />
                  <SortHeader field="earnings" label="總收益" />
                  <SortHeader field="margin" label="淨利率(對成本)" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedAnalytics.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400">
                      此時段／平台／商品內尚無資料
                    </td>
                  </tr>
                ) : (
                  sortedAnalytics.map((row, i) => (
                    <tr key={`${row.ProductID}-${row.PlatformID}-${row.date}-${i}`} className="table-tr">
                      <td className="table-td"><Thumbnail path={row.ImagePath} size={32} /></td>
                      <td className="table-td font-mono text-indigo-700 text-xs">{row.ProductID}</td>
                      <td className="table-td">{row.PlatformName}</td>
                      <td className="table-td text-gray-500">{row.date}</td>
                      <td className="table-td">{row.TotalSalesVolume}</td>
                      <td className="table-td">NT${row.AvgSellingPrice.toFixed(0)}</td>
                      <td className={`table-td font-semibold ${row.TotalEarnings >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        NT${row.TotalEarnings.toFixed(0)}
                      </td>
                      <td className={`table-td ${row.NetProfitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {row.NetProfitMargin.toFixed(1)}%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Multi-platform / multi-product comparison charts */}
          <div className="flex items-center justify-between pt-2">
            <h3 className="text-sm font-semibold text-gray-700">多平台 / 多商品對比</h3>
            <button
              onClick={() => { setComparePanels((ps) => [...ps, nextPanelId]); setNextPanelId((n) => n + 1) }}
              className="btn-primary text-xs"
            >
              <Plus size={13} /> 新增對比圖
            </button>
          </div>
          <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
            {comparePanels.map((id, idx) => (
              <ComparePanel
                key={id}
                label={String.fromCharCode(65 + idx)}
                platforms={platforms}
                products={products}
                categories={categories}
                onRemove={() => setComparePanels((ps) => ps.filter((x) => x !== id))}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
