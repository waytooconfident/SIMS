import { Fragment, useState } from 'react'
import { Pencil, Trash2, FolderOpen, ChevronDown, ChevronRight, ShoppingCart, GripVertical, BarChart2, Receipt, Boxes } from 'lucide-react'
import type { Product, MappingWithCalc, ProductDetail } from '@shared/types'
import { Thumbnail } from './Thumbnail'
import { InventoryDetailRows } from './InventoryDetailRows'

export type InventorySize = 'sm' | 'md' | 'lg'
const THUMB: Record<InventorySize, number> = { sm: 56, md: 96, lg: 160 }
const PAD: Record<InventorySize, string> = { sm: 'py-2', md: 'py-3', lg: 'py-5' }

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
  const [dragId, setDragId] = useState<string | null>(null)

  const toggle = (key: string) => {
    setOpenProducts((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }
  const openFolder = async (path: string | null) => { if (path) await window.api.shell.openFolder(path) }
  const pad = PAD[size]

  if (products.length === 0) {
    return <div className="card p-12 text-center text-gray-400 text-sm">尚無商品。點擊「新增商品」開始建立庫存。</div>
  }

  const COLS = 13

  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[1000px]">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="table-th w-6" />
            <th className="table-th w-6" />
            <th className="table-th">首圖</th>
            <th className="table-th">編號</th>
            <th className="table-th">分類</th>
            <th className="table-th">成本(NT$)</th>
            <th className="table-th">競品價</th>
            <th className="table-th">庫存</th>
            <th className="table-th">平均售價</th>
            <th className="table-th">平均淨利潤</th>
            <th className="table-th">平均利潤率</th>
            <th className="table-th">總收益</th>
            <th className="table-th">資料夾</th>
            <th className="table-th text-right">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {products.map((p) => {
            const isOpen = openProducts.has(p.ProductID)
            const rows = mappings.filter((m) => m.ProductID === p.ProductID)
            const details = detailsByProduct(p.ProductID)
            const hasDetails = details.length > 0
            // Aggregate display when the product has details.
            const stockDisplay = hasDetails ? details.reduce((s, d) => s + d.StockQuantity, 0) : p.StockQuantity
            const detailCosts = details.map((d) => d.TotalCostNTD)
            const costDisplay = hasDetails
              ? (details.length === 0 || Math.min(...detailCosts) === Math.max(...detailCosts)
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

            return (
              <Fragment key={p.ProductID}>
                <tr
                  className={`table-tr ${hasDetails ? 'cursor-pointer' : ''} ${dragId === p.ProductID ? 'opacity-40' : ''}`}
                  draggable
                  onDragStart={() => setDragId(p.ProductID)}
                  onDragEnd={() => setDragId(null)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => { if (dragId) onReorder(dragId, p.ProductID); setDragId(null) }}
                  onClick={() => { if (hasDetails) toggle(p.ProductID) }}
                >
                  <td className={`px-1 ${pad} text-gray-300`} title="拖曳排序"><GripVertical size={14} /></td>
                  <td className={`px-1 ${pad} text-gray-400`}>{hasDetails ? (isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : null}</td>
                  <td className={`px-4 ${pad}`}><Thumbnail path={p.ImagePath} size={THUMB[size]} /></td>
                  <td className={`px-4 ${pad} font-mono font-medium text-indigo-700`}>
                    <span className="inline-flex items-center gap-1">{p.ProductID}{hasDetails && <span title={`${details.length} 個細項`} className="badge badge-blue gap-0.5 !px-1.5"><Boxes size={10} />{details.length}</span>}</span>
                  </td>
                  <td className={`px-4 ${pad}`}><span className="badge badge-gray">{categoryName(p.CategoryID)}</span></td>
                  <td className={`px-4 ${pad} text-sm`}>{costDisplay}</td>
                  <td className={`px-4 ${pad} text-sm`}>{competitorDisplay(p.ProductID)}</td>
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
  )
}
