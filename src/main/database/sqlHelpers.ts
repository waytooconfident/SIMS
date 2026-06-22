import { getDb, persistDb } from './DatabaseManager'

// sql.js has no .all()/.get() shorthand and named params REQUIRE a ":" prefix.
// These helpers wrap the prepare → bind → step → getAsObject → free dance and
// always free the statement so we never leak WASM memory.

export function stmtAll<T>(sql: string, params?: object): T[] {
  const db = getDb()
  const stmt = db.prepare(sql)
  if (params) stmt.bind(params as never)
  const rows: T[] = []
  while (stmt.step()) rows.push(stmt.getAsObject() as unknown as T)
  stmt.free()
  return rows
}

export function stmtGet<T>(sql: string, params?: object): T | undefined {
  const db = getDb()
  const stmt = db.prepare(sql)
  if (params) stmt.bind(params as never)
  const row = stmt.step() ? (stmt.getAsObject() as unknown as T) : undefined
  stmt.free()
  return row
}

/** Run a write statement and flush the in-memory DB to disk. */
export function run(sql: string, params?: object): number {
  const db = getDb()
  db.run(sql, (params ?? {}) as never)
  persistDb()
  return db.getRowsModified()
}

/** Run several writes inside a transaction, persisting once at the end. */
export function transaction(fn: () => void): void {
  const db = getDb()
  db.run('BEGIN')
  try {
    fn()
    db.run('COMMIT')
  } catch (e) {
    db.run('ROLLBACK')
    throw e
  }
  persistDb()
}
