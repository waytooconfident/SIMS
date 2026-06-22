import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, X, Save, Coins } from 'lucide-react'
import type { Currency } from '@shared/types'
import { useCurrencies } from '../../hooks/useCurrencies'

// Manage currencies and their NT$ exchange rate. 'TWD' is the protected base.
export function CurrencyManagePanel() {
  const { currencies, load, create, update, remove } = useCurrencies()
  const [editing, setEditing] = useState<Currency | null>(null)
  const [creating, setCreating] = useState(false)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [rate, setRate] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { load() }, [load])

  const openCreate = () => { setCreating(true); setEditing(null); setCode(''); setName(''); setRate(''); setError(null) }
  const openEdit = (c: Currency) => { setEditing(c); setCreating(false); setCode(c.CurrencyCode); setName(c.CurrencyName); setRate(String(c.RateToTWD)); setError(null) }
  const cancel = () => { setEditing(null); setCreating(false); setError(null) }

  const handleSave = async () => {
    const r = parseFloat(rate)
    if (!name.trim()) { setError('幣別名稱不能為空'); return }
    if (isNaN(r) || r <= 0) { setError('匯率必須大於 0'); return }
    try {
      if (creating) {
        if (!code.trim()) { setError('幣別代碼不能為空'); return }
        await create({ CurrencyCode: code.trim().toUpperCase(), CurrencyName: name.trim(), RateToTWD: r })
      } else if (editing) {
        await update(editing.CurrencyCode, { CurrencyName: name.trim(), RateToTWD: r })
      }
      cancel()
    } catch (e) { setError(String(e).replace(/^Error:\s*/, '')) }
  }

  const handleDelete = async (c: Currency) => {
    if (c.CurrencyCode === 'TWD') { alert('「新台幣」為基準幣別，無法刪除。'); return }
    if (!confirm(`刪除幣別「${c.CurrencyName} (${c.CurrencyCode})」？`)) return
    try { await remove(c.CurrencyCode) } catch (e) { alert(String(e).replace(/^Error:\s*/, '')) }
  }

  return (
    <div className="card p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Coins size={16} className="text-indigo-600" />
          <h3 className="font-semibold">幣別與匯率</h3>
        </div>
        <button onClick={openCreate} className="btn-primary text-xs"><Plus size={13} /> 新增幣別</button>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        每個幣別記錄「1 單位 = 多少新台幣」。商品細項的成本可選擇幣別，系統會依此匯率換算為 NT$ 計算利潤。
      </p>

      {(creating || editing) && (
        <div className="mb-4 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
          {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
          <div className="grid grid-cols-[100px_1fr_140px_auto_auto] gap-3 items-end">
            <div>
              <label className="label">代碼</label>
              <input className="input uppercase" value={code} disabled={!creating} onChange={(e) => setCode(e.target.value)} placeholder="USD" maxLength={6} />
            </div>
            <div>
              <label className="label">名稱</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="美元" />
            </div>
            <div>
              <label className="label">1 單位 = ? NT$</label>
              <input className="input" type="number" min="0" step="0.0001" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="32" />
            </div>
            <button onClick={cancel} className="btn-secondary text-xs"><X size={12} /> 取消</button>
            <button onClick={handleSave} className="btn-primary text-xs"><Save size={12} /> 儲存</button>
          </div>
        </div>
      )}

      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="table-th">代碼</th>
            <th className="table-th">名稱</th>
            <th className="table-th">1 單位 = NT$</th>
            <th className="table-th text-right">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {currencies.map((c) => {
            const isBase = c.CurrencyCode === 'TWD'
            return (
              <tr key={c.CurrencyCode} className="table-tr">
                <td className="table-td font-mono text-indigo-700">{c.CurrencyCode}</td>
                <td className="table-td font-medium">{c.CurrencyName}{isBase && <span className="ml-2 badge badge-gray">基準</span>}</td>
                <td className="table-td">NT$ {c.RateToTWD}</td>
                <td className="table-td">
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => openEdit(c)} className="btn-ghost p-1.5" disabled={isBase}><Pencil size={13} /></button>
                    <button onClick={() => handleDelete(c)} className="btn-ghost p-1.5 hover:text-red-600" disabled={isBase}><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
