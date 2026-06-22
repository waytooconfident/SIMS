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
  // Legacy pre-rework DB (ImageKey PK, Products without CategoryID) → reset.
  if (tableExists(database, 'Products') && !columnExists(database, 'Products', 'CategoryID')) {
    database.exec(DROP_RESTRUCTURED_SQL)
  }
  database.exec(CREATE_TABLES_SQL)
  // v2 → v3: add FeeType to a PlatformFees table that predates it.
  if (tableExists(database, 'PlatformFees') && !columnExists(database, 'PlatformFees', 'FeeType')) {
    database.run("ALTER TABLE PlatformFees ADD COLUMN FeeType TEXT NOT NULL DEFAULT 'percent'")
  }
  // v3 → v4: add SortOrder to Products for manual drag-reordering.
  if (tableExists(database, 'Products') && !columnExists(database, 'Products', 'SortOrder')) {
    database.run('ALTER TABLE Products ADD COLUMN SortOrder INTEGER NOT NULL DEFAULT 0')
  }
  // v5 → v6: add DetailID to mappings so sales can be tracked per variant. (The
  // ProductDetails/DetailCosts tables are created above via CREATE IF NOT EXISTS.)
  if (tableExists(database, 'ProductPlatformMappings') && !columnExists(database, 'ProductPlatformMappings', 'DetailID')) {
    database.run('ALTER TABLE ProductPlatformMappings ADD COLUMN DetailID TEXT')
  }
  database.run(`PRAGMA user_version = ${SCHEMA_VERSION}`)
}

function tableExists(database: SqlJsDb, name: string): boolean {
  const res = database.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name='${name}'`) as {
    values?: unknown[][]
  }[]
  return (res?.[0]?.values?.length ?? 0) > 0
}

function columnExists(database: SqlJsDb, table: string, column: string): boolean {
  const res = database.exec(`PRAGMA table_info(${table})`) as { values?: unknown[][] }[]
  return (res?.[0]?.values ?? []).some((r) => r[1] === column)
}
