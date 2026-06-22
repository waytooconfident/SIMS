import { useEffect, useState } from 'react'
import { X, Plus, Trash2, ImagePlus, Save, Boxes } from 'lucide-react'
import type { Product, ProductDetail, Currency } from '@shared/types'
import { useCurrencies } from '../../hooks/useCurrencies'
import { Thumbnail } from './Thumbnail'

interface CostRow { CostID?: string; CostName: string; Amount: string; CurrencyCode: string }
interface DetailCard {
  DetailID?: string
  DetailName: string
  ImageKey: string | null
  ImagePath: string | null
  SellingPrice: string
  StockQuantity: string
  costs: CostRow[]
}

const baseName = (p: string) => p.split(/[\\/]/).pop() ?? p

function blankCost(currencyCode = 'TWD'): CostRow { return { CostName: '', Amount: '', CurrencyCode: currencyCode } }
function blankCard(currencyCode = 'TWD'): DetailCard {
  return { DetailName: '', ImageKey: null, ImagePath: null, SellingPrice: '', StockQuantity: '', costs: [blankCost(currencyCode)] }
}
function fromDetail(d: ProductDetail): DetailCard {
  return {
    DetailID: d.DetailID,
    DetailName: d.DetailName,
    ImageKey: d.ImageKey,
    ImagePath: d.ImagePath,
    SellingPrice: String(d.SellingPrice),
    StockQuantity: String(d.StockQuantity),
    costs: d.costs.length
      ? d.costs.map((c) => ({ CostID: c.CostID, CostName: c.CostName, Amount: String(c.Amount), CurrencyCode: c.CurrencyCode }))
      : [blankCost()]
  }
}

interface Props {
  product: Product
  onClose: () => void
  onSaved: () => void
}

// Manage ALL of a product's details (變體) at once: a stack of detail "cards",
// each with its own image / name / cost line-items (currency-selectable) /
// price / stock, plus an "新增細項" button to add another card.
export function DetailsManagerModal({ product, onClose, onSaved }: Props) {
  const { currencies, load: loadCurrencies } = useCurrencies()
  const [cards, setCards] = useState<DetailCard[]>([])
  const [removedIds, setRemovedIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { loadCurrencies() }, [loadCurrencies])
  useEffect(() => {
    window.api.details.getByProduct(product.ProductID).then((ds: ProductDetail[]) => {
      setCards(ds.length ? ds.map(fromDetail) : [blankCard()])
    })
  }, [product.ProductID])

  const rateOf = (code: string) => currencies.find((c) => c.CurrencyCode === code)?.RateToTWD ?? 1
  const cardCostNTD = (card: DetailCard) =>
    card.costs.reduce((s, c) => s + (parseFloat(c.Amount) || 0) * rateOf(c.CurrencyCode), 0)

  const patchCard = (i: number, patch: Partial<DetailCard>) =>
    setCards((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)))
  const patchCost = (ci: number, ki: number, patch: Partial<CostRow>) =>
    setCards((prev) => prev.map((c, idx) => idx === ci
      ? { ...c, costs: c.costs.map((k, kIdx) => (kIdx === ki ? { ...k, ...patch } : k)) }
      : c))

  const addCard = () => setCards((prev) => [...prev, blankCard(currencies[0]?.CurrencyCode ?? 'TWD')])
  const removeCard = (i: number) => setCards((prev) => {
    const card = prev[i]
    if (card.DetailID) setRemovedIds((r) => [...r, card.DetailID!])
    return prev.filter((_, idx) => idx !== i)
  })
  const addCost = (ci: number) => patchCard(ci, { costs: [...cards[ci].costs, blankCost(currencies[0]?.CurrencyCode ?? 'TWD')] })
  const removeCost = (ci: number, ki: number) =>
    setCards((prev) => prev.map((c, idx) => idx === ci ? { ...c, costs: c.costs.filter((_, kIdx) => kIdx !== ki) } : c))

  const onDropImage = async (i: number, e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    const path = window.api.files.getPathForFile(file)
    if (path) patchCard(i, { ImageKey: baseName(path), ImagePath: path })
  }

  const handleSave = async () => {
    for (const c of cards) {
      if (!c.DetailName.trim()) { setError('每個細項都需要名稱。'); return }
    }
    setSaving(true); setError(null)
    try {
      for (const id of removedIds) await window.api.details.delete(id)
      for (const c of cards) {
        const payload = {
          DetailName: c.DetailName.trim(),
          ImageKey: c.ImageKey,
          ImagePath: c.ImagePath,
          SellingPrice: parseFloat(c.SellingPrice) || 0,
          StockQuantity: parseInt(c.StockQuantity) || 0,
          costs: c.costs
            .filter((k) => k.Amount !== '' || k.CostName.trim())
            .map((k) => ({ CostName: k.CostName.trim(), Amount: parseFloat(k.Amount) || 0, CurrencyCode: k.CurrencyCode }))
        }
        if (c.DetailID) await window.api.details.update(c.DetailID, payload)
        else await window.api.details.create({ ProductID: product.ProductID, ...payload })
      }
      // Persist the on-screen order.
      const ids = cards.map((c) => c.DetailID).filter(Boolean) as string[]
      if (ids.length) {
        // re-fetch to map fresh IDs for newly created rows, then keep visual order
        const fresh: ProductDetail[] = await window.api.details.getByProduct(product.ProductID)
        const orderByName = new Map(cards.map((c, i) => [c.DetailName.trim(), i]))
        const ordered = [...fresh].sort((a, b) => (orderByName.get(a.DetailName) ?? 0) - (orderByName.get(b.DetailName) ?? 0))
        await window.api.details.reorder(ordered.map((d) => d.DetailID))
      }
      onSaved()
      onClose()
    } catch (e) {
      setError(String(e).replace(/^Error:\s*/, ''))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]" onClick={onClose}>
      <div className="card w-[680px] max-h-[92vh] overflow-y-auto p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold flex items-center gap-2"><Boxes size={17} /> 商品細項 — {product.ProductID}</h2>
          <button onClick={onClose} className="btn-ghost p-1"><X size={16} /></button>
        </div>
        <p className="text-xs text-gray-400 mb-4">每個細項各自有圖片、成本(可多筆、可選幣別)、售價與庫存；統計與賣出皆以細項為單位。圖片留空則沿用商品首圖。</p>
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>}

        <div className="space-y-4">
          {cards.map((card, i) => (
            <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900/40">
              <div className="flex items-start gap-4">
                {/* Image (default = product image) */}
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => onDropImage(i, e)}
                  title="拖曳圖片設為此細項圖片（留空沿用商品首圖）"
                  className="shrink-0"
                >
                  {card.ImagePath || product.ImagePath
                    ? <Thumbnail path={card.ImagePath ?? product.ImagePath} size={64} />
                    : <div className="w-16 h-16 flex items-center justify-center rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-300"><ImagePlus size={22} /></div>}
                </div>

                <div className="flex-1 grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <label className="label">細項名稱</label>
                    <input className="input !py-1.5" value={card.DetailName} onChange={(e) => patchCard(i, { DetailName: e.target.value })} placeholder="例如：紅色 / L 號" />
                  </div>
                  <div>
                    <label className="label">售價 (NT$)</label>
                    <input className="input !py-1.5" type="number" min="0" value={card.SellingPrice} onChange={(e) => patchCard(i, { SellingPrice: e.target.value })} placeholder="0" />
                  </div>
                  <div>
                    <label className="label">庫存 (件)</label>
                    <input className="input !py-1.5" type="number" min="0" value={card.StockQuantity} onChange={(e) => patchCard(i, { StockQuantity: e.target.value })} placeholder="0" />
                  </div>
                </div>

                <button onClick={() => removeCard(i)} title="刪除此細項" className="btn-ghost p-1.5 hover:text-red-600 shrink-0"><Trash2 size={15} /></button>
              </div>

              {/* Costs */}
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1">
                  <label className="label !mb-0">成本（可多筆，換算後 NT${cardCostNTD(card).toFixed(0)}）</label>
                  <button onClick={() => addCost(i)} className="text-xs text-indigo-600 hover:underline flex items-center gap-0.5"><Plus size={11} /> 新增成本</button>
                </div>
                <div className="space-y-1.5">
                  {card.costs.map((cost, ki) => (
                    <div key={ki} className="grid grid-cols-[1fr_110px_90px_auto] gap-2">
                      <input className="input !py-1 text-xs" value={cost.CostName} onChange={(e) => patchCost(i, ki, { CostName: e.target.value })} placeholder="名稱（選填，如 進貨/運費）" />
                      <input className="input !py-1 text-xs" type="number" min="0" step="0.01" value={cost.Amount} onChange={(e) => patchCost(i, ki, { Amount: e.target.value })} placeholder="金額" />
                      <select className="input !py-1 text-xs" value={cost.CurrencyCode} onChange={(e) => patchCost(i, ki, { CurrencyCode: e.target.value })}>
                        {currencies.map((c: Currency) => <option key={c.CurrencyCode} value={c.CurrencyCode}>{c.CurrencyCode}</option>)}
                      </select>
                      <button onClick={() => removeCost(i, ki)} className="btn-ghost p-1 hover:text-red-600" disabled={card.costs.length <= 1}><Trash2 size={12} /></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <button onClick={addCard} className="btn-secondary w-full justify-center mt-4 border-dashed"><Plus size={14} /> 新增細項</button>

        <div className="flex gap-3 justify-end mt-6">
          <button onClick={onClose} className="btn-secondary">取消</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary"><Save size={14} /> {saving ? '儲存中…' : '儲存細項'}</button>
        </div>
      </div>
    </div>
  )
}
