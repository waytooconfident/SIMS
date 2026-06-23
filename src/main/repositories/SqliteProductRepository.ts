import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../database/DatabaseManager'
import { stmtAll, stmtGet, run, transaction } from '../database/sqlHelpers'
import type { IProductRepository } from '../core/interfaces/IProductRepository'
import type { Product, ProductCost, CreateProductInput, UpdateProductInput, ProductCostInput } from '@shared/types'

type ProductRow = Omit<Product, 'costs' | 'TotalCostNTD'>

function pad4(n: number): string {
  return String(n).padStart(4, '0')
}

export class SqliteProductRepository implements IProductRepository {
  // Attach a product's cost line-items + currency-converted NT$ total.
  private hydrate(row: ProductRow): Product {
    const costs = stmtAll<ProductCost>(
      'SELECT * FROM ProductCosts WHERE ProductID = :id ORDER BY SortOrder ASC',
      { ':id': row.ProductID }
    )
    const total = stmtGet<{ total: number }>(
      `SELECT COALESCE(SUM(pc.Amount * COALESCE(cur.RateToTWD, 1)), 0) AS total
       FROM ProductCosts pc LEFT JOIN Currencies cur ON cur.CurrencyCode = pc.CurrencyCode
       WHERE pc.ProductID = :id`,
      { ':id': row.ProductID }
    )
    return { ...row, costs, TotalCostNTD: total?.total ?? 0 }
  }

  findAll(): Product[] {
    const rows = stmtAll<ProductRow>('SELECT * FROM Products ORDER BY SortOrder ASC, ProductID ASC')
    return rows.map((r) => this.hydrate(r))
  }

  findById(productID: string): Product | undefined {
    const row = stmtGet<ProductRow>('SELECT * FROM Products WHERE ProductID = :id', { ':id': productID })
    return row ? this.hydrate(row) : undefined
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

  private insertCosts(productID: string, costs: ProductCostInput[]): void {
    const db = getDb()
    costs.forEach((c, i) => {
      db.run(
        `INSERT INTO ProductCosts (CostID, ProductID, CostName, Amount, CurrencyCode, SortOrder)
         VALUES (:id, :pid, :name, :amt, :cur, :sort)`,
        { ':id': uuidv4(), ':pid': productID, ':name': c.CostName ?? '', ':amt': c.Amount ?? 0, ':cur': c.CurrencyCode || 'TWD', ':sort': i } as never
      )
    })
  }

  create(input: CreateProductInput): Product {
    const now = new Date().toISOString()
    const categoryID = (input.CategoryID || '000').padStart(3, '0')
    const productID = this.nextProductID(categoryID)
    const sortOrder = this.nextSortOrder()
    const db = getDb()
    transaction(() => {
      db.run(
        `INSERT INTO Products
           (ProductID, CategoryID, ImageKey, ImagePath,
            StockQuantity, LocalFolderPath, SortOrder, CreatedAt, UpdatedAt)
         VALUES
           (:ProductID, :CategoryID, :ImageKey, :ImagePath,
            :StockQuantity, :LocalFolderPath, :SortOrder, :CreatedAt, :UpdatedAt)`,
        {
          ':ProductID': productID,
          ':CategoryID': categoryID,
          ':ImageKey': input.ImageKey ?? null,
          ':ImagePath': input.ImagePath ?? null,
          ':StockQuantity': input.StockQuantity ?? 0,
          ':LocalFolderPath': input.LocalFolderPath ?? null,
          ':SortOrder': sortOrder,
          ':CreatedAt': now,
          ':UpdatedAt': now
        } as never
      )
      this.insertCosts(productID, input.costs ?? [])
    })
    return this.findById(productID)!
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
    const existing = stmtGet<ProductRow>('SELECT * FROM Products WHERE ProductID = :id', { ':id': productID })
    if (!existing) return undefined

    const now = new Date().toISOString()
    const merged = { ...existing, ...input }
    const db = getDb()
    transaction(() => {
      db.run(
        `UPDATE Products SET
           ImageKey        = :ImageKey,
           ImagePath       = :ImagePath,
           StockQuantity   = :StockQuantity,
           LocalFolderPath = :LocalFolderPath,
           UpdatedAt       = :UpdatedAt
         WHERE ProductID = :ProductID`,
        {
          ':ImageKey': merged.ImageKey,
          ':ImagePath': merged.ImagePath,
          ':StockQuantity': merged.StockQuantity,
          ':LocalFolderPath': merged.LocalFolderPath,
          ':UpdatedAt': now,
          ':ProductID': productID
        } as never
      )
      if (input.costs) {
        db.run('DELETE FROM ProductCosts WHERE ProductID = :id', { ':id': productID } as never)
        this.insertCosts(productID, input.costs)
      }
    })
    return this.findById(productID)
  }

  delete(productID: string): boolean {
    return run('DELETE FROM Products WHERE ProductID = :id', { ':id': productID }) > 0
  }

  /**
   * Re-key a product into a new category. The category is part of the PK, so we
   * insert a clone under a freshly-generated ID, re-point its children (mappings,
   * details, costs), then drop the old row — all in one transaction.
   */
  recategorize(productID: string, newCategoryID: string): Product {
    const existing = stmtGet<ProductRow>('SELECT * FROM Products WHERE ProductID = :id', { ':id': productID })
    if (!existing) throw new Error(`商品「${productID}」不存在。`)

    const cat = (newCategoryID || '000').padStart(3, '0')
    if (existing.CategoryID === cat) return this.hydrate(existing) // no-op

    const newID = this.nextProductID(cat)
    const now = new Date().toISOString()
    const db = getDb()

    transaction(() => {
      db.run(
        `INSERT INTO Products
           (ProductID, CategoryID, ImageKey, ImagePath,
            StockQuantity, LocalFolderPath, SortOrder, CreatedAt, UpdatedAt)
         VALUES
           (:ProductID, :CategoryID, :ImageKey, :ImagePath,
            :StockQuantity, :LocalFolderPath, :SortOrder, :CreatedAt, :UpdatedAt)`,
        {
          ':ProductID': newID,
          ':CategoryID': cat,
          ':ImageKey': existing.ImageKey,
          ':ImagePath': existing.ImagePath,
          ':StockQuantity': existing.StockQuantity,
          ':LocalFolderPath': existing.LocalFolderPath,
          ':SortOrder': existing.SortOrder,
          ':CreatedAt': existing.CreatedAt,
          ':UpdatedAt': now
        } as never
      )
      // Re-point children to the new ID BEFORE deleting the old row so the
      // ON DELETE CASCADE doesn't take them with it.
      db.run('UPDATE ProductPlatformMappings SET ProductID = :new WHERE ProductID = :old', { ':new': newID, ':old': productID } as never)
      db.run('UPDATE ProductDetails SET ProductID = :new WHERE ProductID = :old', { ':new': newID, ':old': productID } as never)
      db.run('UPDATE ProductCosts SET ProductID = :new WHERE ProductID = :old', { ':new': newID, ':old': productID } as never)
      db.run('DELETE FROM Products WHERE ProductID = :old', { ':old': productID } as never)
    })

    return this.findById(newID)!
  }
}
