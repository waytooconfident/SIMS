import { useMemo, useState } from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown, GripVertical } from 'lucide-react'
import type { Product, ProductDetail, MappingWithCalc } from '@shared/types'
import { Thumbnail } from './Thumbnail'

type SortKey = 'name' | 'cost' | 'price' | 'stock' | 'avgPrice' | 'avgProfit' | 'margin' | 'earnings' | 'volume'

interface Stat {
  cost: number; price: number; stock: number
  avgPrice: number; avgProfit: number; margin: number; earnings: number; volume: number
}

interface Props {
  product: Product
  details: ProductDetail[]
  mappings: MappingWithCalc[]
  onReorderDetails: (orderedIds: string[]) => void
}

// The detail (變體) rows shown when a product with details is expanded.
// Click a column header to sort; drag the handle to reorder (manual order).
export function InventoryDetailRows({ product, details, mappings, onReorderDetails }: Props) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null) // null = manual order (draggable)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [dragId, setDragId] = useState<string | null>(null)

  const stats = useMemo(() => {
    const map = new Map<string, Stat>()
    for (const d of details) {
      const rows = mappings.filter((m) => m.DetailID === d.DetailID)
      const volume = rows.reduce((s, r) => s + r.SalesVolume, 0)
      const earnings = rows.reduce((s, r) => s + r.TotalEarnings, 0)
      const avgPrice = volume > 0
        ? rows.reduce((s, r) => s + r.SellingPrice * r.SalesVolume, 0) / volume
        : rows.length ? rows.reduce((s, r) => s + r.SellingPrice, 0) / rows.length : 0
      const avgProfit = volume > 0 ? earnings / volume : 0
      const margin = d.TotalCostNTD > 0 ? (avgProfit / d.TotalCostNTD) * 100 : 0
      map.set(d.DetailID, { cost: d.TotalCostNTD, price: d.SellingPrice, stock: d.StockQuantity, avgPrice, avgProfit, margin, earnings, volume })
    }
    return map
  }, [details, mappings])

  const ordered = useMemo(() => {
    if (!sortKey) return details
    const get = (d: ProductDetail): number | string => {
      if (sortKey === 'name') return d.DetailName
      return stats.get(d.DetailID)?.[sortKey] ?? 0
    }
    return [...details].sort((a, b) => {
      const av = get(a), bv = get(b)
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [details, stats, sortKey, sortDir])

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) {
      if (sortDir === 'asc') setSortDir('desc')
      else { setSortKey(null) } // third click → back to manual order
    } else { setSortKey(k); setSortDir('asc') }
  }

  const onDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) return
    const ids = details.map((d) => d.DetailID)
    const from = ids.indexOf(dragId), to = ids.indexOf(targetId)
    if (from < 0 || to < 0) return
    ids.splice(to, 0, ids.splice(from, 1)[0])
    onReorderDetails(ids)
    setDragId(null)
  }

  const Th = ({ k, label, right }: { k: SortKey; label: string; right?: boolean }) => (
    <th className={`py-1.5 px-2 cursor-pointer select-none hover:text-indigo-600 ${right ? 'text-right' : 'text-left'}`} onClick={() => toggleSort(k)}>
      <span className={`inline-flex items-center gap-1 ${right ? 'flex-row-reverse' : ''}`}>
        {label}
        {sortKey === k ? (sortDir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />) : <ArrowUpDown size={10} className="opacity-30" />}
      </span>
    </th>
  )

  return (
    <div className="p-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
        商品細項（{details.length}）
        <span className="font-normal normal-case text-gray-400">{sortKey ? '欄位排序中，再點該欄可切回手動排序' : '可拖曳左側握把調整順序'}</span>
      </p>
      <table className="w-full text-xs bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
        <thead>
          <tr className="text-gray-500 border-b border-indigo-200 dark:border-gray-700 bg-indigo-50/50 dark:bg-gray-900/40">
            <th className="w-5 py-1.5 px-1" />
            <th className="w-8 py-1.5 px-2" />
            <Th k="name" label="細項名稱" />
            <Th k="cost" label="成本(NT$)" right />
            <Th k="price" label="售價" right />
            <Th k="stock" label="庫存" right />
            <Th k="avgPrice" label="平均售價" right />
            <Th k="avgProfit" label="平均淨利潤" right />
            <Th k="margin" label="平均利潤率" right />
            <Th k="earnings" label="總收益" right />
            <Th k="volume" label="銷售量" right />
          </tr>
        </thead>
        <tbody>
          {ordered.map((d) => {
            const s = stats.get(d.DetailID)!
            return (
              <tr
                key={d.DetailID}
                className={`border-b border-gray-100 dark:border-gray-700 ${dragId === d.DetailID ? 'opacity-40' : ''}`}
                draggable={!sortKey}
                onDragStart={() => setDragId(d.DetailID)}
                onDragEnd={() => setDragId(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(d.DetailID)}
              >
                <td className="py-1.5 px-1 text-gray-300" title={sortKey ? '欄位排序中無法拖曳' : '拖曳排序'}>
                  {!sortKey && <GripVertical size={12} />}
                </td>
                <td className="py-1.5 px-2"><Thumbnail path={d.ImagePath ?? product.ImagePath} size={28} /></td>
                <td className="py-1.5 px-2 font-medium">{d.DetailName}</td>
                <td className="py-1.5 px-2 text-right">NT${s.cost.toFixed(0)}</td>
                <td className="py-1.5 px-2 text-right">NT${s.price}</td>
                <td className="py-1.5 px-2 text-right">{s.stock}</td>
                <td className="py-1.5 px-2 text-right">{s.volume ? `NT$${s.avgPrice.toFixed(0)}` : '-'}</td>
                <td className={`py-1.5 px-2 text-right ${s.avgProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{s.volume ? `NT$${s.avgProfit.toFixed(0)}` : '-'}</td>
                <td className={`py-1.5 px-2 text-right ${s.margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>{s.volume ? `${s.margin.toFixed(1)}%` : '-'}</td>
                <td className={`py-1.5 px-2 text-right font-semibold ${s.earnings >= 0 ? 'text-green-600' : 'text-red-600'}`}>{s.volume ? `NT$${s.earnings.toFixed(0)}` : '-'}</td>
                <td className="py-1.5 px-2 text-right">{s.volume}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
