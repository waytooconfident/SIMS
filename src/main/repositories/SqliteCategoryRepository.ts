import { stmtAll, stmtGet, run } from '../database/sqlHelpers'
import type { ICategoryRepository } from '../core/interfaces/ICategoryRepository'
import type { Category, CreateCategoryInput, UpdateCategoryInput } from '@shared/types'

// CategoryID is a 3-digit code. "000" is reserved for 未分類 (uncategorized).
function pad3(n: number): string {
  return String(n).padStart(3, '0')
}

export class SqliteCategoryRepository implements ICategoryRepository {
  findAll(): Category[] {
    return stmtAll('SELECT * FROM Categories ORDER BY CategoryID ASC')
  }

  findById(categoryID: string): Category | undefined {
    return stmtGet('SELECT * FROM Categories WHERE CategoryID = :id', { ':id': categoryID })
  }

  /** Next free code, 001..999 (000 is reserved). */
  private nextCategoryID(): string {
    const row = stmtGet<{ maxId: string | null }>(
      "SELECT MAX(CategoryID) AS maxId FROM Categories WHERE CategoryID <> '000'"
    )
    const next = (row?.maxId ? parseInt(row.maxId, 10) : 0) + 1
    if (next > 999) throw new Error('分類數量已達上限 (999)。')
    return pad3(next)
  }

  create(input: CreateCategoryInput): Category {
    const record: Category = {
      CategoryID: this.nextCategoryID(),
      CategoryName: input.CategoryName,
      CreatedAt: new Date().toISOString()
    }
    run(
      'INSERT INTO Categories (CategoryID, CategoryName, CreatedAt) VALUES (:id, :name, :createdAt)',
      { ':id': record.CategoryID, ':name': record.CategoryName, ':createdAt': record.CreatedAt }
    )
    return record
  }

  update(categoryID: string, input: UpdateCategoryInput): Category | undefined {
    const existing = this.findById(categoryID)
    if (!existing) return undefined
    run('UPDATE Categories SET CategoryName = :name WHERE CategoryID = :id', {
      ':name': input.CategoryName,
      ':id': categoryID
    })
    return { ...existing, CategoryName: input.CategoryName }
  }

  delete(categoryID: string): boolean {
    if (categoryID === '000') throw new Error('「未分類」為系統預設分類，無法刪除。')
    // Move any products in this category back to 未分類 first (handled by service
    // via recategorize); here we just drop the category row.
    return run('DELETE FROM Categories WHERE CategoryID = :id', { ':id': categoryID }) > 0
  }
}
