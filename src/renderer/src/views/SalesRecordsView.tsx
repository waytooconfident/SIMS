import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, X } from 'lucide-react'
import type { OrderWithCalc, CreateOrderInput, TimePreset } from '@shared/types'
import { useOrders } from '../hooks/useOrders'
import { usePlatforms } from '../hooks/usePlatforms'
import { useCategories } from '../hooks/useCategories'
import { useProducts } from '../hooks/useProducts'
import { useDetails } from '../hooks/useDetails'
import { useSalesFilterStore } from '../stores/useSalesFilterStore'
import { Thumbnail } from '../components/inventory/Thumbnail'
import { OrderFormModal } from '../components/inventory/OrderFormModal'

const TIME_PRESETS: { value: TimePreset; label: string }[] = [
  { value: 'all', label: '全部' }, { value: '7d', label: '近7天' }, { value: '30d', label: '近30天' },
  { value: '90d', label: '近90天' }, { value: '365d', label: '近一年' }
]

export function SalesRecordsView() {
  const { orders, loading, load, create, update, remove } = useOrders()
  const { platforms, load: loadPlatforms } = usePlatforms()
  const { categories, load: loadCategories, nameOf } = useCategories()
  const { products, load: loadProducts } = useProducts()
  const { details, load: loadDetails } = useDetails()
  const f = useSalesFilterStore()

  const [modal, setModal] = useState<{ open: boolean; target?: OrderWithCalc | null; prefill?: string | null }>({ open: false })

  const reload = () => load(f.buildFilter())

  useEffect(() => { loadPlatforms(); loadCategories(); loadProducts(); loadDetails() }, [loadPlatforms, loadCategories, loadProducts, loadDetails])
  useEffect(() => { reload() }, [f.timePreset, f.platformID, f.productID, f.categoryID, load])

  const handleSubmit = async (input: CreateOrderInput) => {
    if (modal.target) await update(modal.target.OrderID, input)
    else await create(input)
    reload()
  }
  const handleDelete = async (order: OrderWithCalc) => {
    if (!confirm(`確定刪除這筆銷售紀錄（${order.DateRecorded.slice(0, 10)} · ${order.PlatformName}）？庫存將回補。`)) return
    await remove(order.OrderID)
    reload()
  }

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
        <button onClick={() => setModal({ open: true, target: null })} className="btn-primary ml-auto"><Plus size={15} /> 新增銷售紀錄</button>
        <span className="text-xs text-gray-400">{orders.length} 筆訂單</span>
      </div>

      {loading ? (
        <div className="card p-12 text-center text-gray-400 text-sm">載入中…</div>
      ) : orders.length === 0 ? (
        <div className="card p-12 text-center text-gray-400 text-sm">此條件下尚無銷售紀錄。</div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <div key={o.OrderID} className="card p-4">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{o.DateRecorded.slice(0, 10)}</span>
                <span className="badge badge-gray">{o.PlatformName}</span>
                {o.Note && <span className="text-xs text-gray-400 truncate max-w-[200px]" title={o.Note}>{o.Note}</span>}
                <div className="ml-auto flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">淨利</p>
                    <p className={`text-sm font-semibold ${o.NetEarnings >= 0 ? 'text-green-600' : 'text-red-600'}`}>NT${o.NetEarnings.toFixed(0)}</p>
                  </div>
                  <button className="btn-ghost p-1.5" title="編輯" onClick={() => setModal({ open: true, target: o })}><Pencil size={14} /></button>
                  <button className="btn-ghost p-1.5 hover:text-red-600" title="刪除" onClick={() => handleDelete(o)}><Trash2 size={14} /></button>
                </div>
              </div>

              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-100 dark:border-gray-700">
                    <th className="text-left py-1 px-2">商品</th>
                    <th className="text-left py-1 px-2">細項</th>
                    <th className="text-right py-1 px-2">售價</th>
                    <th className="text-right py-1 px-2">數量</th>
                    <th className="text-right py-1 px-2">淨利潤/件</th>
                    <th className="text-right py-1 px-2">小計收益</th>
                  </tr>
                </thead>
                <tbody>
                  {o.items.map((it) => (
                    <tr key={it.MappingID} className="border-b border-gray-50 dark:border-gray-800">
                      <td className="py-1 px-2">
                        <span className="inline-flex items-center gap-1.5">
                          <Thumbnail path={it.ImagePath} size={28} />
                          <span className="font-mono text-indigo-700 dark:text-indigo-300">{it.ProductID}</span>
                          <span className="text-[10px] text-gray-400">{nameOf(it.CategoryID)}</span>
                        </span>
                      </td>
                      <td className="py-1 px-2">{it.DetailName ?? <span className="text-gray-300">—</span>}</td>
                      <td className="py-1 px-2 text-right">NT${it.SellingPrice}</td>
                      <td className="py-1 px-2 text-right">{it.SalesVolume}</td>
                      <td className={`py-1 px-2 text-right ${it.NetProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>NT${it.NetProfit.toFixed(0)}</td>
                      <td className={`py-1 px-2 text-right font-medium ${it.TotalEarnings >= 0 ? 'text-green-600' : 'text-red-600'}`}>NT${it.TotalEarnings.toFixed(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {o.extraCosts.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                  <span className="text-gray-400">專屬成本：</span>
                  {o.extraCosts.map((c) => (
                    <span key={c.CostID} className="badge badge-gray">{c.CostName || '成本'} {c.Amount} {c.CurrencyCode}</span>
                  ))}
                  <span className="text-gray-400">（換算 NT${o.TotalExtraCostNTD.toFixed(0)}）</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modal.open && (
        <OrderFormModal
          order={modal.target}
          products={products}
          platforms={platforms}
          details={details}
          categoryName={nameOf}
          prefillProductID={modal.prefill}
          onSubmit={handleSubmit}
          onClose={() => setModal({ open: false })}
        />
      )}
    </div>
  )
}
