import { useState, useEffect } from 'react'
import { X, ImagePlus, Link2, AlertTriangle, Boxes } from 'lucide-react'
import type {
  Product, Category, Platform, MappingWithCalc, CreateProductInput, UpdateProductInput
} from '@shared/types'
import { DetailsManagerModal } from './DetailsManagerModal'

export interface PlatformBinding {
  platformID: string
  price: number
  volume: number
  title: string
  desc: string
}

interface ProductFormModalProps {
  product?: Product | null
  categories: Category[]
  platforms: Platform[]
  productMappings?: MappingWithCalc[]   // this product's current records (edit mode)
  onSave: (input: CreateProductInput | UpdateProductInput, additions: PlatformBinding[], removals: string[]) => Promise<void>
  onClose: () => void
  onDetailsChanged?: () => void         // called after the 細項 manager saves
}

const baseName = (p: string) => p.split(/[\\/]/).pop() ?? p
const dirName = (p: string) => {
  const i = Math.max(p.lastIndexOf('\\'), p.lastIndexOf('/'))
  return i >= 0 ? p.slice(0, i) : ''
}

type BindState = { listed: boolean; checked: boolean; price: string; volume: string; title: string; desc: string }

export function ProductFormModal({ product, categories, platforms, productMappings = [], onSave, onClose, onDetailsChanged }: ProductFormModalProps) {
  const isEdit = !!product
  const [showDetails, setShowDetails] = useState(false)

  const [form, setForm] = useState({
    CategoryID: '000', ImageKey: '', ImagePath: '', Cost_RMB: '', CompetitorPrice: '', StockQuantity: '', LocalFolderPath: ''
  })
  const [preview, setPreview] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [binds, setBinds] = useState<Record<string, BindState>>({})
  const [removalWarn, setRemovalWarn] = useState<{ platformID: string; platformName: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (product) {
      setForm({
        CategoryID: product.CategoryID,
        ImageKey: product.ImageKey ?? '',
        ImagePath: product.ImagePath ?? '',
        Cost_RMB: String(product.Cost_RMB),
        CompetitorPrice: product.CompetitorPrice != null ? String(product.CompetitorPrice) : '',
        StockQuantity: String(product.StockQuantity),
        LocalFolderPath: product.LocalFolderPath ?? ''
      })
    }
  }, [product])

  // Seed binding state: platforms the product is already listed on are checked.
  useEffect(() => {
    const listed = new Set(productMappings.map((m) => m.PlatformID))
    const next: Record<string, BindState> = {}
    for (const p of platforms) {
      const isListed = listed.has(p.PlatformID)
      next[p.PlatformID] = { listed: isListed, checked: isListed, price: '', volume: '', title: '', desc: '' }
    }
    setBinds(next)
  }, [platforms, productMappings])

  useEffect(() => {
    let alive = true
    if (form.ImagePath) window.api.images.getDataUrl(form.ImagePath).then((u) => { if (alive) setPreview(u) })
    else setPreview(null)
    return () => { alive = false }
  }, [form.ImagePath])

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    const path = window.api.files.getPathForFile(file)
    if (!path) { setError('無法取得檔案路徑'); return }
    setForm((f) => ({ ...f, ImageKey: baseName(path), ImagePath: path, LocalFolderPath: f.LocalFolderPath || dirName(path) }))
  }

  const recordsFor = (platformID: string) => productMappings.filter((m) => m.PlatformID === platformID)
  const hasSales = (platformID: string) => recordsFor(platformID).some((m) => m.SalesVolume > 0)

  const toggleBind = (platformID: string) => {
    const b = binds[platformID]
    if (!b) return
    // Unchecking a listed platform that has sales history → warn first.
    if (b.checked && b.listed && hasSales(platformID)) {
      const platformName = platforms.find((p) => p.PlatformID === platformID)?.PlatformName ?? platformID
      setRemovalWarn({ platformID, platformName })
      return
    }
    setBinds((prev) => ({ ...prev, [platformID]: { ...b, checked: !b.checked } }))
  }
  const confirmRemoval = () => {
    if (!removalWarn) return
    setBinds((prev) => ({ ...prev, [removalWarn.platformID]: { ...prev[removalWarn.platformID], checked: false } }))
    setRemovalWarn(null)
  }
  const setBindField = (platformID: string, field: keyof BindState, value: string) =>
    setBinds((prev) => ({ ...prev, [platformID]: { ...prev[platformID], [field]: value } }))

  const handleSubmit = async () => {
    setSaving(true); setError(null)
    try {
      const payload = {
        CategoryID: form.CategoryID,
        ImageKey: form.ImageKey.trim() || null,
        ImagePath: form.ImagePath.trim() || null,
        Cost_RMB: parseFloat(form.Cost_RMB) || 0,
        CompetitorPrice: form.CompetitorPrice ? parseFloat(form.CompetitorPrice) : null,
        StockQuantity: parseInt(form.StockQuantity) || 0,
        LocalFolderPath: form.LocalFolderPath.trim() || null
      }
      // additions = checked but not previously listed; removals = listed but now unchecked.
      const additions: PlatformBinding[] = Object.entries(binds)
        .filter(([, b]) => b.checked && !b.listed)
        .map(([platformID, b]) => ({
          platformID, price: parseFloat(b.price) || 0, volume: parseInt(b.volume) || 0,
          title: b.title.trim() || '-', desc: b.desc.trim() || '-'
        }))
      const removals = Object.entries(binds).filter(([, b]) => b.listed && !b.checked).map(([id]) => id)
      await onSave(payload, additions, removals)
      onClose()
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="card w-[560px] max-h-[92vh] overflow-y-auto p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold">{isEdit ? `編輯商品 ${product!.ProductID}` : '新增商品'}</h2>
          <button onClick={onClose} className="btn-ghost p-1"><X size={16} /></button>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>}

        <div className="space-y-4">
          {/* Drag-drop first image */}
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

          {/* Product details (變體) — only once the product exists (needs a ProductID). */}
          {isEdit ? (
            <button type="button" onClick={() => setShowDetails(true)}
              className="btn-secondary w-full justify-center border-dashed">
              <Boxes size={15} /> 管理 / 新增商品細項
            </button>
          ) : (
            <p className="text-xs text-gray-400">＊先建立商品後，再次編輯即可新增「商品細項」。</p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">RMB 成本 (¥)</label><input className="input" type="number" min="0" step="0.01" value={form.Cost_RMB} onChange={(e) => set('Cost_RMB', e.target.value)} placeholder="0.00" /></div>
            <div><label className="label">競品大約價格 (NT$)</label><input className="input" type="number" min="0" step="1" value={form.CompetitorPrice} onChange={(e) => set('CompetitorPrice', e.target.value)} placeholder="選填" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">庫存量 (件)</label><input className="input" type="number" min="0" value={form.StockQuantity} onChange={(e) => set('StockQuantity', e.target.value)} placeholder="0" /></div>
            <div><label className="label">本機資料夾路徑</label><input className="input" value={form.LocalFolderPath} onChange={(e) => set('LocalFolderPath', e.target.value)} placeholder="自動帶入" /></div>
          </div>

          {/* Platform binding (create & edit) */}
          <div>
            <label className="label flex items-center gap-1"><Link2 size={13} /> 上架平台（勾選=上架；新勾選可填入該平台資料，取消則下架）</label>
            <div className="space-y-2 rounded-lg border border-gray-200 p-3 bg-gray-50">
              {platforms.length === 0 && <p className="text-xs text-gray-400">尚無平台，請先於系統設定新增。</p>}
              {platforms.map((p) => {
                const b = binds[p.PlatformID]
                if (!b) return null
                const isNewlyChecked = b.checked && !b.listed
                return (
                  <div key={p.PlatformID} className="text-sm">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={b.checked} onChange={() => toggleBind(p.PlatformID)} />
                      <span className="w-24">{p.PlatformName}</span>
                      {b.listed && <span className="text-xs text-gray-400">已上架（{recordsFor(p.PlatformID).length} 筆紀錄）</span>}
                    </label>
                    {isNewlyChecked && (
                      <div className="mt-1.5 ml-6 grid grid-cols-2 gap-2">
                        <input className="input !py-1 text-xs" placeholder="售價 NT$（選填）" type="number" min="0" value={b.price} onChange={(e) => setBindField(p.PlatformID, 'price', e.target.value)} />
                        <input className="input !py-1 text-xs" placeholder="銷售量（選填，0=尚未售出）" type="number" min="0" value={b.volume} onChange={(e) => setBindField(p.PlatformID, 'volume', e.target.value)} />
                        <input className="input !py-1 text-xs col-span-2" placeholder="平台標題（選填）" value={b.title} onChange={(e) => setBindField(p.PlatformID, 'title', e.target.value)} />
                        <input className="input !py-1 text-xs col-span-2" placeholder="平台介紹（選填）" value={b.desc} onChange={(e) => setBindField(p.PlatformID, 'desc', e.target.value)} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-end mt-6">
          <button onClick={onClose} className="btn-secondary">取消</button>
          <button onClick={handleSubmit} disabled={saving} className="btn-primary">{saving ? '儲存中…' : '儲存'}</button>
        </div>
      </div>

      {/* Product-details manager (stacked above this modal) */}
      {showDetails && product && (
        <DetailsManagerModal
          product={product}
          onClose={() => setShowDetails(false)}
          onSaved={() => onDetailsChanged?.()}
        />
      )}

      {/* Remove-with-history warning */}
      {removalWarn && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]" onClick={(e) => { e.stopPropagation(); setRemovalWarn(null) }}>
          <div className="card w-[460px] p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3 text-amber-600">
              <AlertTriangle size={18} />
              <h3 className="font-semibold">確認下架「{removalWarn.platformName}」？</h3>
            </div>
            <p className="text-sm text-gray-600 mb-3">此平台已有銷售紀錄，下架將<strong>刪除以下全部紀錄</strong>（最多列出 10 筆）：</p>
            <div className="max-h-52 overflow-y-auto border border-gray-200 rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-500"><tr><th className="text-left py-1.5 px-2">日期</th><th className="text-left py-1.5 px-2">售價</th><th className="text-left py-1.5 px-2">銷售量</th></tr></thead>
                <tbody>
                  {recordsFor(removalWarn.platformID).slice(0, 10).map((m) => (
                    <tr key={m.MappingID} className="border-t border-gray-100">
                      <td className="py-1.5 px-2">{m.DateRecorded.slice(0, 10)}</td>
                      <td className="py-1.5 px-2">NT${m.SellingPrice}</td>
                      <td className="py-1.5 px-2">{m.SalesVolume}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400 mt-2">共 {recordsFor(removalWarn.platformID).length} 筆。下架後按「儲存」才會正式刪除。</p>
            <div className="flex gap-3 justify-end mt-5">
              <button onClick={() => setRemovalWarn(null)} className="btn-secondary">取消</button>
              <button onClick={confirmRemoval} className="btn bg-amber-600 text-white hover:bg-amber-700">確認下架</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
