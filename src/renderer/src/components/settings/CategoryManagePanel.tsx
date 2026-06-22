import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, X, Save } from 'lucide-react'
import type { Category } from '@shared/types'
import { useCategories } from '../../hooks/useCategories'

export function CategoryManagePanel() {
  const { categories, load, create, update, remove } = useCategories()
  const [editing, setEditing] = useState<Category | null>(null)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { load() }, [load])

  const openCreate = () => { setCreating(true); setEditing(null); setName(''); setError(null) }
  const openEdit = (c: Category) => { setEditing(c); setCreating(false); setName(c.CategoryName); setError(null) }
  const cancel = () => { setEditing(null); setCreating(false); setError(null) }

  const handleSave = async () => {
    if (!name.trim()) { setError('分類名稱不能為空'); return }
    try {
      if (creating) await create({ CategoryName: name.trim() })
      else if (editing) await update(editing.CategoryID, { CategoryName: name.trim() })
      cancel()
    } catch (e) { setError(String(e)) }
  }

  const handleDelete = async (c: Category) => {
    if (c.CategoryID === '000') { alert('「未分類」為系統預設分類，無法刪除。'); return }
    if (!confirm(`刪除分類「${c.CategoryName}」？此分類下的商品會自動移回「未分類」並重新編號。`)) return
    try { await remove(c.CategoryID) } catch (e) { alert(String(e)) }
  }

  return (
    <div className="card p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">分類管理</h3>
        <button onClick={openCreate} className="btn-primary text-xs"><Plus size={13} /> 新增分類</button>
      </div>

      {(creating || editing) && (
        <div className="mb-4 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
          {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="label">分類名稱{editing && `（編號 ${editing.CategoryID}）`}</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：項鍊 / 手飾" />
            </div>
            <button onClick={cancel} className="btn-secondary text-xs"><X size={12} /> 取消</button>
            <button onClick={handleSave} className="btn-primary text-xs"><Save size={12} /> 儲存</button>
          </div>
          <p className="text-xs text-gray-400 mt-2">編號由系統自動指派（001–999），不需手動輸入。</p>
        </div>
      )}

      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="table-th">編號</th>
            <th className="table-th">分類名稱</th>
            <th className="table-th text-right">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {categories.map((c) => (
            <tr key={c.CategoryID} className="table-tr">
              <td className="table-td font-mono text-indigo-700">{c.CategoryID}</td>
              <td className="table-td font-medium">{c.CategoryName}</td>
              <td className="table-td">
                <div className="flex gap-2 justify-end">
                  <button onClick={() => openEdit(c)} className="btn-ghost p-1.5" disabled={c.CategoryID === '000'}>
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => handleDelete(c)} className="btn-ghost p-1.5 hover:text-red-600" disabled={c.CategoryID === '000'}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
