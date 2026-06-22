import { useState, Fragment } from 'react'
import { Pencil, Trash2, FolderOpen, ChevronDown, ChevronRight, ShoppingCart, Tag, GripVertical, BarChart2 } from 'lucide-react'
import type { Product, MappingWithCalc } from '@shared/types'
import { useExchangeRateStore } from '../../stores/useExchangeRateStore'
import { Thumbnail } from './Thumbnail'

export type InventorySize = 'sm' | 'md' | 'lg'
const THUMB: Record<InventorySize, number> = { sm: 40, md: 64, lg: 96 }
const PAD: Record<InventorySize, string> = { sm: 'py-2', md: 'py-3', lg: 'py-5' }

export interface ListingView {
  productID: string
  platformID: string
  platformName: string
  title: string
  description: string
  currentPrice: number
  totalVolume: number
  profitPerUnit: number
  margin: number
  totalEarnings: number
  records: MappingWithCalc[]
}

interface InventoryTableProps {
  products: Product[]
  mappings: MappingWithCalc[]
  categoryName: (id: string) => string
  size: InventorySize
  onReorder: (draggedId: string, targetId: string) => void
  onEditProduct: (p: Product) => void
  onDeleteProduct: (productID: string) => void
  onSellProduct: (p: Product) => void
  onAnalyze: (productID: string) => void
  onEditListing: (l: ListingView) => void
  onEditRecord: (m: MappingWithCalc) => void
  onDeleteRecord: (mappingID: string) => void
}

function buildListings(rows: MappingWithCalc[]): ListingView[] {
  const byPlatform = new Map<string, MappingWithCalc[]>()
  for (const r of rows) {
    const arr = byPlatform.get(r.PlatformID) ?? []
    arr.push(r)
    byPlatform.set(r.PlatformID, arr)
  }
  const listings: ListingView[] = []
  for (const [platformID, recs] of byPlatform) {
    const sorted = [...recs].sort((a, b) => b.DateRecorded.localeCompare(a.DateRecorded))
    const latest = sorted[0]
    listings.push({
      productID: latest.ProductID,
      platformID,
      platformName: latest.PlatformName,
      title: sorted.find((r) => r.PlatformTitle && r.PlatformTitle !== '-')?.PlatformTitle ?? '-',
      description: sorted.find((r) => r.PlatformDescription && r.PlatformDescription !== '-')?.PlatformDescription ?? '-',
      currentPrice: latest.SellingPrice,
      totalVolume: sorted.reduce((s, r) => s + r.SalesVolume, 0),
      profitPerUnit: latest.NetProfit,
      margin: latest.NetProfitMargin,
      totalEarnings: sorted.reduce((s, r) => s + r.TotalEarnings, 0),
      records: sorted
    })
  }
  return listings.sort((a, b) => a.platformName.localeCompare(b.platformName))
}

export function InventoryTable({
  products, mappings, categoryName, size, onReorder,
  onEditProduct, onDeleteProduct, onSellProduct, onAnalyze, onEditListing, onEditRecord, onDeleteRecord
}: InventoryTableProps) {
  const rate = useExchangeRateStore((s) => s.rate)
  const [openProducts, setOpenProducts] = useState<Set<string>>(new Set())
  const [openListings, setOpenListings] = useState<Set<string>>(new Set())
  const [dragId, setDragId] = useState<string | null>(null)

  const toggle = (set: Set<string>, key: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set)
    next.has(key) ? next.delete(key) : next.add(key)
    setter(next)
  }
  const openFolder = async (path: string | null) => { if (path) await window.api.shell.openFolder(path) }
  const pad = PAD[size]

  if (products.length === 0) {
    return <div className="card p-12 text-center text-gray-400 text-sm">尚無商品。點擊「新增商品」開始建立庫存。</div>
  }

  const COLS = 16

  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[1100px]">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="table-th w-6" />
            <th className="table-th w-6" />
            <th className="table-th">首圖</th>
            <th className="table-th">編號</th>
            <th className="table-th">分類</th>
            <th className="table-th">RMB成本</th>
            <th className="table-th">NTD成本</th>
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
            const listings = buildListings(rows)
            const costNTD = p.Cost_RMB * rate
            const totalVol = rows.reduce((s, r) => s + r.SalesVolume, 0)
            const totalEarnings = rows.reduce((s, r) => s + r.TotalEarnings, 0)
            const avgPrice = totalVol > 0
              ? rows.reduce((s, r) => s + r.SellingPrice * r.SalesVolume, 0) / totalVol
              : rows.length ? rows.reduce((s, r) => s + r.SellingPrice, 0) / rows.length : 0
            const avgProfit = totalVol > 0 ? totalEarnings / totalVol : 0
            const avgMargin = costNTD > 0 ? (avgProfit / costNTD) * 100 : 0

            return (
              <Fragment key={p.ProductID}>
                <tr
                  className={`table-tr cursor-pointer ${dragId === p.ProductID ? 'opacity-40' : ''}`}
                  draggable
                  onDragStart={() => setDragId(p.ProductID)}
                  onDragEnd={() => setDragId(null)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => { if (dragId) onReorder(dragId, p.ProductID); setDragId(null) }}
                  onClick={() => toggle(openProducts, p.ProductID, setOpenProducts)}
                >
                  <td className={`px-1 ${pad} text-gray-300`} title="拖曳排序"><GripVertical size={14} /></td>
                  <td className={`px-1 ${pad} text-gray-400`}>{isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                  <td className={`px-4 ${pad}`}><Thumbnail path={p.ImagePath} size={THUMB[size]} /></td>
                  <td className={`px-4 ${pad} font-mono font-medium text-indigo-700`}>{p.ProductID}</td>
                  <td className={`px-4 ${pad}`}><span className="badge badge-gray">{categoryName(p.CategoryID)}</span></td>
                  <td className={`px-4 ${pad} text-sm`}>¥{p.Cost_RMB.toFixed(2)}</td>
                  <td className={`px-4 ${pad} text-sm`}>NT${costNTD.toFixed(0)}</td>
                  <td className={`px-4 ${pad} text-sm`}>{p.CompetitorPrice != null ? `NT$${p.CompetitorPrice}` : '-'}</td>
                  <td className={`px-4 ${pad}`}><span className={`badge ${p.StockQuantity > 0 ? 'badge-green' : 'badge-red'}`}>{p.StockQuantity}</span></td>
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
                      <button className="btn-ghost p-1.5 text-blue-600 hover:bg-blue-50" title="分析此商品" onClick={() => onAnalyze(p.ProductID)}><BarChart2 size={14} /></button>
                      <button className="btn-ghost p-1.5 text-green-600 hover:bg-green-50" title="賣出" onClick={() => onSellProduct(p)}><ShoppingCart size={14} /></button>
                      <button className="btn-ghost p-1.5" title="編輯商品" onClick={() => onEditProduct(p)}><Pencil size={14} /></button>
                      <button className="btn-ghost p-1.5 hover:text-red-600" title="刪除" onClick={() => onDeleteProduct(p.ProductID)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>

                {/* Level 1: platform listings */}
                {isOpen && (
                  <tr>
                    <td colSpan={COLS} className="p-0 bg-indigo-50/40">
                      <div className="p-4">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">各平台上架與銷售</p>
                        {listings.length === 0 ? (
                          <p className="text-xs text-gray-400 py-2">此商品尚未上架任何平台（用「賣出」或編輯商品綁定平台）</p>
                        ) : (
                          <table className="w-full text-xs bg-white rounded-lg overflow-hidden">
                            <thead>
                              <tr className="text-gray-500 border-b border-indigo-200 bg-indigo-50/50">
                                <th className="w-6 py-1.5 px-2" />
                                <th className="text-left py-1.5 px-2">平台</th>
                                <th className="text-left py-1.5 px-2">標題</th>
                                <th className="text-left py-1.5 px-2">介紹</th>
                                <th className="text-left py-1.5 px-2">當前售價</th>
                                <th className="text-left py-1.5 px-2">總銷售量</th>
                                <th className="text-left py-1.5 px-2">淨利潤/件</th>
                                <th className="text-left py-1.5 px-2">利潤率</th>
                                <th className="text-left py-1.5 px-2">總收益</th>
                                <th className="py-1.5 px-2" />
                              </tr>
                            </thead>
                            <tbody>
                              {listings.map((l) => {
                                const key = `${l.productID}|${l.platformID}`
                                const lOpen = openListings.has(key)
                                return (
                                  <Fragment key={key}>
                                    <tr className="border-b border-indigo-100 hover:bg-indigo-50 cursor-pointer"
                                        onClick={() => toggle(openListings, key, setOpenListings)}>
                                      <td className="py-1.5 px-2 text-gray-400">{lOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</td>
                                      <td className="py-1.5 px-2 font-medium">{l.platformName}</td>
                                      <td className="py-1.5 px-2 max-w-[120px] truncate" title={l.title}>{l.title}</td>
                                      <td className="py-1.5 px-2 max-w-[120px] truncate" title={l.description}>{l.description}</td>
                                      <td className="py-1.5 px-2">NT${l.currentPrice}</td>
                                      <td className="py-1.5 px-2">{l.totalVolume}</td>
                                      <td className={`py-1.5 px-2 font-semibold ${l.profitPerUnit >= 0 ? 'text-green-600' : 'text-red-600'}`}>NT${l.profitPerUnit.toFixed(0)}</td>
                                      <td className={`py-1.5 px-2 ${l.margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>{l.margin.toFixed(1)}%</td>
                                      <td className={`py-1.5 px-2 font-semibold ${l.totalEarnings >= 0 ? 'text-green-600' : 'text-red-600'}`}>NT${l.totalEarnings.toFixed(0)}</td>
                                      <td className="py-1.5 px-2">
                                        <div onClick={(e) => e.stopPropagation()}>
                                          <button className="btn-ghost p-1" title="編輯標題/介紹" onClick={() => onEditListing(l)}><Tag size={12} /></button>
                                        </div>
                                      </td>
                                    </tr>
                                    {lOpen && (
                                      <tr>
                                        <td colSpan={10} className="p-0 bg-gray-50">
                                          <div className="px-4 py-2">
                                            <table className="w-full text-xs">
                                              <thead>
                                                <tr className="text-gray-400 border-b border-gray-200">
                                                  <th className="text-left py-1 px-2">日期</th>
                                                  <th className="text-left py-1 px-2">售價</th>
                                                  <th className="text-left py-1 px-2">銷售量</th>
                                                  <th className="text-left py-1 px-2">淨利潤/件</th>
                                                  <th className="text-left py-1 px-2">利潤率</th>
                                                  <th className="text-left py-1 px-2">總收益</th>
                                                  <th className="py-1 px-2" />
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {l.records.map((m) => (
                                                  <tr key={m.MappingID} className="border-b border-gray-100">
                                                    <td className="py-1 px-2 text-gray-500">{m.DateRecorded.slice(0, 10)}</td>
                                                    <td className="py-1 px-2">NT${m.SellingPrice}</td>
                                                    <td className="py-1 px-2">{m.SalesVolume}</td>
                                                    <td className={`py-1 px-2 ${m.NetProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>NT${m.NetProfit.toFixed(0)}</td>
                                                    <td className={`py-1 px-2 ${m.NetProfitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>{m.NetProfitMargin.toFixed(1)}%</td>
                                                    <td className={`py-1 px-2 ${m.TotalEarnings >= 0 ? 'text-green-600' : 'text-red-600'}`}>NT${m.TotalEarnings.toFixed(0)}</td>
                                                    <td className="py-1 px-2">
                                                      <div className="flex gap-1 justify-end">
                                                        <button className="btn-ghost p-1" title="編輯" onClick={() => onEditRecord(m)}><Pencil size={11} /></button>
                                                        <button className="btn-ghost p-1 hover:text-red-600" title="刪除" onClick={() => onDeleteRecord(m.MappingID)}><Trash2 size={11} /></button>
                                                      </div>
                                                    </td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </Fragment>
                                )
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
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
