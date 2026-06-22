import { app, safeStorage } from 'electron'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { getSQL, loadDatabase, saveDatabase, openUserData, closeDb } from '../database/DatabaseManager'
import type { User, CreateUserInput, UpdateUserInput } from '@shared/types'

// Central authentication database (separate from the per-user data DBs).
// Stores user credentials (salted scrypt hashes) and a little meta (last/remembered
// user). Every query uses bound parameters, so usernames/passwords can never be
// interpreted as SQL — i.e. SQL-injection-safe by construction.

type SqlJs = Awaited<ReturnType<typeof getSQL>>
type AuthDb = InstanceType<SqlJs['Database']>

let authDb: AuthDb | null = null
let authPath = ''
let currentUserId: string | null = null

const AUTH_SCHEMA = `
CREATE TABLE IF NOT EXISTS Users (
  UserID    TEXT PRIMARY KEY,
  Username  TEXT NOT NULL UNIQUE,
  PassHash  TEXT NOT NULL,
  Salt      TEXT NOT NULL,
  Avatar    TEXT NOT NULL DEFAULT '🐱',
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS AuthMeta (Key TEXT PRIMARY KEY, Value TEXT NOT NULL);
`

// ─── low-level helpers (bound params only) ─────────────────────────────────────
function persist(): void {
  if (authDb && authPath) saveDatabase(authDb, authPath)
}
function all<T>(sql: string, params?: object): T[] {
  const stmt = authDb!.prepare(sql)
  if (params) stmt.bind(params as never)
  const rows: T[] = []
  while (stmt.step()) rows.push(stmt.getAsObject() as unknown as T)
  stmt.free()
  return rows
}
function get<T>(sql: string, params?: object): T | undefined {
  const stmt = authDb!.prepare(sql)
  if (params) stmt.bind(params as never)
  const row = stmt.step() ? (stmt.getAsObject() as unknown as T) : undefined
  stmt.free()
  return row
}
function exec(sql: string, params?: object): void {
  authDb!.run(sql, (params ?? {}) as never)
  persist()
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex')
}
function verifyPassword(password: string, salt: string, expected: string): boolean {
  const actual = hashPassword(password, salt)
  const a = Buffer.from(actual, 'hex')
  const b = Buffer.from(expected, 'hex')
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

function setMeta(key: string, value: string): void {
  exec('INSERT OR REPLACE INTO AuthMeta (Key, Value) VALUES (:k, :v)', { ':k': key, ':v': value })
}

// ─── Remembered password (OS-encrypted via Electron safeStorage) ───────────────
// The plaintext password never touches disk: it's encrypted with the OS keychain
// (DPAPI on Windows) and stored base64 in AuthMeta under `pw:<userId>`.
const pwKey = (userId: string) => `pw:${userId}`

function storePassword(userId: string, password: string): void {
  if (!safeStorage.isEncryptionAvailable()) return
  const enc = safeStorage.encryptString(password).toString('base64')
  setMeta(pwKey(userId), enc)
}
function forgetPassword(userId: string): void {
  clearMeta(pwKey(userId))
}
export function rememberedPassword(userId: string): string | null {
  const enc = getMeta(pwKey(userId))
  if (!enc || !safeStorage.isEncryptionAvailable()) return null
  try { return safeStorage.decryptString(Buffer.from(enc, 'base64')) } catch { return null }
}

function getMeta(key: string): string | null {
  return get<{ Value: string }>('SELECT Value FROM AuthMeta WHERE Key = :k', { ':k': key })?.Value ?? null
}
function clearMeta(key: string): void {
  exec('DELETE FROM AuthMeta WHERE Key = :k', { ':k': key })
}

// Strip secret columns before anything leaves the main process.
function toPublic(row: { UserID: string; Username: string; Avatar: string; CreatedAt: string }): User {
  return { UserID: row.UserID, Username: row.Username, Avatar: row.Avatar, CreatedAt: row.CreatedAt }
}

// ─── public API ────────────────────────────────────────────────────────────────

export async function initAuth(): Promise<void> {
  const SQL = await getSQL()
  authPath = path.join(app.getPath('userData'), 'auth.db')
  authDb = loadDatabase(SQL, authPath)
  authDb.exec(AUTH_SCHEMA)
  persist()
}

export function listUsers(): User[] {
  return all<{ UserID: string; Username: string; Avatar: string; CreatedAt: string }>(
    'SELECT UserID, Username, Avatar, CreatedAt FROM Users ORDER BY CreatedAt ASC'
  ).map(toPublic)
}

export function createUser(input: CreateUserInput): User {
  const username = input.username?.trim()
  if (!username) throw new Error('使用者名稱不能為空。')
  if (!input.password) throw new Error('密碼不能為空。')
  if (get('SELECT 1 FROM Users WHERE Username = :u', { ':u': username }))
    throw new Error('此使用者名稱已存在。')

  const salt = crypto.randomBytes(16).toString('hex')
  const record = {
    UserID: crypto.randomUUID(),
    Username: username,
    PassHash: hashPassword(input.password, salt),
    Salt: salt,
    Avatar: input.avatar || '🐱',
    CreatedAt: new Date().toISOString()
  }
  exec(
    `INSERT INTO Users (UserID, Username, PassHash, Salt, Avatar, CreatedAt)
     VALUES (:id, :u, :h, :s, :a, :c)`,
    { ':id': record.UserID, ':u': record.Username, ':h': record.PassHash, ':s': record.Salt, ':a': record.Avatar, ':c': record.CreatedAt }
  )
  return toPublic(record)
}

export function updateUser(userId: string, input: UpdateUserInput): User {
  const existing = get<{ UserID: string; Username: string; Avatar: string; CreatedAt: string }>(
    'SELECT * FROM Users WHERE UserID = :id', { ':id': userId }
  )
  if (!existing) throw new Error('使用者不存在。')

  const username = input.username?.trim() || existing.Username
  if (username !== existing.Username && get('SELECT 1 FROM Users WHERE Username = :u', { ':u': username }))
    throw new Error('此使用者名稱已存在。')
  const avatar = input.avatar || existing.Avatar

  if (input.password) {
    const salt = crypto.randomBytes(16).toString('hex')
    exec('UPDATE Users SET Username=:u, Avatar=:a, PassHash=:h, Salt=:s WHERE UserID=:id', {
      ':u': username, ':a': avatar, ':h': hashPassword(input.password, salt), ':s': salt, ':id': userId
    })
    forgetPassword(userId) // any remembered password is now stale
  } else {
    exec('UPDATE Users SET Username=:u, Avatar=:a WHERE UserID=:id', { ':u': username, ':a': avatar, ':id': userId })
  }
  return toPublic({ UserID: userId, Username: username, Avatar: avatar, CreatedAt: existing.CreatedAt })
}

export function deleteUser(userId: string): void {
  exec('DELETE FROM Users WHERE UserID = :id', { ':id': userId })
  if (getMeta('rememberUserId') === userId) clearMeta('rememberUserId')
  if (getMeta('lastUserId') === userId) clearMeta('lastUserId')
  forgetPassword(userId)
  // Remove the user's data DB file too.
  const f = path.join(app.getPath('userData'), 'data', `pims-${userId}.db`)
  try { if (fs.existsSync(f)) fs.unlinkSync(f) } catch { /* ignore */ }
}

export async function login(userId: string, password: string, remember: boolean): Promise<User> {
  const row = get<{ UserID: string; Username: string; PassHash: string; Salt: string; Avatar: string; CreatedAt: string }>(
    'SELECT * FROM Users WHERE UserID = :id', { ':id': userId }
  )
  if (!row) throw new Error('使用者不存在。')
  if (!verifyPassword(password, row.Salt, row.PassHash)) throw new Error('密碼錯誤。')

  await openUserData(userId)
  currentUserId = userId
  setMeta('lastUserId', userId)
  if (remember) {
    setMeta('rememberUserId', userId)
    storePassword(userId, password)
  } else {
    clearMeta('rememberUserId')
    forgetPassword(userId)
  }
  return toPublic(row)
}

/** Auto-login the remembered user (no password) — used on app startup. */
export async function autoLogin(): Promise<User | null> {
  const userId = getMeta('rememberUserId')
  if (!userId) return null
  const row = get<{ UserID: string; Username: string; Avatar: string; CreatedAt: string }>(
    'SELECT UserID, Username, Avatar, CreatedAt FROM Users WHERE UserID = :id', { ':id': userId }
  )
  if (!row) { clearMeta('rememberUserId'); return null }
  await openUserData(userId)
  currentUserId = userId
  return toPublic(row)
}

export function logout(): void {
  closeDb()
  currentUserId = null
  clearMeta('rememberUserId') // stop auto-login; lastUserId is kept for preselect
}

export function currentUser(): User | null {
  if (!currentUserId) return null
  const row = get<{ UserID: string; Username: string; Avatar: string; CreatedAt: string }>(
    'SELECT UserID, Username, Avatar, CreatedAt FROM Users WHERE UserID = :id', { ':id': currentUserId }
  )
  return row ? toPublic(row) : null
}

export function lastUserId(): string | null {
  return getMeta('lastUserId')
}
