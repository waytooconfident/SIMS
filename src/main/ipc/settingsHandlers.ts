import { ipcMain } from 'electron'
import { IPC } from '@shared/types'
import { getDb } from '../database/DatabaseManager'
import { run } from '../database/sqlHelpers'

export function registerSettingsHandlers(): void {
  ipcMain.handle(IPC.SETTINGS.GET, (_e, key: string): string | null => {
    // sql.js: bind named params (":" prefix required), step once, free the stmt.
    const stmt = getDb().prepare('SELECT Value FROM Settings WHERE Key = :key')
    stmt.bind({ ':key': key })
    const row = stmt.step() ? (stmt.getAsObject() as { Value?: string }) : undefined
    stmt.free()
    return row?.Value ?? null
  })

  ipcMain.handle(IPC.SETTINGS.SET, (_e, key: string, value: string): void => {
    // run() persists the in-memory DB to disk so the setting survives a restart.
    run('INSERT OR REPLACE INTO Settings (Key, Value) VALUES (:key, :value)', {
      ':key': key,
      ':value': value
    })
  })
}
