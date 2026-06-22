import { useState, useMemo } from 'react'
import { X, ShoppingCart } from 'lucide-react'
import type { Product, Platform, MappingWithCalc, SellInput } from '@shared/types'

interface SellModalProps {
  product: Product
  platforms: Platform[]
  mappings: MappingWithCalc[]   // used to prefill the most recent selling price
  onSell: (input: SellInput) => Promise<void>
  onClose: () => void
}

export function SellModal({ product, platforms, mappings, onSell, onClose }: SellModalProps) {
  const [platformID, setPlatformID] = useState(platforms[0]?.PlatformID ?? '')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10)) // day precision
  const [quantity, setQuantity] = useState('1')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Most recent known selling price for this product on the chosen platform.
  const suggestedPrice = useMemo(() => {
    const rows = mappings
      .filter((m) => m.ProductID === product.ProductID && m.PlatformID === platformID && m.SellingPrice > 0)
      .sort((a, b) => b.DateRecorded.localeCompare(a.DateRecorded))
    return rows[0]?.SellingPrice ?? 0
  }, [mappings, product.ProductID, platformID])

  const [price, setPrice] = useState<string>('')
  const effectivePrice = price !== '' ? price : String(suggestedPrice)

  const handleSubmit = async () => {
    const qty = parseInt(quantity) || 0
    if (!platformID) { setError('請選擇平台'); return }
    if (qty <= 0) { setError('賣出數量需大於 0'); return }
    setSaving(true)
    setError(null)
    try {
      await onSell({
        productID: product.ProductID,
        platformID,
        date: new Date(date).toISOString(),
        sellingPrice: parseFloat(effectivePrice) || 0,
        quantity: qty
      })
      onClose()
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="card w-[440px] p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold flex items-center gap-2"><ShoppingCart size={16} /> 賣出商品</h2>
          <button onClick={onClose} className="btn-ghost p-1"><X size={16} /></button>
        </div>

        <div className="mb-4 p-2 bg-indigo-50 rounded-lg text-xs text-indigo-700 font-mono">
          {product.ProductID}　目前庫存：{product.StockQuantity} 件
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>}

        <div className="space-y-4">
          <div>
            <label className="label">賣出平台</label>
            <select className="input" value={platformID} onChange={(e) => { setPlatformID(e.target.value); setPrice('') }}>
              {platforms.map((p) => <option key={p.PlatformID} value={p.PlatformID}>{p.PlatformName}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">賣出日期</label>
              <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <label className="label">賣出數量 (件)</label>
              <input className="input" type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label">售價 (NT$)　{suggestedPrice > 0 && <span className="text-gray-400">建議：NT${suggestedPrice}</span>}</label>
            <input className="input" type="number" min="0" value={effectivePrice} onChange={(e) => setPrice(e.target.value)} />
          </div>
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
