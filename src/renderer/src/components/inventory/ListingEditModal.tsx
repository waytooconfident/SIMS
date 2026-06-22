import { useState } from 'react'
import { X } from 'lucide-react'

interface ListingEditModalProps {
  productID: string
  platformID: string
  platformName: string
  title: string
  description: string
  onSave: (productID: string, platformID: string, title: string, description: string) => Promise<void>
  onClose: () => void
}

// Edits the title/description of a product's listing on one platform.
export function ListingEditModal({ productID, platformID, platformName, title, description, onSave, onClose }: ListingEditModalProps) {
  const [t, setT] = useState(title === '-' ? '' : title)
  const [d, setD] = useState(description === '-' ? '' : description)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    setSaving(true)
    try {
      await onSave(productID, platformID, t.trim() || '-', d.trim() || '-')
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="card w-[460px] p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold">編輯平台標題 / 介紹</h2>
          <button onClick={onClose} className="btn-ghost p-1"><X size={16} /></button>
        </div>
        <div className="mb-4 p-2 bg-indigo-50 rounded-lg text-xs text-indigo-700">{productID} · {platformName}</div>
        <div className="space-y-4">
          <div>
            <label className="label">平台標題</label>
            <input className="input" value={t} onChange={(e) => setT(e.target.value)} placeholder="此商品在該平台的標題" />
          </div>
          <div>
            <label className="label">商品介紹</label>
            <textarea className="input resize-none h-24" value={d} onChange={(e) => setD(e.target.value)} placeholder="此商品在該平台的介紹" />
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
