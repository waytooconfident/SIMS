import { useEffect, useMemo, useRef, useState } from 'react'
import { X, Plus, Trash2, Search, ShoppingCart } from 'lucide-react'
import type { Product, Platform, Currency, ProductDetail, OrderWithCalc, CreateOrderInput } from '@shared/types'
import { useCurrencies } from '../../hooks/useCurrencies'
import { Thumbnail } from './Thumbnail'

interface ItemRow {
  key: string
  productID: string
  detailID: string | null
  qty: string
  price: string
}
interface CostRow { CostName: string; Amount: string; CurrencyCode: string }

interface Props {
  order?: OrderWithCalc | null
  products: Product[]
  platforms: Platform[]
  details: ProductDetail[]
  categoryName: (id: string) => string
  prefillProductID?: string | null
  // When true the form fills a dedicated OS window: no drag/positioning, products
  // arrive via cross-window IPC, and a successful save keeps the window open.
  windowMode?: boolean
  onSubmit: (input: CreateOrderInput) => Promise<void>
  onClose: () => void
}

let rowSeq = 0
const newKey = () => `r${rowSeq++}`

export function OrderFormModal({ order, products, platforms, details, categoryName, prefillProductID, windowMode, onSubmit, onClose }: Props) {
  const isEdit = !!order
  const { currencies, load: loadCurrencies } = useCurrencies()
  const [platformID, setPlatformID] = useState(order?.PlatformID ?? platforms[0]?.PlatformID ?? '')
  const [date, setDate] = useState((order?.DateRecorded ?? new Date().toISOString()).slice(0, 10))
  const [note, setNote] = useState(order?.Note ?? '')
  const [items, setItems] = useState<ItemRow[]>([])
  const [costs, setCosts] = useState<CostRow[]>([])
  const [search, setSearch] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => { loadCurrencies() }, [loadCurrencies])
  // If reference data arrives after the panel opened (global host), default the platform.
  useEffect(() => {
    if (!platformID && platforms.length) setPlatformID(platforms[0].PlatformID)
  }, [platforms, platformID])

  const productById = useMemo(() => new Map(products.map((p) => [p.ProductID, p])), [products])
  const detailsFor = (productID: string) => details.filter((d) => d.ProductID === productID)
  const detailById = useMemo(() => new Map(details.map((d) => [d.DetailID, d])), [details])

  // Seed item rows from an existing order (edit mode).
  useEffect(() => {
    if (!order) return
    setItems(order.items.map((i) => ({
      key: newKey(), productID: i.ProductID, detailID: i.DetailID,
      qty: String(i.SalesVolume), price: String(i.SellingPrice)
    })))
    setCosts(order.extraCosts.map((c) => ({ CostName: c.CostName, Amount: String(c.Amount), CurrencyCode: c.CurrencyCode })))
  }, [order])

  // Quick-sell prefill: add the chosen product once details have loaded (so a
  // product with variants gets its first detail + price filled in correctly).
  const seeded = useRef(false)
  useEffect(() => {
    if (order || !prefillProductID || seeded.current) return
    if (!productById.has(prefillProductID)) return
    seeded.current = true
    addProduct(prefillProductID)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, prefillProductID, productById, details])

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  // ── Floating draggable panel (non-modal, so the inventory stays usable) ──
  const [pos, setPos] = useState(() => ({ x: Math.max(16, window.innerWidth - 660), y: 72 }))
  const dragRef = useRef<{ dx: number; dy: number } | null>(null)
  const startDrag = (e: React.MouseEvent) => {
    dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y }
    const move = (ev: MouseEvent) => {
      if (!dragRef.current) return
      // Allow pushing the panel well past the edges (only keep ~100px reachable so
      // it can always be grabbed back); the header row stays on-screen vertically.
      const PANEL_W = 620
      setPos({
        x: Math.min(Math.max(-(PANEL_W - 100), ev.clientX - dragRef.current.dx), window.innerWidth - 100),
        y: Math.min(Math.max(0, ev.clientY - dragRef.current.dy), window.innerHeight - 40)
      })
    }
    const up = () => { dragRef.current = null; window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  // Accept products dragged in from the inventory table.
  const [dropHint, setDropHint] = useState(false)
  const onPanelDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('text/sims-product')) { e.preventDefault(); setDropHint(true) }
  }
  const onPanelDrop = (e: React.DragEvent) => {
    const pid = e.dataTransfer.getData('text/sims-product')
    setDropHint(false)
    if (pid && productById.has(pid)) { e.preventDefault(); addProduct(pid) }
  }

  function addProduct(productID: string): void {
    const ds = detailsFor(productID)
    const firstDetail = ds[0]
    setItems((prev) => [...prev, {
      key: newKey(), productID,
      detailID: firstDetail?.DetailID ?? null,
      qty: '1',
      price: firstDetail ? String(firstDetail.SellingPrice || '') : ''
    }])
    setSearch(''); setPickerOpen(false)
  }

  const patchItem = (key: string, patch: Partial<ItemRow>) =>
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)))
  const removeItem = (key: string) => setItems((prev) => prev.filter((it) => it.key !== key))

  // In a dedicated window, products dragged from the main window arrive via IPC
  // (HTML5 drag can't cross OS windows); the main process also drives the hover
  // highlight. A ref keeps the subscription pointed at the latest addProduct.
  const addProductRef = useRef(addProduct)
  addProductRef.current = addProduct
  useEffect(() => {
    if (!windowMode) return
    const offAdd = window.api.window.onOrderAddProduct((pid) => addProductRef.current(pid))
    const offHover = window.api.window.onOrderHover((h) => setDropHint(h))
    return () => { offAdd(); offHover() }
  }, [windowMode])

  const patchCost = (i: number, patch: Partial<CostRow>) => setCosts((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)))
  const addCost = () => setCosts((prev) => [...prev, { CostName: '', Amount: '', CurrencyCode: currencies[0]?.CurrencyCode ?? 'TWD' }])
  const removeCost = (i: number) => setCosts((prev) => prev.filter((_, idx) => idx !== i))

  // Searchable / filterable product picker (matches id, image, category, detail name).
  // Capped at 12 so opening the box never renders dozens of thumbnails at once
  // (each thumbnail loads via IPC, which made typing lag while the list rendered).
  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase()
    const base = !q ? products : products.filter((p) =>
      p.ProductID.toLowerCase().includes(q)
      || (p.ImageKey ?? '').toLowerCase().includes(q)
      || categoryName(p.CategoryID).toLowerCase().includes(q)
      || detailsFor(p.ProductID).some((d) => d.DetailName.toLowerCase().includes(q))
    )
    return base.slice(0, 12)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, products, details])

  const rateOf = (code: string) => currencies.find((c) => c.CurrencyCode === code)?.RateToTWD ?? 1
  const totalExtra = costs.reduce((s, c) => s + (parseFloat(c.Amount) || 0) * rateOf(c.CurrencyCode), 0)
  const grossRevenue = items.reduce((s, it) => s + (parseFloat(it.price) || 0) * (parseInt(it.qty) || 0), 0)

  const handleSubmit = async () => {
    if (!platformID) { setError('請選擇平台'); return }
    const built = items
      .filter((it) => it.productID && (parseInt(it.qty) || 0) > 0)
      .map((it) => ({
        productID: it.productID,
        detailID: it.detailID,
        sellingPrice: parseFloat(it.price) || 0,
        quantity: parseInt(it.qty) || 0
      }))
    if (built.length === 0) { setError('請至少加入一個銷售商品並填入數量'); return }
    const extraCosts = costs
      .filter((c) => c.Amount !== '' || c.CostName.trim())
      .map((c) => ({ CostName: c.CostName.trim(), Amount: parseFloat(c.Amount) || 0, CurrencyCode: c.CurrencyCode }))
    setSaving(true); setError(null); setSuccess(null)
    try {
      await onSubmit({ platformID, date: new Date(date).toISOString(), note: note.trim(), items: built, extraCosts })
      if (windowMode) {
        // Keep the window open for the next entry; just clear the line items.
        setItems([]); setCosts([]); setNote('')
        setSuccess('已建立銷售紀錄 ✓')
        window.setTimeout(() => setSuccess(null), 2500)
      } else {
        onClose()
      }
    } catch (e) {
      setError(String(e).replace(/^Error:\s*/, ''))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className={
        windowMode
          ? `fixed inset-0 flex flex-col bg-white dark:bg-gray-800 ${dropHint ? 'ring-4 ring-inset ring-indigo-400' : ''}`
          : `fixed z-50 w-[620px] max-h-[88vh] flex flex-col rounded-xl border bg-white dark:bg-gray-800 shadow-2xl
             ${dropHint ? 'border-indigo-500 ring-2 ring-indigo-400' : 'border-gray-200 dark:border-gray-700'}`
      }
      style={windowMode ? undefined : { left: pos.x, top: pos.y }}
      onDragOver={onPanelDragOver}
      onDragLeave={() => setDropHint(false)}
      onDrop={onPanelDrop}
    >
      {/* Header (drag handle only in the in-app floating variant) */}
      <div onMouseDown={windowMode ? undefined : startDrag}
        className={`flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700 select-none bg-gray-50 dark:bg-gray-900/40
          ${windowMode ? '' : 'cursor-move rounded-t-xl'}`}>
        <h2 className="text-base font-semibold flex items-center gap-2"><ShoppingCart size={16} /> {isEdit ? '編輯銷售紀錄' : '新增銷售紀錄'}</h2>
        <button onMouseDown={(e) => e.stopPropagation()} onClick={onClose} className="btn-ghost p-1"><X size={16} /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="mb-3 text-xs text-indigo-500 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg px-3 py-1.5">
          {windowMode
            ? '這是獨立視窗：可移到程式視窗外、放到第二螢幕，主程式縮小也不會消失。從主視窗的庫存列表把商品拖進來會自動加入。'
            : '可拖曳此視窗移動；也可從庫存列表直接把商品拖進來自動加入。'}
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>}
        {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg dark:bg-green-500/10 dark:border-green-500/30 dark:text-green-300">{success}</div>}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">平台</label>
              <select className="input" value={platformID} onChange={(e) => setPlatformID(e.target.value)}>
                {platforms.map((p) => <option key={p.PlatformID} value={p.PlatformID}>{p.PlatformName}</option>)}
              </select>
            </div>
            <div>
              <label className="label">日期</label>
              <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          {/* Sold items */}
          <div>
            <label className="label">銷售商品</label>
            <div className="relative" ref={pickerRef}>
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input className="input pl-8" placeholder="搜尋商品編號 / 圖名 / 分類 / 細項…加入訂單"
                value={search} onFocus={() => setPickerOpen(true)} onChange={(e) => { setSearch(e.target.value); setPickerOpen(true) }} />
              {pickerOpen && (
                <div className="absolute z-10 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:bg-gray-800 dark:border-gray-700">
                  {filteredProducts.length === 0 ? (
                    <p className="p-3 text-xs text-gray-400">查無商品</p>
                  ) : filteredProducts.map((p) => (
                    <button key={p.ProductID} onClick={() => addProduct(p.ProductID)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-indigo-50 dark:hover:bg-gray-700">
                      <Thumbnail path={p.ImagePath} size={28} />
                      <span className="font-mono text-indigo-700 dark:text-indigo-300">{p.ProductID}</span>
                      <span className="text-xs text-gray-400">{categoryName(p.CategoryID)}</span>
                      {detailsFor(p.ProductID).length > 0 && <span className="text-[10px] text-gray-400 ml-auto">{detailsFor(p.ProductID).length} 細項</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-2 space-y-2">
              {items.length === 0 && <p className="text-xs text-gray-400">尚未加入商品。用上方搜尋加入。</p>}
              {items.map((it) => {
                const p = productById.get(it.productID)
                const ds = detailsFor(it.productID)
                const detail = it.detailID ? detailById.get(it.detailID) : undefined
                return (
                  <div key={it.key} className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 p-2">
                    <Thumbnail path={detail?.ImagePath ?? p?.ImagePath ?? null} size={36} />
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-xs text-indigo-700 dark:text-indigo-300">{it.productID}</p>
                      {ds.length > 0 ? (
                        <select className="input !py-0.5 text-xs mt-0.5" value={it.detailID ?? ''}
                          onChange={(e) => { const d = detailById.get(e.target.value); patchItem(it.key, { detailID: e.target.value, price: d ? String(d.SellingPrice || '') : it.price }) }}>
                          {ds.map((d) => <option key={d.DetailID} value={d.DetailID}>{d.DetailName}</option>)}
                        </select>
                      ) : <p className="text-[10px] text-gray-400">無細項</p>}
                    </div>
                    <div className="w-16">
                      <label className="label !text-[10px] !mb-0.5">數量</label>
                      <input className="input !py-1 text-xs" type="number" min="1" value={it.qty} onChange={(e) => patchItem(it.key, { qty: e.target.value })} />
                    </div>
                    <div className="w-24">
                      <label className="label !text-[10px] !mb-0.5">售價 NT$</label>
                      <input className="input !py-1 text-xs" type="number" min="0" value={it.price} onChange={(e) => patchItem(it.key, { price: e.target.value })} />
                    </div>
                    <button onClick={() => removeItem(it.key)} className="btn-ghost p-1 hover:text-red-600 self-end mb-1"><Trash2 size={13} /></button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Order-specific extra costs */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label !mb-0">專屬成本（如代客運費，換算後 NT${totalExtra.toFixed(0)}）</label>
              <button type="button" onClick={addCost} className="text-xs text-indigo-600 hover:underline flex items-center gap-0.5"><Plus size={11} /> 新增成本</button>
            </div>
            <div className="space-y-1.5">
              {costs.length === 0 && <p className="text-xs text-gray-400">無專屬成本。</p>}
              {costs.map((cost, i) => (
                <div key={i} className="grid grid-cols-[1fr_110px_90px_auto] gap-2">
                  <input className="input !py-1 text-xs" value={cost.CostName} onChange={(e) => patchCost(i, { CostName: e.target.value })} placeholder="名稱（如 運費）" />
                  <input className="input !py-1 text-xs" type="number" min="0" step="0.01" value={cost.Amount} onChange={(e) => patchCost(i, { Amount: e.target.value })} placeholder="金額" />
                  <select className="input !py-1 text-xs" value={cost.CurrencyCode} onChange={(e) => patchCost(i, { CurrencyCode: e.target.value })}>
                    {currencies.map((c: Currency) => <option key={c.CurrencyCode} value={c.CurrencyCode}>{c.CurrencyCode}</option>)}
                  </select>
                  <button onClick={() => removeCost(i)} className="btn-ghost p-1 hover:text-red-600"><Trash2 size={12} /></button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="label">備註（選填）</label>
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="訂單備註" />
          </div>

          <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg text-xs text-indigo-700 dark:text-indigo-300">
            營業額 NT${grossRevenue.toFixed(0)}　專屬成本 NT${totalExtra.toFixed(0)}
          </div>
        </div>

        <div className="flex gap-3 justify-end mt-6">
          <button onClick={onClose} className="btn-secondary">取消</button>
          <button onClick={handleSubmit} disabled={saving} className="btn-primary">{saving ? '儲存中…' : (isEdit ? '儲存變更' : '建立訂單')}</button>
        </div>
      </div>
    </div>
  )
}
