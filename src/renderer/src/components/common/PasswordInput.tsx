import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

interface PasswordInputProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
  onEnter?: () => void
  autoFocus?: boolean
}

// Password field with a show/hide eye toggle on the right.
export function PasswordInput({ value, onChange, placeholder, className = '', onEnter, autoFocus }: PasswordInputProps) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
        placeholder={placeholder}
        className={`${className} pr-9`}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        title={show ? '隱藏' : '顯示'}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  )
}
