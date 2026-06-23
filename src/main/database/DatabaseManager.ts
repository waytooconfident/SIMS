import initSqlJs from 'sql.js'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { CREATE_TABLES_SQL, DROP_RESTRUCTURED_SQL, SCHEMA_VERSION } from './schema'

// sql.js keeps the SQLite database in memory; we persist to disk after writes.
// One sql.js engine ("SQL static") is shared by the per-user data DB and the
// central auth DB.

type SqlJs = Awaited<ReturnType<typeof initSqlJs>>
type SqlJsDb = InstanceType<SqlJs['Database']>

let SQL: SqlJs | null = null

/** Load (once) and return the sql.js engine, resolving the wasm location. */
export async function getSQL(): Promise<SqlJs> {
  if (SQL) return SQL
  SQL = await initSqlJs({
    //  • packaged app → wasm copied next to the exe via electron-builder extraResources
    //  • dev → straight from node_modules
    locateFile: (file: string) =>
      app.isPackaged
        ? path.join(process.resourcesPath, file)
        : path.join(process.cwd(), 'node_modules/sql.js/dist', file)
  })
  return SQL
}

/** Open (or create) a SQLite database file and return the handle. */
export function loadDatabase(SQLref: SqlJs, dbPath: string): SqlJsDb {
  if (fs.existsSync(dbPath)) return new SQLref.Database(fs.readFileSync(dbPath))
  return new SQLref.Database()
}

export function saveDatabase(db: SqlJsDb, dbPath: string): void {
  fs.writeFileSync(dbPath, Buffer.from(db.export()))
}

// ─── Active per-user data database ─────────────────────────────────────────────

let db: SqlJsDb | null = null
let dbPath = ''

export function getDb(): SqlJsDb {
  if (!db) throw new Error('尚未登入：資料庫未初始化。')
  return db
}

export function persistDb(): void {
  if (db && dbPath) saveDatabase(db, dbPath)
}

export function isDbOpen(): boolean {
  return db !== null
}

/** Switch the active data DB to a specific user's file, applying migrations. */
export async function openUserData(userId: string): Promise<void> {
  const sql = await getSQL()
  // Persist & release any currently-open user DB first.
  closeDb()

  const dir = path.join(app.getPath('userData'), 'data')
  fs.mkdirSync(dir, { recursive: true })
  dbPath = path.join(dir, `pims-${userId}.db`)
  db = loadDatabase(sql, dbPath)

  migrate(db)
  persistDb()
}

export function closeDb(): void {
  if (db) {
    persistDb()
    db.close()
  }
  db = null
  dbPath = ''
}

// ─── Schema migration (structural, version-agnostic) ───────────────────────────

function migrate(database: SqlJsDb): void {
  const version = userVersion(database)

  // v7 is a DESTRUCTIVE schema rework (cost line-items + order model). Any older
  // DB that already has data is reset: drop the restructured tables (Currencies &
  // Settings are preserved by DROP_RESTRUCTURED_SQL) and rebuild from scratch.
  // A fresh DB has version 0 with no tables, so nothing is dropped.
  if (version > 0 && version < 7 && tableExists(database, 'Products')) {
    database.exec(DROP_RESTRUCTURED_SQL)
  }

  // v7 → v8: CompetitorPrice moved onto the listing row (per-platform). Add the
  // column non-destructively before CREATE_TABLES (which indexes/seeds reference).
  if (tableExists(database, 'ProductPlatformMappings') && !columnExists(database, 'ProductPlatformMappings', 'CompetitorPrice')) {
    database.run('ALTER TABLE ProductPlatformMappings ADD COLUMN CompetitorPrice REAL')
  }

  // Create any missing tables/indexes/seeds (idempotent — IF NOT EXISTS).
  database.exec(CREATE_TABLES_SQL)
  database.run(`PRAGMA user_version = ${SCHEMA_VERSION}`)
}

function userVersion(database: SqlJsDb): number {
  const res = database.exec('PRAGMA user_version') as { values?: unknown[][] }[]
  return Number(res?.[0]?.values?.[0]?.[0] ?? 0)
}

function columnExists(database: SqlJsDb, table: string, column: string): boolean {
  const res = database.exec(`PRAGMA table_info(${table})`) as { values?: unknown[][] }[]
  return (res?.[0]?.values ?? []).some((r) => r[1] === column)
}

function tableExists(database: SqlJsDb, name: string): boolean {
  const res = database.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name='${name}'`) as {
    values?: unknown[][]
  }[]
  return (res?.[0]?.values?.length ?? 0) > 0
}
