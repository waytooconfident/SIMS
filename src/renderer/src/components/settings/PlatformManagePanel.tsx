import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, X, Save, ChevronDown, ChevronRight } from 'lucide-react'
import type { Platform, PlatformFee, FeeType } from '@shared/types'
import { usePlatforms } from '../../hooks/usePlatforms'

const unit = (t: FeeType) => (t === 'fixed' ? 'NT$' : '%')

export function PlatformManagePanel() {
  const { platforms, load, create, update, remove, formatFee } = usePlatforms()
  const [expanded, setExpanded] = useState<string | null>(null)
  const [editing, setEditing] = useState<Platform | null>(null)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Per-platform "add fee" draft (type picks 抽成% vs 固定費用).
  const [feeDraft, setFeeDraft] = useState<{ name: string; value: string; type: FeeType }>({ name: '', value: '', type: 'percent' })
  const [feeEditing, setFeeEditing] = useState<PlatformFee | null>(null)

  useEffect(() => { load() }, [load])

  const openEdit = (p: Platform) => { setEditing(p); setCreating(false); setName(p.PlatformName); setExpanded(p.PlatformID); setError(null) }
  const openCreate = () => { setCreating(true); setEditing(null); setName(''); setError(null) }
  const cancel = () => { setEditing(null); setCreating(false); setError(null) }

  const handleSave = async () => {
    if (!name.trim()) { setError('平台名稱不能為空'); return }
    try {
      if (creating) await create({ PlatformName: name.trim() })
      else if (editing) await update(editing.PlatformID, { PlatformName: name.trim() })
      cancel()
    } catch (e) { setError(String(e)) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('確定刪除此平台？相關抽成項目與銷售紀錄也將一併刪除。')) return
    await remove(id)
  }

  // ─── Fee line-items (percent or fixed) ───────────────────────────────────────
  const addFee = async (platformID: string) => {
    if (!feeDraft.name.trim()) return
    await window.api.platformFees.create({
      PlatformID: platformID,
      FeeName: feeDraft.name.trim(),
      FeePercentage: parseFloat(feeDraft.value) || 0,
      FeeType: feeDraft.type
    })
    setFeeDraft({ name: '', value: '', type: 'percent' })
    await load()
  }
  const saveFeeEdit = async () => {
    if (!feeEditing) return
    await window.api.platformFees.update(feeEditing.FeeID, {
      FeeName: feeEditing.FeeName.trim() || '-',
      FeePercentage: feeEditing.FeePercentage,
      FeeType: feeEditing.FeeType
    })
    setFeeEditing(null)
    await load()
  }
  const deleteFee = async (feeID: string) => { await window.api.platformFees.delete(feeID); await load() }

  return (
    <div className="card p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">平台管理（含抽成細項 / 固定費用）</h3>
        <button onClick={openCreate} className="btn-primary text-xs"><Plus size={13} /> 新增平台</button>
      </div>

      {(creating || editing) && (
        <div className="mb-4 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
          {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="label">平台名稱</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="蝦皮" />
            </div>
            <button onClick={cancel} className="btn-secondary text-xs"><X size={12} /> 取消</button>
            <button onClick={handleSave} className="btn-primary text-xs"><Save size={12} /> 儲存</button>
          </div>
          <p className="text-xs text-gray-400 mt-2">儲存後展開平台即可新增抽成% 或 固定費用 細項。</p>
        </div>
      )}

      <div className="space-y-2">
        {platforms.map((p) => {
          const isOpen = expanded === p.PlatformID
          return (
            <div key={p.PlatformID} className="border border-gray-200 rounded-lg overflow-hidden">
              <div
                className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 cursor-pointer hover:bg-gray-100"
                onClick={() => setExpanded(isOpen ? null : p.PlatformID)}
              >
                <span className="text-gray-400">{isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</span>
                <span className="font-medium flex-1">{p.PlatformName}</span>
                <span className="badge badge-blue">總費用 {formatFee(p)}</span>
                <button onClick={(e) => { e.stopPropagation(); openEdit(p) }} className="btn-ghost p-1.5"><Pencil size={13} /></button>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(p.PlatformID) }} className="btn-ghost p-1.5 hover:text-red-600"><Trash2 size={13} /></button>
              </div>

              {isOpen && (
                <div className="p-3 border-t border-gray-200">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">費用細項</p>
                  <table className="w-full text-sm mb-3">
                    <tbody>
                      {(p.fees ?? []).length === 0 && (
                        <tr><td className="py-1.5 text-xs text-gray-400">尚無細項</td></tr>
                      )}
                      {(p.fees ?? []).map((f) => (
                        <tr key={f.FeeID} className="border-b border-gray-100">
                          {feeEditing?.FeeID === f.FeeID ? (
                            <>
                              <td className="py-1.5 pr-2">
                                <input className="input !py-1 text-xs" value={feeEditing.FeeName}
                                       onChange={(e) => setFeeEditing({ ...feeEditing, FeeName: e.target.value })} />
                              </td>
                              <td className="py-1.5 pr-2 w-28">
                                <select className="input !py-1 text-xs" value={feeEditing.FeeType}
                                        onChange={(e) => setFeeEditing({ ...feeEditing, FeeType: e.target.value as FeeType })}>
                                  <option value="percent">抽成 %</option>
                                  <option value="fixed">固定 NT$</option>
                                </select>
                              </td>
                              <td className="py-1.5 pr-2 w-20">
                                <input className="input !py-1 text-xs" type="number" step="0.1" value={feeEditing.FeePercentage}
                                       onChange={(e) => setFeeEditing({ ...feeEditing, FeePercentage: parseFloat(e.target.value) || 0 })} />
                              </td>
                              <td className="py-1.5 text-right">
                                <button onClick={saveFeeEdit} className="btn-ghost p-1"><Save size={12} /></button>
                                <button onClick={() => setFeeEditing(null)} className="btn-ghost p-1"><X size={12} /></button>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="py-1.5">{f.FeeName}</td>
                              <td className="py-1.5 w-28 text-xs text-gray-500">{f.FeeType === 'fixed' ? '固定費用' : '抽成'}</td>
                              <td className="py-1.5 w-20 font-medium">{f.FeeType === 'fixed' ? `NT$${f.FeePercentage}` : `${f.FeePercentage}%`}</td>
                              <td className="py-1.5 text-right">
                                <button onClick={() => setFeeEditing(f)} className="btn-ghost p-1"><Pencil size={12} /></button>
                                <button onClick={() => deleteFee(f.FeeID)} className="btn-ghost p-1 hover:text-red-600"><Trash2 size={12} /></button>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                      <tr className="border-t border-gray-200 font-semibold text-indigo-700">
                        <td className="py-1.5" colSpan={2}>平台總費用</td>
                        <td className="py-1.5" colSpan={2}>{formatFee(p)}</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Add fee item — pick 抽成% or 固定費用 */}
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <label className="label">項目名稱</label>
                      <input className="input !py-1 text-xs" value={feeDraft.name}
                             onChange={(e) => setFeeDraft((d) => ({ ...d, name: e.target.value }))} placeholder="成交手續費 / 金流費" />
                    </div>
                    <div className="w-28">
                      <label className="label">類型</label>
                      <select className="input !py-1 text-xs" value={feeDraft.type}
                              onChange={(e) => setFeeDraft((d) => ({ ...d, type: e.target.value as FeeType }))}>
                        <option value="percent">抽成 %</option>
                        <option value="fixed">固定費用 NT$</option>
                      </select>
                    </div>
                    <div className="w-20">
                      <label className="label">{unit(feeDraft.type)}</label>
                      <input className="input !py-1 text-xs" type="number" step="0.1" value={feeDraft.value}
                             onChange={(e) => setFeeDraft((d) => ({ ...d, value: e.target.value }))} placeholder={feeDraft.type === 'fixed' ? '10' : '2'} />
                    </div>
                    <button onClick={() => addFee(p.PlatformID)} className="btn-primary text-xs"><Plus size={12} /> 新增</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
