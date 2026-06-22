import { useState, useMemo, useEffect } from 'react'
import { X, ShoppingCart } from 'lucide-react'
import type { Product, Platform, MappingWithCalc, SellInput, ProductDetail } from '@shared/types'
import { Thumbnail } from './Thumbnail'

interface SellModalProps {
  product: Product
  platforms: Platform[]
  mappings: MappingWithCalc[]   // used to prefill the most recent selling price
  onSell: (input: SellInput) => Promise<void>
  onClose: () => void
}

interface DetailRowState { checked: boolean; qty: string; price: string }

export function SellModal({ product, platforms, mappings, onSell, onClose }: SellModalProps) {
  const [platformID, setPlatformID] = useState(platforms[0]?.PlatformID ?? '')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10)) // day precision
  const [quantity, setQuantity] = useState('1')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load this product's details — if any, we sell at the detail level.
  const [details, setDetails] = useState<ProductDetail[]>([])
  const [rows, setRows] = useState<Record<string, DetailRowState>>({})
  useEffect(() => {
    window.api.details.getByProduct(product.ProductID).then((ds: ProductDetail[]) => {
      setDetails(ds)
      setRows(Object.fromEntries(ds.map((d) => [d.DetailID, { checked: false, qty: '1', price: String(d.SellingPrice || '') }])))
    })
  }, [product.ProductID])
  const hasDetails = details.length > 0

  // Most recent known selling price for this product on the chosen platform (no-detail case).
  const suggestedPrice = useMemo(() => {
    const r = mappings
      .filter((m) => m.ProductID === product.ProductID && m.PlatformID === platformID && !m.DetailID && m.SellingPrice > 0)
      .sort((a, b) => b.DateRecorded.localeCompare(a.DateRecorded))
    return r[0]?.SellingPrice ?? 0
  }, [mappings, product.ProductID, platformID])

  const [price, setPrice] = useState<string>('')
  const effectivePrice = price !== '' ? price : String(suggestedPrice)

  const patchRow = (id: string, patch: Partial<DetailRowState>) =>
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))

  const handleSubmit = async () => {
    if (!platformID) { setError('請選擇平台'); return }
    setError(null)
    try {
      if (hasDetails) {
        const chosen = details
          .filter((d) => rows[d.DetailID]?.checked && (parseInt(rows[d.DetailID].qty) || 0) > 0)
          .map((d) => ({ detailID: d.DetailID, quantity: parseInt(rows[d.DetailID].qty) || 0, sellingPrice: parseFloat(rows[d.DetailID].price) || 0 }))
        if (chosen.length === 0) { setError('請至少勾選一個細項並填入數量'); return }
        setSaving(true)
        await onSell({ productID: product.ProductID, platformID, date: new Date(date).toISOString(), details: chosen })
      } else {
        const qty = parseInt(quantity) || 0
        if (qty <= 0) { setError('賣出數量需大於 0'); return }
        setSaving(true)
        await onSell({ productID: product.ProductID, platformID, date: new Date(date).toISOString(), sellingPrice: parseFloat(effectivePrice) || 0, quantity: qty })
      }
      onClose()
    } catch (e) {
      setError(String(e).replace(/^Error:\s*/, ''))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="card w-[480px] max-h-[92vh] overflow-y-auto p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold flex items-center gap-2"><ShoppingCart size={16} /> 賣出商品</h2>
          <button onClick={onClose} className="btn-ghost p-1"><X size={16} /></button>
        </div>

        <div className="mb-4 p-2 bg-indigo-50 rounded-lg text-xs text-indigo-700 font-mono">
          {product.ProductID}　{hasDetails ? `共 ${details.length} 個細項` : `目前庫存：${product.StockQuantity} 件`}
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>}

        <div className="space-y-4">
          <div>
            <label className="label">賣出平台</label>
            <select className="input" value={platformID} onChange={(e) => { setPlatformID(e.target.value); setPrice('') }}>
              {platforms.map((p) => <option key={p.PlatformID} value={p.PlatformID}>{p.PlatformName}</option>)}
            </select>
          </div>

          <div>
            <label className="label">賣出日期</label>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          {hasDetails ? (
            <div>
              <label className="label">選擇細項（可複選，代表一起賣出）</label>
              <div className="space-y-2 rounded-lg border border-gray-200 dark:border-gray-700 p-2">
                {details.map((d) => {
                  const r = rows[d.DetailID]
                  if (!r) return null
                  return (
                    <div key={d.DetailID} className={`rounded-lg p-2 ${r.checked ? 'bg-indigo-50 dark:bg-indigo-500/10' : ''}`}>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={r.checked} onChange={(e) => patchRow(d.DetailID, { checked: e.target.checked })} />
                        <Thumbnail path={d.ImagePath ?? product.ImagePath} size={28} />
                        <span className="text-sm font-medium flex-1 truncate">{d.DetailName}</span>
                        <span className="text-xs text-gray-400">庫存 {d.StockQuantity}</span>
                      </label>
                      {r.checked && (
                        <div className="mt-2 ml-6 grid grid-cols-2 gap-2">
                          <div>
                            <label className="label !text-[10px]">數量</label>
                            <input className="input !py-1 text-xs" type="number" min="1" value={r.qty} onChange={(e) => patchRow(d.DetailID, { qty: e.target.value })} />
                          </div>
                          <div>
                            <label className="label !text-[10px]">售價 NT$</label>
                            <input className="input !py-1 text-xs" type="number" min="0" value={r.price} onChange={(e) => patchRow(d.DetailID, { price: e.target.value })} />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">賣出數量 (件)</label>
                <input className="input" type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              </div>
              <div>
                <label className="label">售價 (NT$)　{suggestedPrice > 0 && <span className="text-gray-400">建議：NT${suggestedPrice}</span>}</label>
                <input className="input" type="number" min="0" value={effectivePrice} onChange={(e) => setPrice(e.target.value)} />
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-end mt-6">
          <button onClick={onClose} className="btn-secondary">取消</button>
          <button onClick={handleSubmit} disabled={saving} className="btn-primary">
            {saving ? '處理中…' : '確認賣出'}
          </button>
        </div>
      </div>
    </div>
  )
}
