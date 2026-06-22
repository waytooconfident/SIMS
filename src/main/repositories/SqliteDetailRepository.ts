import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../database/DatabaseManager'
import { stmtAll, stmtGet, run, transaction } from '../database/sqlHelpers'
import type { ProductDetail, DetailCost, CreateDetailInput, UpdateDetailInput } from '@shared/types'

type DetailRow = Omit<ProductDetail, 'costs' | 'TotalCostNTD'>

// Variants of a product. Each detail owns several cost line-items (DetailCosts),
// each in any currency; the detail's NT$ cost is their currency-converted sum.
export class SqliteDetailRepository {
  private hydrate(row: DetailRow): ProductDetail {
    const costs = stmtAll<DetailCost>(
      'SELECT * FROM DetailCosts WHERE DetailID = :id ORDER BY SortOrder ASC',
      { ':id': row.DetailID }
    )
    const total = stmtGet<{ total: number }>(
      `SELECT COALESCE(SUM(dc.Amount * COALESCE(cur.RateToTWD, 1)), 0) AS total
       FROM DetailCosts dc LEFT JOIN Currencies cur ON cur.CurrencyCode = dc.CurrencyCode
       WHERE dc.DetailID = :id`,
      { ':id': row.DetailID }
    )
    return { ...row, costs, TotalCostNTD: total?.total ?? 0 }
  }

  findByProduct(productID: string): ProductDetail[] {
    const rows = stmtAll<DetailRow>(
      'SELECT * FROM ProductDetails WHERE ProductID = :pid ORDER BY SortOrder ASC, CreatedAt ASC',
      { ':pid': productID }
    )
    return rows.map((r) => this.hydrate(r))
  }

  /** All details across all products (used by the sales-records / analytics UIs). */
  findAll(): ProductDetail[] {
    const rows = stmtAll<DetailRow>('SELECT * FROM ProductDetails ORDER BY ProductID ASC, SortOrder ASC')
    return rows.map((r) => this.hydrate(r))
  }

  findById(detailID: string): ProductDetail | undefined {
    const row = stmtGet<DetailRow>('SELECT * FROM ProductDetails WHERE DetailID = :id', { ':id': detailID })
    return row ? this.hydrate(row) : undefined
  }

  private nextSortOrder(productID: string): number {
    const row = stmtGet<{ maxOrder: number | null }>(
      'SELECT MAX(SortOrder) AS maxOrder FROM ProductDetails WHERE ProductID = :pid',
      { ':pid': productID }
    )
    return (row?.maxOrder ?? -1) + 1
  }

  private insertCosts(detailID: string, costs: CreateDetailInput['costs']): void {
    const db = getDb()
    costs.forEach((c, i) => {
      db.run(
        `INSERT INTO DetailCosts (CostID, DetailID, CostName, Amount, CurrencyCode, SortOrder)
         VALUES (:id, :did, :name, :amt, :cur, :sort)`,
        { ':id': uuidv4(), ':did': detailID, ':name': c.CostName ?? '', ':amt': c.Amount ?? 0, ':cur': c.CurrencyCode || 'TWD', ':sort': i } as never
      )
    })
  }

  create(input: CreateDetailInput): ProductDetail {
    if (!input.DetailName?.trim()) throw new Error('細項名稱不能為空。')
    const now = new Date().toISOString()
    const detailID = uuidv4()
    const sort = this.nextSortOrder(input.ProductID)
    const db = getDb()
    transaction(() => {
      db.run(
        `INSERT INTO ProductDetails
           (DetailID, ProductID, DetailName, ImageKey, ImagePath, SellingPrice, StockQuantity, SortOrder, CreatedAt, UpdatedAt)
         VALUES (:id, :pid, :name, :ik, :ip, :price, :stock, :sort, :ca, :ua)`,
        {
          ':id': detailID, ':pid': input.ProductID, ':name': input.DetailName.trim(),
          ':ik': input.ImageKey ?? null, ':ip': input.ImagePath ?? null,
          ':price': input.SellingPrice ?? 0, ':stock': input.StockQuantity ?? 0,
          ':sort': sort, ':ca': now, ':ua': now
        } as never
      )
      this.insertCosts(detailID, input.costs ?? [])
    })
    return this.findById(detailID)!
  }

  update(detailID: string, input: UpdateDetailInput): ProductDetail {
    const existing = stmtGet<DetailRow>('SELECT * FROM ProductDetails WHERE DetailID = :id', { ':id': detailID })
    if (!existing) throw new Error('細項不存在。')
    const now = new Date().toISOString()
    const db = getDb()
    transaction(() => {
      db.run(
        `UPDATE ProductDetails SET
           DetailName    = :name,
           ImageKey      = :ik,
           ImagePath     = :ip,
           SellingPrice  = :price,
           StockQuantity = :stock,
           UpdatedAt     = :ua
         WHERE DetailID = :id`,
        {
          ':name': input.DetailName?.trim() || existing.DetailName,
          ':ik': input.ImageKey !== undefined ? input.ImageKey : existing.ImageKey,
          ':ip': input.ImagePath !== undefined ? input.ImagePath : existing.ImagePath,
          ':price': input.SellingPrice ?? existing.SellingPrice,
          ':stock': input.StockQuantity ?? existing.StockQuantity,
          ':ua': now, ':id': detailID
        } as never
      )
      if (input.costs) {
        db.run('DELETE FROM DetailCosts WHERE DetailID = :id', { ':id': detailID } as never)
        this.insertCosts(detailID, input.costs)
      }
    })
    return this.findById(detailID)!
  }

  delete(detailID: string): boolean {
    const db = getDb()
    let existed = false
    transaction(() => {
      existed = !!stmtGet('SELECT 1 FROM ProductDetails WHERE DetailID = :id', { ':id': detailID })
      // Explicitly remove children + sales records (the migrated DetailID column on
      // ProductPlatformMappings has no FK, so we can't rely on ON DELETE CASCADE).
      db.run('DELETE FROM ProductPlatformMappings WHERE DetailID = :id', { ':id': detailID } as never)
      db.run('DELETE FROM DetailCosts WHERE DetailID = :id', { ':id': detailID } as never)
      db.run('DELETE FROM ProductDetails WHERE DetailID = :id', { ':id': detailID } as never)
    })
    return existed
  }

  /** Set SortOrder = index for the given detail IDs (drag-reorder). */
  reorder(orderedIds: string[]): void {
    transaction(() => {
      const db = getDb()
      orderedIds.forEach((id, i) => {
        db.run('UPDATE ProductDetails SET SortOrder = :o WHERE DetailID = :id', { ':o': i, ':id': id } as never)
      })
    })
  }

  decrementStock(detailID: string, qty: number): void {
    const row = stmtGet<{ StockQuantity: number }>('SELECT StockQuantity FROM ProductDetails WHERE DetailID = :id', { ':id': detailID })
    if (!row) return
    run('UPDATE ProductDetails SET StockQuantity = :s WHERE DetailID = :id', {
      ':s': Math.max(0, row.StockQuantity - qty), ':id': detailID
    })
  }
}
