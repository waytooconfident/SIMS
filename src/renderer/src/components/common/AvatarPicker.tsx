import { useState } from 'react'
import { AvatarView } from './AvatarView'

export const AVATARS = ['🐱', '🐶', '🦊', '🐼', '🦁', '🐯', '🐰', '🐨', '🐸', '🐵', '🐧', '🦄', '🐙', '🐳', '🌸', '⭐']

interface AvatarPickerProps {
  value: string
  onChange: (v: string) => void
  dark?: boolean
}

// Pick a preset emoji OR drag in / browse a photo (stored as a data URL).
export function AvatarPicker({ value, onChange, dark = false }: AvatarPickerProps) {
  const [dragOver, setDragOver] = useState(false)
  const tile = dark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'

  const fromFile = async (file?: File) => {
    if (!file) return
    const path = window.api.files.getPathForFile(file)
    if (!path) return
    const url = await window.api.images.getDataUrl(path)
    if (url) onChange(url)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <AvatarView avatar={value} size={72} bg={dark ? 'bg-gray-700' : 'bg-gray-100'} />
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); fromFile(e.dataTransfer.files?.[0]) }}
          className={`flex-1 h-[72px] rounded-lg border-2 border-dashed flex items-center justify-center text-xs px-2 text-center
            ${dragOver ? 'border-indigo-500 bg-indigo-500/10' : dark ? 'border-gray-600 text-gray-400' : 'border-gray-300 text-gray-500'}`}
        >
          拖曳照片到這裡設為頭像
        </div>
      </div>
      <div className="grid grid-cols-8 gap-2">
        {AVATARS.map((a) => (
          <button key={a} type="button" onClick={() => onChange(a)}
            className={`h-9 rounded-lg text-xl flex items-center justify-center ${value === a ? 'ring-2 ring-indigo-500' : ''} ${tile}`}>{a}</button>
        ))}
      </div>
    </div>
  )
}
