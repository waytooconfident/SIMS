// Minimal ambient types for sql.js (the package ships no .d.ts).
// Covers exactly the surface PIMS uses.
declare module 'sql.js' {
  export interface Statement {
    bind(params?: Record<string, unknown> | unknown[]): boolean
    step(): boolean
    get(params?: Record<string, unknown> | unknown[]): unknown[]
    getAsObject(params?: Record<string, unknown> | unknown[]): Record<string, unknown>
    run(params?: Record<string, unknown> | unknown[]): void
    reset(): void
    free(): boolean
  }

  export interface Database {
    run(sql: string, params?: Record<string, unknown> | unknown[]): Database
    exec(sql: string): unknown[]
    prepare(sql: string): Statement
    export(): Uint8Array
    close(): void
    getRowsModified(): number
  }

  export interface SqlJsStatic {
    Database: { new (data?: ArrayLike<number> | Buffer | null): Database }
  }

  export interface InitSqlJsConfig {
    locateFile?: (file: string) => string
  }

  export default function initSqlJs(config?: InitSqlJsConfig): Promise<SqlJsStatic>
}
