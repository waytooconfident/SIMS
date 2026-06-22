import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import type { MappingWithCalc, UpdateMappingInput } from '@shared/types'

// Edits a single sales record (date / price / volume). Title & description are
// edited at the listing level, not per record.
interface MappingFormModalProps {
  mapping: MappingWithCalc
  onSave: (input: UpdateMappingInput, mappingID: string) => Promise<void>
  onClose: () => void
}

export function MappingFormModal({ mapping, onSave, onClose }: MappingFormModalProps) {
  const [form, setForm] = useState({
    SellingPrice: String(mapping.SellingPrice),
    SalesVolume: String(mapping.SalesVolume),
    DateRecorded: mapping.DateRecorded.slice(0, 10)
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setForm({
      SellingPrice: String(mapping.SellingPrice),
      SalesVolume: String(mapping.SalesVolume),
      DateRecorded: mapping.DateRecorded.slice(0, 10)
    })
  }, [mapping])

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    setSaving(true)
    setError(null)
    try {
      await onSave(
        {
          SellingPrice: parseFloat(form.SellingPrice) || 0,
          SalesVolume: parseInt(form.SalesVolume) || 0,
          DateRecorded: new Date(form.DateRecorded).toISOString()
        },
        mapping.MappingID
      )
      onClose()
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="card w-[420px] p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold">編輯銷售紀錄</h2>
          <button onClick={onClose} className="btn-ghost p-1"><X size={16} /></button>
        </div>

        <div className="mb-4 p-2 bg-indigo-50 rounded-lg text-xs text-indigo-700">
          {mapping.ProductID} · {mapping.PlatformName}
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>}

        <div className="space-y-4">
          <div>
            <label className="label">紀錄日期</label>
            <input className="input" type="date" value={form.DateRecorded} onChange={(e) => set('DateRecorded', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">售價 (NT$)</label>
              <input className="input" type="number" min="0" value={form.SellingPrice} onChange={(e) => set('SellingPrice', e.target.value)} />
            </div>
            <div>
              <label className="label">銷售量 (件)</label>
              <input className="input" type="number" min="0" value={form.SalesVolume} onChange={(e) => set('SalesVolume', e.target.value)} />
            </div>
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
