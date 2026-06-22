import { useState } from 'react'
import { RefreshCw, Save } from 'lucide-react'
import { useExchangeRateStore } from '../../stores/useExchangeRateStore'

export function ExchangeRatePanel() {
  const { rate, saveRate } = useExchangeRateStore()
  const [input, setInput] = useState(String(rate))
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    const parsed = parseFloat(input)
    if (isNaN(parsed) || parsed <= 0) return
    await saveRate(parsed)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="card p-6 max-w-md">
      <div className="flex items-center gap-2 mb-4">
        <RefreshCw size={16} className="text-indigo-600" />
        <h3 className="font-semibold">RMB → NTD 匯率設定</h3>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        修改此匯率後，全系統所有 NTD 成本、淨利潤與淨利率將即時重新計算。
        匯率不存入任何商品記錄，保持動態彈性。
      </p>

      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <label className="label">1 RMB = ? NTD</label>
          <input
            className="input"
            type="number"
            min="0.01"
            step="0.01"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </div>
        <button onClick={handleSave} className="btn-primary">
          <Save size={14} />
          {saved ? '已儲存 ✓' : '套用'}
        </button>
      </div>

      <div className="mt-4 p-3 bg-indigo-50 rounded-lg text-sm text-indigo-700">
        目前匯率：<strong>1 RMB = {rate.toFixed(2)} NTD</strong>
      </div>
    </div>
  )
}
