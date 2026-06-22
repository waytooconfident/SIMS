import { getDb } from '../database/DatabaseManager'
import { stmtAll, stmtGet, run, transaction } from '../database/sqlHelpers'
import type { IProductRepository } from '../core/interfaces/IProductRepository'
import type { Product, CreateProductInput, UpdateProductInput } from '@shared/types'

function pad4(n: number): string {
  return String(n).padStart(4, '0')
}

export class SqliteProductRepository implements IProductRepository {
  findAll(): Product[] {
    return stmtAll('SELECT * FROM Products ORDER BY SortOrder ASC, ProductID ASC')
  }

  findById(productID: string): Product | undefined {
    return stmtGet('SELECT * FROM Products WHERE ProductID = :id', { ':id': productID })
  }

  /** ProductID = 3-digit category + 4-digit sequence, e.g. "0010001". */
  nextProductID(categoryID: string): string {
    const cat = (categoryID || '000').padStart(3, '0')
    const row = stmtGet<{ maxId: string | null }>(
      'SELECT MAX(ProductID) AS maxId FROM Products WHERE CategoryID = :cat',
      { ':cat': cat }
    )
    const lastSeq = row?.maxId ? parseInt(row.maxId.slice(3), 10) : 0
    const next = lastSeq + 1
    if (next > 9999) throw new Error(`分類 ${cat} 的商品數量已達上限 (9999)。`)
    return cat + pad4(next)
  }

  private nextSortOrder(): number {
    const row = stmtGet<{ maxOrder: number | null }>('SELECT MAX(SortOrder) AS maxOrder FROM Products')
    return (row?.maxOrder ?? -1) + 1
  }

  create(input: CreateProductInput): Product {
    const now = new Date().toISOString()
    const categoryID = (input.CategoryID || '000').padStart(3, '0')
    const record: Product = {
      ProductID: this.nextProductID(categoryID),
      CategoryID: categoryID,
      ImageKey: input.ImageKey ?? null,
      ImagePath: input.ImagePath ?? null,
      Cost_RMB: input.Cost_RMB ?? 0,
      CompetitorPrice: input.CompetitorPrice ?? null,
      StockQuantity: input.StockQuantity ?? 0,
      LocalFolderPath: input.LocalFolderPath ?? null,
      SortOrder: this.nextSortOrder(),
      CreatedAt: now,
      UpdatedAt: now
    }
    run(
      `INSERT INTO Products
         (ProductID, CategoryID, ImageKey, ImagePath, Cost_RMB, CompetitorPrice,
          StockQuantity, LocalFolderPath, SortOrder, CreatedAt, UpdatedAt)
       VALUES
         (:ProductID, :CategoryID, :ImageKey, :ImagePath, :Cost_RMB, :CompetitorPrice,
          :StockQuantity, :LocalFolderPath, :SortOrder, :CreatedAt, :UpdatedAt)`,
      {
        ':ProductID': record.ProductID,
        ':CategoryID': record.CategoryID,
        ':ImageKey': record.ImageKey,
        ':ImagePath': record.ImagePath,
        ':Cost_RMB': record.Cost_RMB,
        ':CompetitorPrice': record.CompetitorPrice,
        ':StockQuantity': record.StockQuantity,
        ':LocalFolderPath': record.LocalFolderPath,
        ':SortOrder': record.SortOrder,
        ':CreatedAt': record.CreatedAt,
        ':UpdatedAt': record.UpdatedAt
      }
    )
    return record
  }

  /** Persist a new manual ordering: SortOrder = index in the given ID list. */
  reorder(orderedIds: string[]): void {
    transaction(() => {
      orderedIds.forEach((id, i) => {
        getDb().run('UPDATE Products SET SortOrder = :o WHERE ProductID = :id', { ':o': i, ':id': id } as never)
      })
    })
  }

  update(productID: string, input: UpdateProductInput): Product | undefined {
    const existing = this.findById(productID)
    if (!existing) return undefined

    const updated: Product = { ...existing, ...input, UpdatedAt: new Date().toISOString() }
    run(
      `UPDATE Products SET
         ImageKey        = :ImageKey,
         ImagePath       = :ImagePath,
         Cost_RMB        = :Cost_RMB,
         CompetitorPrice = :CompetitorPrice,
         StockQuantity   = :StockQuantity,
         LocalFolderPath = :LocalFolderPath,
         UpdatedAt       = :UpdatedAt
       WHERE ProductID = :ProductID`,
      {
        ':ImageKey': updated.ImageKey,
        ':ImagePath': updated.ImagePath,
        ':Cost_RMB': updated.Cost_RMB,
        ':CompetitorPrice': updated.CompetitorPrice,
        ':StockQuantity': updated.StockQuantity,
        ':LocalFolderPath': updated.LocalFolderPath,
        ':UpdatedAt': updated.UpdatedAt,
        ':ProductID': productID
      }
    )
    return updated
  }

  delete(productID: string): boolean {
    return run('DELETE FROM Products WHERE ProductID = :id', { ':id': productID }) > 0
  }

  /**
   * Re-key a product into a new category. The category is part of the PK, so we
   * insert a clone under a freshly-generated ID, re-point its mappings, then drop
   * the old row — all in one transaction so the user never sees a broken state.
   */
  recategorize(productID: string, newCategoryID: string): Product {
    const existing = this.findById(productID)
    if (!existing) throw new Error(`商品「${productID}」不存在。`)

    const cat = (newCategoryID || '000').padStart(3, '0')
    if (existing.CategoryID === cat) return existing // no-op

    const newID = this.nextProductID(cat)
    const now = new Date().toISOString()
    const db = getDb()

    transaction(() => {
      db.run(
        `INSERT INTO Products
           (ProductID, CategoryID, ImageKey, ImagePath, Cost_RMB, CompetitorPrice,
            StockQuantity, LocalFolderPath, SortOrder, CreatedAt, UpdatedAt)
         VALUES
           (:ProductID, :CategoryID, :ImageKey, :ImagePath, :Cost_RMB, :CompetitorPrice,
            :StockQuantity, :LocalFolderPath, :SortOrder, :CreatedAt, :UpdatedAt)`,
        {
          ':ProductID': newID,
          ':CategoryID': cat,
          ':ImageKey': existing.ImageKey,
          ':ImagePath': existing.ImagePath,
          ':Cost_RMB': existing.Cost_RMB,
          ':CompetitorPrice': existing.CompetitorPrice,
          ':StockQuantity': existing.StockQuantity,
          ':LocalFolderPath': existing.LocalFolderPath,
          ':SortOrder': existing.SortOrder,
          ':CreatedAt': existing.CreatedAt,
          ':UpdatedAt': now
        } as never
      )
      // Re-point mappings to the new ID BEFORE deleting the old row so the
      // ON DELETE CASCADE doesn't take them with it.
      db.run('UPDATE ProductPlatformMappings SET ProductID = :new WHERE ProductID = :old', {
        ':new': newID,
        ':old': productID
      } as never)
      db.run('DELETE FROM Products WHERE ProductID = :old', { ':old': productID } as never)
    })

    return { ...existing, ProductID: newID, CategoryID: cat, UpdatedAt: now }
  }
}
