import { useState, useEffect } from 'react'
import { X, ImagePlus, Link2, Boxes, Plus, Trash2 } from 'lucide-react'
import type { Product, Category, Platform, Currency, ProductDetail } from '@shared/types'
import { useCurrencies } from '../../hooks/useCurrencies'
import { Thumbnail } from './Thumbnail'

// A listing row this product already has (OrderID NULL), used to seed the form.
export interface ProductListing {
  PlatformID: string
  PlatformTitle: string
  PlatformDescription: string
  SellingPrice: number
  CompetitorPrice: number | null
}

interface ProductFormModalProps {
  product?: Product | null
  categories: Category[]
  platforms: Platform[]
  productListings?: ProductListing[]
  onClose: () => void
  onSaved: () => void
}

const baseName = (p: string) => p.split(/[\\/]/).pop() ?? p
const dirName = (p: string) => {
  const i = Math.max(p.lastIndexOf('\\'), p.lastIndexOf('/'))
  return i >= 0 ? p.slice(0, i) : ''
}

const ALL = '__ALL__'
interface ListingData { title: string; desc: string; price: string; competitor: string }
const blankListing = (): ListingData => ({ title: '', desc: '', price: '', competitor: '' })

interface CostRow { CostName: string; Amount: string; CurrencyCode: string }
interface DetailCard {
  DetailID?: string
  DetailName: string
  ImageKey: string | null
  ImagePath: string | null
  SellingPrice: string
  StockQuantity: string
  costs: CostRow[]
}
function blankCost(currencyCode = 'TWD'): CostRow { return { CostName: '', Amount: '', CurrencyCode: currencyCode } }
function blankCard(currencyCode = 'TWD'): DetailCard {
  return { DetailName: '', ImageKey: null, ImagePath: null, SellingPrice: '', StockQuantity: '', costs: [blankCost(currencyCode)] }
}
function fromDetail(d: ProductDetail): DetailCard {
  return {
    DetailID: d.DetailID, DetailName: d.DetailName, ImageKey: d.ImageKey, ImagePath: d.ImagePath,
    SellingPrice: String(d.SellingPrice), StockQuantity: String(d.StockQuantity),
    costs: d.costs.length
      ? d.costs.map((c) => ({ CostName: c.CostName, Amount: String(c.Amount), CurrencyCode: c.CurrencyCode }))
      : [blankCost()]
  }
}

export function ProductFormModal({ product, categories, platforms, productListings = [], onClose, onSaved }: ProductFormModalProps) {
  const isEdit = !!product
  const { currencies, load: loadCurrencies } = useCurrencies()

  const [form, setForm] = useState({
    CategoryID: '000', ImageKey: '', ImagePath: '', StockQuantity: '', LocalFolderPath: ''
  })
  const [costs, setCosts] = useState<CostRow[]>([blankCost()])
  const [preview, setPreview] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  // Platform listing state.
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [listingData, setListingData] = useState<Record<string, ListingData>>({})
  const [allBuffer, setAllBuffer] = useState<ListingData>(blankListing())
  const [originalListed, setOriginalListed] = useState<Set<string>>(new Set())
  const [target, setTarget] = useState<string>(ALL)

  // Inline product details (變體).
  const [detailCards, setDetailCards] = useState<DetailCard[]>([])
  const [removedDetailIds, setRemovedDetailIds] = useState<string[]>([])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasDetails = detailCards.length > 0

  useEffect(() => { loadCurrencies() }, [loadCurrencies])

  useEffect(() => {
    if (!product) return
    setForm({
      CategoryID: product.CategoryID,
      ImageKey: product.ImageKey ?? '',
      ImagePath: product.ImagePath ?? '',
      StockQuantity: String(product.StockQuantity),
      LocalFolderPath: product.LocalFolderPath ?? ''
    })
    setCosts(product.costs.length
      ? product.costs.map((c) => ({ CostName: c.CostName, Amount: String(c.Amount), CurrencyCode: c.CurrencyCode }))
      : [blankCost()])
    window.api.details.getByProduct(product.ProductID).then((ds: ProductDetail[]) => setDetailCards(ds.map(fromDetail)))
  }, [product])

  // Seed platform checkboxes + per-platform listing data from existing listings.
  useEffect(() => {
    const byPlatform = new Map(productListings.map((l) => [l.PlatformID, l]))
    const nextChecked: Record<string, boolean> = {}
    const nextData: Record<string, ListingData> = {}
    for (const p of platforms) {
      const l = byPlatform.get(p.PlatformID)
      nextChecked[p.PlatformID] = !!l
      nextData[p.PlatformID] = {
        title: l && l.PlatformTitle !== '-' ? l.PlatformTitle : '',
        desc: l && l.PlatformDescription !== '-' ? l.PlatformDescription : '',
        price: l && l.SellingPrice ? String(l.SellingPrice) : '',
        competitor: l && l.CompetitorPrice != null ? String(l.CompetitorPrice) : ''
      }
    }
    setChecked(nextChecked)
    setListingData(nextData)
    setOriginalListed(new Set(byPlatform.keys()))
    // Default the data dropdown to the first listed platform so its data shows;
    // "套用到所有平台" stays opt-in.
    const firstListed = platforms.find((p) => byPlatform.has(p.PlatformID))
    setTarget(firstListed ? firstListed.PlatformID : ALL)
  }, [platforms, productListings])

  useEffect(() => {
    let alive = true
    if (form.ImagePath) window.api.images.getDataUrl(form.ImagePath).then((u) => { if (alive) setPreview(u) })
    else setPreview(null)
    return () => { alive = false }
  }, [form.ImagePath])

  // Keep the platform-data dropdown valid when a platform is unchecked.
  useEffect(() => {
    if (target !== ALL && !checked[target]) setTarget(ALL)
  }, [checked, target])

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const checkedPlatformIds = platforms.filter((p) => checked[p.PlatformID]).map((p) => p.PlatformID)

  // ── Product image ──
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    const path = window.api.files.getPathForFile(file)
    if (!path) { setError('無法取得檔案路徑'); return }
    setForm((f) => ({ ...f, ImageKey: baseName(path), ImagePath: path, LocalFolderPath: f.LocalFolderPath || dirName(path) }))
  }

  // ── Product cost line-items (shared; only when no details) ──
  const rateOf = (code: string) => currencies.find((c) => c.CurrencyCode === code)?.RateToTWD ?? 1
  const totalCostNTD = costs.reduce((s, c) => s + (parseFloat(c.Amount) || 0) * rateOf(c.CurrencyCode), 0)
  const patchCost = (i: number, patch: Partial<CostRow>) => setCosts((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)))
  const addCost = () => setCosts((prev) => [...prev, blankCost(currencies[0]?.CurrencyCode ?? 'TWD')])
  const removeCost = (i: number) => setCosts((prev) => prev.filter((_, idx) => idx !== i))

  // ── Platform listing data ──
  const toggleChecked = (platformID: string) => {
    setChecked((prev) => {
      const turningOn = !prev[platformID]
      if (turningOn) {
        setListingData((d) => ({ ...d, [platformID]: d[platformID] ?? (target === ALL ? { ...allBuffer } : blankListing()) }))
      }
      return { ...prev, [platformID]: turningOn }
    })
  }
  const currentData: ListingData = target === ALL ? allBuffer : (listingData[target] ?? blankListing())
  const setField = (field: keyof ListingData, value: string) => {
    if (target === ALL) {
      setAllBuffer((b) => ({ ...b, [field]: value }))
      setListingData((prev) => {
        const next = { ...prev }
        for (const pid of checkedPlatformIds) next[pid] = { ...(next[pid] ?? blankListing()), [field]: value }
        return next
      })
    } else {
      setListingData((prev) => ({ ...prev, [target]: { ...(prev[target] ?? blankListing()), [field]: value } }))
    }
  }

  // ── Inline details ──
  const cardCostNTD = (card: DetailCard) => card.costs.reduce((s, c) => s + (parseFloat(c.Amount) || 0) * rateOf(c.CurrencyCode), 0)
  const patchCard = (i: number, patch: Partial<DetailCard>) => setDetailCards((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)))
  const patchDetailCost = (ci: number, ki: number, patch: Partial<CostRow>) =>
    setDetailCards((prev) => prev.map((c, idx) => idx === ci ? { ...c, costs: c.costs.map((k, kIdx) => (kIdx === ki ? { ...k, ...patch } : k)) } : c))
  const addCard = () => setDetailCards((prev) => [...prev, blankCard(currencies[0]?.CurrencyCode ?? 'TWD')])
  const removeCard = (i: number) => setDetailCards((prev) => {
    const card = prev[i]
    if (card.DetailID) setRemovedDetailIds((r) => [...r, card.DetailID!])
    return prev.filter((_, idx) => idx !== i)
  })
  const addDetailCost = (ci: number) => patchCard(ci, { costs: [...detailCards[ci].costs, blankCost(currencies[0]?.CurrencyCode ?? 'TWD')] })
  const removeDetailCost = (ci: number, ki: number) =>
    setDetailCards((prev) => prev.map((c, idx) => idx === ci ? { ...c, costs: c.costs.filter((_, kIdx) => kIdx !== ki) } : c))
  const onDropDetailImage = (i: number, e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    const path = window.api.files.getPathForFile(file)
    if (path) patchCard(i, { ImageKey: baseName(path), ImagePath: path })
  }

  const handleSubmit = async () => {
    setSaving(true); setError(null)
    try {
      for (const c of detailCards) if (!c.DetailName.trim()) throw new Error('每個細項都需要名稱。')

      const costInputs = hasDetails ? [] : costs
        .filter((c) => c.Amount !== '' || c.CostName.trim())
        .map((c) => ({ CostName: c.CostName.trim(), Amount: parseFloat(c.Amount) || 0, CurrencyCode: c.CurrencyCode }))
      const payload = {
        CategoryID: form.CategoryID,
        ImageKey: form.ImageKey.trim() || null,
        ImagePath: form.ImagePath.trim() || null,
        StockQuantity: parseInt(form.StockQuantity) || 0,
        LocalFolderPath: form.LocalFolderPath.trim() || null,
        costs: costInputs
      }

      // 1) Upsert product (may re-key on category change → use the returned ID).
      const saved = product
        ? await window.api.products.update(product.ProductID, payload)
        : await window.api.products.create(payload)
      const productID = saved.ProductID

      // 2) Inline details.
      for (const id of removedDetailIds) await window.api.details.delete(id)
      for (const card of detailCards) {
        const dpayload = {
          DetailName: card.DetailName.trim(),
          ImageKey: card.ImageKey,
          ImagePath: card.ImagePath,
          SellingPrice: parseFloat(card.SellingPrice) || 0,
          StockQuantity: parseInt(card.StockQuantity) || 0,
          costs: card.costs
            .filter((k) => k.Amount !== '' || k.CostName.trim())
            .map((k) => ({ CostName: k.CostName.trim(), Amount: parseFloat(k.Amount) || 0, CurrencyCode: k.CurrencyCode }))
        }
        if (card.DetailID) await window.api.details.update(card.DetailID, dpayload)
        else await window.api.details.create({ ProductID: productID, ...dpayload })
      }

      // 3) Listings: upsert each checked platform, un-list previously-listed ones.
      for (const p of platforms) {
        if (checked[p.PlatformID]) {
          const d = listingData[p.PlatformID] ?? blankListing()
          await window.api.mappings.create({
            ProductID: productID, PlatformID: p.PlatformID, DateRecorded: new Date().toISOString(),
            PlatformTitle: d.title.trim() || '-', PlatformDescription: d.desc.trim() || '-',
            SellingPrice: hasDetails ? 0 : (parseFloat(d.price) || 0),
            CompetitorPrice: d.competitor !== '' ? (parseFloat(d.competitor) || 0) : null,
            SalesVolume: 0
          })
        } else if (originalListed.has(p.PlatformID)) {
          await window.api.mappings.deleteListing(productID, p.PlatformID)
        }
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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="card w-[620px] max-h-[92vh] overflow-y-auto p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold">{isEdit ? `編輯商品 ${product!.ProductID}` : '新增商品'}</h2>
          <button onClick={onClose} className="btn-ghost p-1"><X size={16} /></button>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>}

        <div className="space-y-4">
          {/* First image */}
          <div>
            <label className="label">首圖（拖曳圖片至此，自動帶入檔名與資料夾）</label>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`flex items-center gap-4 p-4 rounded-lg border-2 border-dashed transition-colors ${dragOver ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 bg-gray-50'}`}
            >
              {preview ? (
                <img src={preview} alt="preview" className="w-20 h-20 object-cover rounded-lg border border-gray-200" />
              ) : (
                <div className="w-20 h-20 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-300"><ImagePlus size={28} /></div>
              )}
              <div className="flex-1 min-w-0 text-xs text-gray-500">
                {form.ImageKey ? <p className="font-mono text-indigo-700 truncate">{form.ImageKey}</p> : <p>將首圖檔案拖曳到這裡</p>}
                {form.ImagePath && <p className="truncate mt-0.5" title={form.ImagePath}>{form.ImagePath}</p>}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">首圖檔案名稱</label>
              <input className="input" value={form.ImageKey} onChange={(e) => set('ImageKey', e.target.value)} placeholder="product_001.jpg" />
            </div>
            <div>
              <label className="label">分類（選填）</label>
              <select className="input" value={form.CategoryID} onChange={(e) => set('CategoryID', e.target.value)}>
                {categories.map((c) => <option key={c.CategoryID} value={c.CategoryID}>{c.CategoryName}</option>)}
              </select>
            </div>
          </div>
          {isEdit && <p className="text-xs text-gray-400 -mt-2">PK：<span className="font-mono">{product!.ProductID}</span>　變更分類會自動重新編號（資料保留）。</p>}

          {/* 1) Platform checkboxes (which platforms to list on — no data here) */}
          <div>
            <label className="label flex items-center gap-1"><Link2 size={13} /> 上架平台（勾選＝上架，資料於下方填寫）</label>
            <div className="flex flex-wrap gap-3 rounded-lg border border-gray-200 p-3 bg-gray-50">
              {platforms.length === 0 && <p className="text-xs text-gray-400">尚無平台，請先於系統設定新增。</p>}
              {platforms.map((p) => (
                <label key={p.PlatformID} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="checkbox" checked={!!checked[p.PlatformID]} onChange={() => toggleChecked(p.PlatformID)} />
                  {p.PlatformName}
                </label>
              ))}
            </div>
          </div>

          {/* 2) Per-platform listing data (dropdown: 套用到所有平台 / each checked platform) */}
          {checkedPlatformIds.length > 0 && (
            <div className="rounded-lg border border-gray-200 p-3 bg-gray-50 space-y-3">
              <div className="flex items-center gap-2">
                <label className="label !mb-0">上架資料</label>
                <select className="input !w-auto !py-1 text-sm" value={target} onChange={(e) => setTarget(e.target.value)}>
                  <option value={ALL}>套用到所有平台</option>
                  {checkedPlatformIds.map((pid) => (
                    <option key={pid} value={pid}>{platforms.find((p) => p.PlatformID === pid)?.PlatformName}</option>
                  ))}
                </select>
                {target === ALL && <span className="text-xs text-gray-400">所有已勾選平台填入相同資料</span>}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label !text-[10px]">售價 NT$　{hasDetails && <span className="text-gray-400">細項各自定價</span>}</label>
                  <input className="input !py-1.5 text-sm" placeholder={hasDetails ? '由細項定價' : '選填'} type="number" min="0" value={hasDetails ? '' : currentData.price} onChange={(e) => setField('price', e.target.value)} disabled={hasDetails} />
                </div>
                <div>
                  <label className="label !text-[10px]">競品大約價格 NT$</label>
                  <input className="input !py-1.5 text-sm" placeholder="選填" type="number" min="0" value={currentData.competitor} onChange={(e) => setField('competitor', e.target.value)} />
                </div>
                <input className="input !py-1.5 text-sm col-span-2" placeholder="平台標題（選填）" value={currentData.title} onChange={(e) => setField('title', e.target.value)} />
                <input className="input !py-1.5 text-sm col-span-2" placeholder="平台介紹（選填）" value={currentData.desc} onChange={(e) => setField('desc', e.target.value)} />
              </div>
            </div>
          )}

          {/* 3) Shared product data */}
          {hasDetails ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-500">
              此商品已有細項，成本與庫存以各細項彙總計算，無獨立成本/庫存。
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="label !mb-0">成本（可多筆、可選幣別，換算後 NT${totalCostNTD.toFixed(0)}）</label>
                <button type="button" onClick={addCost} className="text-xs text-indigo-600 hover:underline flex items-center gap-0.5"><Plus size={11} /> 新增成本</button>
              </div>
              <div className="space-y-1.5">
                {costs.map((cost, i) => (
                  <div key={i} className="grid grid-cols-[1fr_110px_90px_auto] gap-2">
                    <input className="input !py-1 text-xs" value={cost.CostName} onChange={(e) => patchCost(i, { CostName: e.target.value })} placeholder="名稱（選填，如 進貨/運費）" />
                    <input className="input !py-1 text-xs" type="number" min="0" step="0.01" value={cost.Amount} onChange={(e) => patchCost(i, { Amount: e.target.value })} placeholder="金額" />
                    <select className="input !py-1 text-xs" value={cost.CurrencyCode} onChange={(e) => patchCost(i, { CurrencyCode: e.target.value })}>
                      {currencies.map((c: Currency) => <option key={c.CurrencyCode} value={c.CurrencyCode}>{c.CurrencyCode}</option>)}
                    </select>
                    <button type="button" onClick={() => removeCost(i)} className="btn-ghost p-1 hover:text-red-600" disabled={costs.length <= 1}><Trash2 size={12} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!hasDetails && (
            <div>
              <label className="label">庫存量 (件)</label>
              <input className="input" type="number" min="0" value={form.StockQuantity} onChange={(e) => set('StockQuantity', e.target.value)} placeholder="0" />
            </div>
          )}

          {/* 4) Inline product details */}
          <div>
            <label className="label flex items-center gap-1"><Boxes size={14} /> 商品細項（變體，跨平台共用；圖片留空＝商品首圖）</label>
            <div className="space-y-3">
              {detailCards.map((card, i) => (
                <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-900/40">
                  <div className="flex items-start gap-3">
                    <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDropDetailImage(i, e)} title="拖曳圖片設為此細項圖片（留空沿用商品首圖）" className="shrink-0 relative">
                      {card.ImagePath || form.ImagePath
                        ? <Thumbnail path={card.ImagePath ?? form.ImagePath} size={56} />
                        : <div className="w-14 h-14 flex items-center justify-center rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-300"><ImagePlus size={20} /></div>}
                      {card.ImagePath ? (
                        <button type="button" onClick={() => patchCard(i, { ImageKey: null, ImagePath: null })} title="清除覆寫，還原為商品首圖"
                          className="absolute -top-1.5 -right-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-full p-0.5 text-gray-400 hover:text-red-600 shadow"><X size={11} /></button>
                      ) : (
                        <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 text-[9px] text-gray-400 whitespace-nowrap">＝商品首圖</span>
                      )}
                    </div>
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <div className="col-span-2"><label className="label !text-[10px]">細項名稱</label><input className="input !py-1 text-xs" value={card.DetailName} onChange={(e) => patchCard(i, { DetailName: e.target.value })} placeholder="例如：紅色 / L 號" /></div>
                      <div><label className="label !text-[10px]">售價 (NT$)</label><input className="input !py-1 text-xs" type="number" min="0" value={card.SellingPrice} onChange={(e) => patchCard(i, { SellingPrice: e.target.value })} placeholder="0" /></div>
                      <div><label className="label !text-[10px]">庫存 (件)</label><input className="input !py-1 text-xs" type="number" min="0" value={card.StockQuantity} onChange={(e) => patchCard(i, { StockQuantity: e.target.value })} placeholder="0" /></div>
                    </div>
                    <button type="button" onClick={() => removeCard(i)} title="刪除此細項" className="btn-ghost p-1 hover:text-red-600 shrink-0"><Trash2 size={14} /></button>
                  </div>
                  <div className="mt-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="label !mb-0 !text-[10px]">成本（換算後 NT${cardCostNTD(card).toFixed(0)}）</label>
                      <button type="button" onClick={() => addDetailCost(i)} className="text-xs text-indigo-600 hover:underline flex items-center gap-0.5"><Plus size={10} /> 新增成本</button>
                    </div>
                    <div className="space-y-1.5">
                      {card.costs.map((cost, ki) => (
                        <div key={ki} className="grid grid-cols-[1fr_100px_80px_auto] gap-2">
                          <input className="input !py-1 text-xs" value={cost.CostName} onChange={(e) => patchDetailCost(i, ki, { CostName: e.target.value })} placeholder="名稱（選填）" />
                          <input className="input !py-1 text-xs" type="number" min="0" step="0.01" value={cost.Amount} onChange={(e) => patchDetailCost(i, ki, { Amount: e.target.value })} placeholder="金額" />
                          <select className="input !py-1 text-xs" value={cost.CurrencyCode} onChange={(e) => patchDetailCost(i, ki, { CurrencyCode: e.target.value })}>
                            {currencies.map((c: Currency) => <option key={c.CurrencyCode} value={c.CurrencyCode}>{c.CurrencyCode}</option>)}
                          </select>
                          <button type="button" onClick={() => removeDetailCost(i, ki)} className="btn-ghost p-1 hover:text-red-600" disabled={card.costs.length <= 1}><Trash2 size={11} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button type="button" onClick={addCard} className="btn-secondary w-full justify-center mt-2 border-dashed"><Plus size={14} /> 新增商品細項</button>
          </div>

          {/* 5) Local folder path (kept at the very bottom) */}
          <div>
            <label className="label">本機資料夾路徑</label>
            <input className="input" value={form.LocalFolderPath} onChange={(e) => set('LocalFolderPath', e.target.value)} placeholder="自動帶入" />
          </div>
        </div>

        <div className="flex gap-3 justify-end mt-6">
          <button onClick={onClose} className="btn-secondary">取消</button>
          <button onClick={handleSubmit} disabled={saving} className="btn-primary">{saving ? '儲存中…' : '儲存'}</button>
        </div>
      </div>
    </div>
  )
}
