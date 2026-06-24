import { Fragment, useRef, useState } from 'react'
import { Pencil, Trash2, FolderOpen, ChevronDown, ChevronRight, ShoppingCart, GripVertical, BarChart2, Receipt, Boxes, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import type { Product, MappingWithCalc, ProductDetail } from '@shared/types'
import { Thumbnail } from './Thumbnail'
import { InventoryDetailRows } from './InventoryDetailRows'

export type InventorySize = 'sm' | 'md' | 'lg'
const THUMB: Record<InventorySize, number> = { sm: 56, md: 96, lg: 160 }
const PAD: Record<InventorySize, string> = { sm: 'py-2', md: 'py-3', lg: 'py-5' }

type SortKey = 'cost' | 'competitor' | 'stock' | 'avgPrice' | 'avgProfit' | 'avgMargin' | 'earnings'

interface InventoryTableProps {
  products: Product[]
  mappings: MappingWithCalc[]
  categoryName: (id: string) => string
  detailsByProduct: (productID: string) => ProductDetail[]
  competitorDisplay: (productID: string) => string
  size: InventorySize
  onReorder: (draggedId: string, targetId: string) => void
  onReorderDetails: (orderedIds: string[]) => void
  onEditProduct: (p: Product) => void
  onDeleteProduct: (productID: string) => void
  onSellProduct: (p: Product) => void
  onAnalyze: (productID: string) => void
  onViewSales: (productID: string) => void
}

export function InventoryTable({
  products, mappings, categoryName, detailsByProduct, competitorDisplay, size, onReorder, onReorderDetails,
  onEditProduct, onDeleteProduct, onSellProduct, onAnalyze, onViewSales
}: InventoryTableProps) {
  const [openProducts, setOpenProducts] = useState<Set<string>>(new Set())
  const [dragId, setDragId] = useState<string | null>(null)      // product currently being dragged
  const [overId, setOverId] = useState<string | null>(null)       // in-table reorder target row
  const [ghost, setGhost] = useState<{ x: number; y: number; id: string } | null>(null)
  const [sortKey, setSortKey] = useState<SortKey | null>(null)    // null = manual order (draggable)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // Custom pointer drag from the grip handle. Pointer capture keeps move/up events
  // coming even when the cursor leaves this window, so we can both reorder rows
  // here AND hand a product to the independent order window (the main process
  // hit-tests the cursor's *screen* coords against that window).
  const drag = useRef<{ id: string; pointerId: number; el: HTMLElement; startX: number; startY: number; active: boolean } | null>(null)

  const startRowDrag = (e: React.PointerEvent, productID: string) => {
    if (e.button !== 0) return
    e.preventDefault()
    const el = e.currentTarget as HTMLElement
    el.setPointerCapture(e.pointerId)
    drag.current = { id: productID, pointerId: e.pointerId, el, startX: e.clientX, startY: e.clientY, active: false }
  }
  const onRowDragMove = (e: React.PointerEvent) => {
    const s = drag.current
    if (!s) return
    if (!s.active) {
      if (Math.hypot(e.clientX - s.startX, e.clientY - s.startY) < 5) return
      s.active = true
      setDragId(s.id)
      window.api.window.dragBegin(s.id)
    }
    setGhost({ x: e.clientX, y: e.clientY, id: s.id })
    window.api.window.dragMove(e.screenX, e.screenY)
    // Highlight the row under the cursor as a reorder target (in-window only).
    const under = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
    const row = under?.closest('[data-pid]') as HTMLElement | null
    const pid = row?.dataset.pid
    setOverId(pid && pid !== s.id ? pid : null)
  }
  const endRowDrag = (e: React.PointerEvent) => {
    const s = drag.current
    drag.current = null
    const target = overId
    setGhost(null); setOverId(null); setDragId(null)
    if (!s) return
    try { s.el.releasePointerCapture(s.pointerId) } catch { /* already released */ }
    if (!s.active) return // a click on the grip, not a drag
    // Let the main process decide whether this dropped over the order window.
    window.api.window.dragEnd(e.screenX, e.screenY)
    // In-window reorder (cursor still over another row, manual order only).
    if (!sortKey && target && target !== s.id) onReorder(s.id, target)
  }

  const toggle = (key: string) => {
    setOpenProducts((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }
  const openFolder = async (path: string | null) => { if (path) await window.api.shell.openFolder(path) }
  const pad = PAD[size]

  // Per-product metrics (computed from the product, its details, and its sales).
  // Aggregated values when the product has details; product-level otherwise.
  const decorate = (p: Product) => {
    const rows = mappings.filter((m) => m.ProductID === p.ProductID)
    const details = detailsByProduct(p.ProductID)
    const hasDetails = details.length > 0
    const detailCosts = details.map((d) => d.TotalCostNTD)
    const stockDisplay = hasDetails ? details.reduce((s, d) => s + d.StockQuantity, 0) : p.StockQuantity
    const costRepresentative = hasDetails
      ? (detailCosts.length ? detailCosts.reduce((a, b) => a + b, 0) / detailCosts.length : 0)
      : p.TotalCostNTD
    const costDisplay = hasDetails
      ? (detailCosts.length === 0 || Math.min(...detailCosts) === Math.max(...detailCosts)
          ? `NT$${(detailCosts[0] ?? 0).toFixed(0)}`
          : `NT$${Math.min(...detailCosts).toFixed(0)}–${Math.max(...detailCosts).toFixed(0)}`)
      : `NT$${p.TotalCostNTD.toFixed(0)}`
    const totalVol = rows.reduce((s, r) => s + r.SalesVolume, 0)
    const totalEarnings = rows.reduce((s, r) => s + r.TotalEarnings, 0)
    const totalCost = rows.reduce((s, r) => s + r.Cost_NTD * r.SalesVolume, 0)
    const avgPrice = totalVol > 0
      ? rows.reduce((s, r) => s + r.SellingPrice * r.SalesVolume, 0) / totalVol
      : rows.length ? rows.reduce((s, r) => s + r.SellingPrice, 0) / rows.length : 0
    const avgProfit = totalVol > 0 ? totalEarnings / totalVol : 0
    const avgMargin = totalCost > 0 ? (totalEarnings / totalCost) * 100 : 0
    const competitorStr = competitorDisplay(p.ProductID)
    const cm = competitorStr.match(/[\d.]+/)
    const competitorNum = cm ? parseFloat(cm[0]) : NaN
    return { p, rows, details, hasDetails, stockDisplay, costDisplay, costRepresentative, totalEarnings, avgPrice, avgProfit, avgMargin, competitorStr, competitorNum }
  }

  let decorated = products.map(decorate)
  if (sortKey) {
    const val = (d: ReturnType<typeof decorate>): number => {
      switch (sortKey) {
        case 'cost': return d.costRepresentative
        case 'competitor': return isNaN(d.competitorNum) ? -Infinity : d.competitorNum
        case 'stock': return d.stockDisplay
        case 'avgPrice': return d.avgPrice
        case 'avgProfit': return d.avgProfit
        case 'avgMargin': return d.avgMargin
        case 'earnings': return d.totalEarnings
      }
    }
    decorated = [...decorated].sort((a, b) => (val(a) - val(b)) * (sortDir === 'asc' ? 1 : -1))
  }

  const onSort = (k: SortKey) => {
    if (sortKey === k) {
      if (sortDir === 'desc') setSortDir('asc')
      else setSortKey(null)            // third click → back to manual (drag) order
    } else { setSortKey(k); setSortDir('desc') }
  }
  const SortableTh = ({ k, label }: { k: SortKey; label: string }) => {
    const active = sortKey === k
    const Icon = !active ? ArrowUpDown : sortDir === 'desc' ? ArrowDown : ArrowUp
    return (
      <th className="table-th">
        <button onClick={() => onSort(k)} className={`inline-flex items-center gap-1 hover:text-indigo-600 ${active ? 'text-indigo-600' : ''}`}>
          {label}<Icon size={11} className={active ? '' : 'opacity-40'} />
        </button>
      </th>
    )
  }

  if (products.length === 0) {
    return <div className="card p-12 text-center text-gray-400 text-sm">尚無商品。點擊「新增商品」開始建立庫存。</div>
  }

  const COLS = 13

  return (
    <>
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[1000px]">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="table-th w-6" />
            <th className="table-th w-6" />
            <th className="table-th">首圖</th>
            <th className="table-th">編號</th>
            <th className="table-th">分類</th>
            <SortableTh k="cost" label="成本(NT$)" />
            <SortableTh k="competitor" label="競品價" />
            <SortableTh k="stock" label="庫存" />
            <SortableTh k="avgPrice" label="平均售價" />
            <SortableTh k="avgProfit" label="平均淨利潤" />
            <SortableTh k="avgMargin" label="平均利潤率" />
            <SortableTh k="earnings" label="總收益" />
            <th className="table-th">資料夾</th>
            <th className="table-th text-right">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {decorated.map(({ p, rows, details, hasDetails, stockDisplay, costDisplay, totalEarnings, avgPrice, avgProfit, avgMargin, competitorStr }) => {
            const isOpen = openProducts.has(p.ProductID)
            return (
              <Fragment key={p.ProductID}>
                <tr
                  data-pid={p.ProductID}
                  className={`table-tr ${hasDetails ? 'cursor-pointer' : ''} ${dragId === p.ProductID ? 'opacity-40' : ''} ${overId === p.ProductID ? 'ring-2 ring-inset ring-indigo-400' : ''}`}
                  onClick={() => { if (hasDetails) toggle(p.ProductID) }}
                >
                  <td className={`px-1 ${pad} text-gray-300 cursor-grab active:cursor-grabbing touch-none`}
                    title={sortKey ? '排序中，欲拖曳排序請先取消欄位排序' : '拖曳排序，或拖到「新增銷售紀錄」視窗'}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => startRowDrag(e, p.ProductID)}
                    onPointerMove={onRowDragMove}
                    onPointerUp={endRowDrag}
                  ><GripVertical size={14} /></td>
                  <td className={`px-1 ${pad} text-gray-400`}>{hasDetails ? (isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : null}</td>
                  <td className={`px-4 ${pad}`}><Thumbnail path={p.ImagePath} size={THUMB[size]} /></td>
                  <td className={`px-4 ${pad} font-mono font-medium text-indigo-700`}>
                    <span className="inline-flex items-center gap-1">{p.ProductID}{hasDetails && <span title={`${details.length} 個細項`} className="badge badge-blue gap-0.5 !px-1.5"><Boxes size={10} />{details.length}</span>}</span>
                  </td>
                  <td className={`px-4 ${pad}`}><span className="badge badge-gray">{categoryName(p.CategoryID)}</span></td>
                  <td className={`px-4 ${pad} text-sm`}>{costDisplay}</td>
                  <td className={`px-4 ${pad} text-sm`}>{competitorStr}</td>
                  <td className={`px-4 ${pad}`}><span className={`badge ${stockDisplay > 0 ? 'badge-green' : 'badge-red'}`}>{stockDisplay}</span></td>
                  <td className={`px-4 ${pad} text-sm`}>{rows.length ? `NT$${avgPrice.toFixed(0)}` : '-'}</td>
                  <td className={`px-4 ${pad} text-sm font-medium ${avgProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{rows.length ? `NT$${avgProfit.toFixed(0)}` : '-'}</td>
                  <td className={`px-4 ${pad} text-sm ${avgMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>{rows.length ? `${avgMargin.toFixed(1)}%` : '-'}</td>
                  <td className={`px-4 ${pad} text-sm font-semibold ${totalEarnings >= 0 ? 'text-green-600' : 'text-red-600'}`}>{rows.length ? `NT$${totalEarnings.toFixed(0)}` : '-'}</td>
                  <td className={`px-4 ${pad}`}>
                    {p.LocalFolderPath ? (
                      <button onClick={(e) => { e.stopPropagation(); openFolder(p.LocalFolderPath) }}
                              className="flex items-center gap-1 text-indigo-600 hover:underline text-xs" title={p.LocalFolderPath}>
                        <FolderOpen size={13} /> 開啟
                      </button>
                    ) : <span className="text-gray-400">-</span>}
                  </td>
                  <td className={`px-4 ${pad}`}>
                    <div className="flex gap-1.5 justify-end" onClick={(e) => e.stopPropagation()}>
                      <button className="btn-ghost p-1.5 text-indigo-600 hover:bg-indigo-50" title="查看銷售紀錄" onClick={() => onViewSales(p.ProductID)}><Receipt size={14} /></button>
                      <button className="btn-ghost p-1.5 text-blue-600 hover:bg-blue-50" title="分析此商品" onClick={() => onAnalyze(p.ProductID)}><BarChart2 size={14} /></button>
                      <button className="btn-ghost p-1.5 text-green-600 hover:bg-green-50" title="賣出" onClick={() => onSellProduct(p)}><ShoppingCart size={14} /></button>
                      <button className="btn-ghost p-1.5" title="編輯商品" onClick={() => onEditProduct(p)}><Pencil size={14} /></button>
                      <button className="btn-ghost p-1.5 hover:text-red-600" title="刪除" onClick={() => onDeleteProduct(p.ProductID)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>

                {/* Expansion shows the product's details only (no platform listings). */}
                {isOpen && hasDetails && (
                  <tr>
                    <td colSpan={COLS} className="p-0 bg-indigo-50/40 dark:bg-gray-900/30">
                      <InventoryDetailRows product={p} details={details} mappings={rows} onReorderDetails={onReorderDetails} />
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>

    {/* Drag ghost following the cursor while a product is being dragged. */}
    {ghost && (
      <div className="fixed z-[100] pointer-events-none -translate-x-1/2 -translate-y-1/2 px-2 py-1 rounded-md bg-indigo-600 text-white text-xs font-mono shadow-lg flex items-center gap-1"
        style={{ left: ghost.x, top: ghost.y }}>
        <ShoppingCart size={12} /> {ghost.id}
      </div>
    )}
    </>
  )
}
