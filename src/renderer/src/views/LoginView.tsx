import { useEffect, useState } from 'react'
import { Plus, Trash2, X, ArrowLeft, Settings } from 'lucide-react'
import type { User } from '@shared/types'
import { useAuthStore } from '../stores/useAuthStore'
import { useThemeStore } from '../stores/useThemeStore'
import { AvatarView } from '../components/common/AvatarView'
import { AvatarPicker, AVATARS } from '../components/common/AvatarPicker'
import { PasswordInput } from '../components/common/PasswordInput'
import { ThemeToggle } from '../components/common/ThemeToggle'

type Mode = { kind: 'select' } | { kind: 'password'; user: User } | { kind: 'add' }

export function LoginView() {
  const setUser = useAuthStore((s) => s.setUser)
  const [users, setUsers] = useState<User[]>([])
  const [lastUserId, setLastUserId] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>({ kind: 'select' })
  const [manage, setManage] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadUsers = async () => {
    setUsers(await window.api.auth.listUsers())
    setLastUserId(await window.api.auth.lastUser())
  }
  useEffect(() => { loadUsers() }, [])

  const sortedUsers = [...users].sort((a, b) => (a.UserID === lastUserId ? -1 : b.UserID === lastUserId ? 1 : 0))

  return (
    <div className="relative h-screen w-screen flex flex-col items-center justify-center p-8
      bg-gray-100 text-gray-900 dark:bg-gray-900 dark:text-white">
      <div className="absolute top-4 right-4"><ThemeToggle /></div>

      <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 tracking-widest uppercase mb-1">SIMS 庫存系統</p>
      <h1 className="text-2xl font-bold mb-10">{mode.kind === 'select' ? '選擇使用者' : ' '}</h1>

      {mode.kind === 'select' && (
        <>
          <div className="flex flex-wrap gap-6 justify-center max-w-3xl">
            {sortedUsers.map((u) => (
              <div key={u.UserID} className="relative group">
                <button onClick={() => { setError(null); setMode({ kind: 'password', user: u }) }} className="flex flex-col items-center gap-2 w-28">
                  <div className="group-hover:ring-4 ring-indigo-500 rounded-2xl transition">
                    <AvatarView avatar={u.Avatar} size={96} />
                  </div>
                  <span className="text-sm text-gray-600 group-hover:text-gray-900 dark:text-gray-300 dark:group-hover:text-white truncate w-full text-center">{u.Username}</span>
                  {u.UserID === lastUserId && <span className="text-[10px] text-indigo-500 dark:text-indigo-400">上次登入</span>}
                </button>
                {manage && (
                  <button
                    onClick={async () => { if (confirm(`刪除使用者「${u.Username}」？其專屬資料庫也會一併刪除。`)) { await window.api.auth.deleteUser(u.UserID); loadUsers() } }}
                    className="absolute -top-2 -right-2 p-1 rounded-full bg-gray-300 text-gray-700 hover:bg-red-600 hover:text-white dark:bg-gray-700 dark:text-white"><Trash2 size={12} /></button>
                )}
              </div>
            ))}

            <button onClick={() => { setError(null); setMode({ kind: 'add' }) }} className="flex flex-col items-center gap-2 w-28">
              <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-gray-300 hover:border-indigo-500 dark:border-gray-600 flex items-center justify-center text-gray-400 hover:text-indigo-500 dark:text-gray-500 dark:hover:text-indigo-400 transition"><Plus size={36} /></div>
              <span className="text-sm text-gray-500 dark:text-gray-400">新增使用者</span>
            </button>
          </div>

          {users.length > 0 && (
            <button onClick={() => setManage((m) => !m)} className="mt-10 text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white flex items-center gap-1.5">
              <Settings size={14} /> {manage ? '完成' : '管理使用者'}
            </button>
          )}
          <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">變更名稱 / 密碼 / 頭像請登入後於「系統設定 → 帳號設定」進行</p>
        </>
      )}

      {mode.kind === 'password' && (
        <PasswordPanel user={mode.user} error={error} setError={setError} onCancel={() => setMode({ kind: 'select' })} onSuccess={(u) => setUser(u)} />
      )}

      {mode.kind === 'add' && (
        <AddProfileForm error={error} setError={setError} onCancel={() => setMode({ kind: 'select' })} onSaved={() => { loadUsers(); setMode({ kind: 'select' }) }} />
      )}
    </div>
  )
}

function PasswordPanel({ user, error, setError, onCancel, onSuccess }: {
  user: User; error: string | null; setError: (s: string | null) => void; onCancel: () => void; onSuccess: (u: User) => void
}) {
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [busy, setBusy] = useState(false)

  // Prefill a previously remembered password (decrypted in the main process).
  useEffect(() => {
    let cancelled = false
    window.api.auth.rememberedPassword(user.UserID).then((pw) => {
      if (cancelled || !pw) return
      setPassword(pw)
      setRemember(true)
    })
    return () => { cancelled = true }
  }, [user.UserID])

  const submit = async () => {
    setBusy(true); setError(null)
    try { onSuccess(await window.api.auth.login(user.UserID, password, remember)) }
    catch (e) { setError(String(e).replace(/^Error:\s*/, '')) }
    finally { setBusy(false) }
  }

  return (
    <div className="w-[360px] bg-white dark:bg-gray-800 rounded-2xl p-6 flex flex-col items-center gap-4 shadow-xl border border-gray-200 dark:border-gray-700">
      <AvatarView avatar={user.Avatar} size={80} />
      <p className="font-semibold">{user.Username}</p>
      {error && <p className="text-red-500 dark:text-red-400 text-sm">{error}</p>}
      <PasswordInput
        autoFocus value={password} onChange={setPassword} onEnter={submit} placeholder="輸入密碼"
        className="input"
      />
      <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 self-start cursor-pointer">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> 記住密碼（下次自動登入）
      </label>
      <div className="flex gap-3 w-full">
        <button onClick={onCancel} className="btn-secondary flex-1 justify-center py-2"><ArrowLeft size={14} /> 返回</button>
        <button onClick={submit} disabled={busy} className="btn-primary flex-1 justify-center py-2">{busy ? '登入中…' : '登入'}</button>
      </div>
    </div>
  )
}

function AddProfileForm({ error, setError, onCancel, onSaved }: {
  error: string | null; setError: (s: string | null) => void; onCancel: () => void; onSaved: () => void
}) {
  const dark = useThemeStore((s) => s.theme === 'dark')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [avatar, setAvatar] = useState(AVATARS[0])
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!username.trim()) { setError('請輸入使用者名稱'); return }
    if (!password) { setError('請設定密碼'); return }
    setBusy(true); setError(null)
    try { await window.api.auth.createUser({ username: username.trim(), password, avatar }); onSaved() }
    catch (e) { setError(String(e).replace(/^Error:\s*/, '')) }
    finally { setBusy(false) }
  }

  return (
    <div className="w-[420px] bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">新增使用者</h2>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-700 dark:hover:text-white"><X size={18} /></button>
      </div>
      {error && <p className="text-red-500 dark:text-red-400 text-sm mb-3">{error}</p>}
      <div className="space-y-4">
        <AvatarPicker value={avatar} onChange={setAvatar} dark={dark} />
        <div>
          <label className="label">使用者名稱</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} className="input" placeholder="名稱" />
        </div>
        <div>
          <label className="label">密碼</label>
          <PasswordInput value={password} onChange={setPassword} placeholder="密碼" className="input" />
        </div>
      </div>
      <div className="flex gap-3 mt-6">
        <button onClick={onCancel} className="btn-secondary flex-1 justify-center py-2">取消</button>
        <button onClick={submit} disabled={busy} className="btn-primary flex-1 justify-center py-2">{busy ? '建立中…' : '建立'}</button>
      </div>
    </div>
  )
}
