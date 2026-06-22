import type { TimePreset } from '@shared/types'
import type { Platform } from '@shared/types'

const TIME_OPTIONS: { value: TimePreset; label: string }[] = [
  { value: 'today',  label: '本日' },
  { value: '7d',     label: '一週' },
  { value: '30d',    label: '一個月' },
  { value: '90d',    label: '三個月' },
  { value: '180d',   label: '半年' },
  { value: '365d',   label: '一年' },
  { value: 'all',    label: '全部' }
]

interface FilterBarProps {
  timePreset: TimePreset
  platformID: string | null
  platforms: Platform[]
  onTimeChange: (p: TimePreset) => void
  onPlatformChange: (id: string | null) => void
}

export function FilterBar({
  timePreset,
  platformID,
  platforms,
  onTimeChange,
  onPlatformChange
}: FilterBarProps) {
  return (
    <div className="flex flex-wrap gap-3 items-center">
      {/* Time presets */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
        {TIME_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => onTimeChange(value)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              timePreset === value
                ? 'bg-white shadow text-indigo-700 font-semibold'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Platform selector */}
      <select
        value={platformID ?? ''}
        onChange={(e) => onPlatformChange(e.target.value || null)}
        className="input !w-auto text-sm"
      >
        <option value="">全平台加總</option>
        {platforms.map((p) => (
          <option key={p.PlatformID} value={p.PlatformID}>
            {p.PlatformName}
          </option>
        ))}
      </select>
    </div>
  )
}
