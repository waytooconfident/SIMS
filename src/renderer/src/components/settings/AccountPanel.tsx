import { useState } from 'react'
import { Save, UserCog } from 'lucide-react'
import { useAuthStore } from '../../stores/useAuthStore'
import { AvatarPicker } from '../common/AvatarPicker'
import { PasswordInput } from '../common/PasswordInput'

// Edit the currently logged-in user's name / avatar / password.
export function AccountPanel() {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const [username, setUsername] = useState(user?.Username ?? '')
  const [avatar, setAvatar] = useState(user?.Avatar ?? '🐱')
  const [password, setPassword] = useState('')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!user) return null

  const save = async () => {
    if (!username.trim()) { setError('使用者名稱不能為空'); return }
    setError(null)
    try {
      const updated = await window.api.auth.updateUser(user.UserID, {
        username: username.trim(), avatar, password: password || undefined
      })
      setUser(updated)
      setPassword('')
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setError(String(e).replace(/^Error:\s*/, ''))
    }
  }

  return (
    <div className="card p-6 max-w-2xl">
      <div className="flex items-center gap-2 mb-4">
        <UserCog size={16} className="text-indigo-600" />
        <h3 className="font-semibold">帳號設定（{user.Username}）</h3>
      </div>
      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

      <div className="space-y-4">
        <AvatarPicker value={avatar} onChange={setAvatar} />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">使用者名稱</label>
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div>
            <label className="label">新密碼（留空不變更）</label>
            <PasswordInput value={password} onChange={setPassword} placeholder="••••••"
              className="input" />
          </div>
        </div>
        <button onClick={save} className="btn-primary"><Save size={14} /> {saved ? '已儲存 ✓' : '儲存帳號'}</button>
      </div>
    </div>
  )
}
