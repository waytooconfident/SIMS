import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../database/DatabaseManager'
import { stmtAll, stmtGet, transaction } from '../database/sqlHelpers'
import { ITEMS_BY_ORDER_SQL, MAPPINGS_WITH_CALC_SQL } from '../database/schema'
import type {
  Order,
  OrderCost,
  OrderItemInput,
  OrderItemWithCalc,
  OrderWithCalc,
  CreateOrderInput,
  AnalyticsFilter
} from '@shared/types'

// An order = a sale on one platform/date holding several sold line-items (stored
// as ProductPlatformMappings with OrderID set) plus order-specific extra costs.
// Stock is decremented when an order is created and restored when it is removed.
export class SqliteOrderRepository {
  private adjustStock(item: { productID?: string; ProductID?: string; detailID?: string | null; DetailID?: string | null }, qty: number, sign: number): void {
    const db = getDb()
    const detailID = item.detailID ?? item.DetailID ?? null
    const productID = item.productID ?? item.ProductID
    if (detailID) {
      db.run('UPDATE ProductDetails SET StockQuantity = MAX(0, StockQuantity + :d) WHERE DetailID = :id', { ':d': sign * qty, ':id': detailID } as never)
    } else if (productID) {
      db.run('UPDATE Products SET StockQuantity = MAX(0, StockQuantity + :d) WHERE ProductID = :id', { ':d': sign * qty, ':id': productID } as never)
    }
  }

  private insertItem(orderID: string, platformID: string, date: string, item: OrderItemInput): void {
    getDb().run(
      `INSERT INTO ProductPlatformMappings
         (MappingID, ProductID, PlatformID, DetailID, OrderID, DateRecorded,
          PlatformTitle, PlatformDescription, SellingPrice, SalesVolume)
       VALUES (:id, :pid, :plid, :did, :oid, :date, '-', '-', :price, :vol)`,
      {
        ':id': uuidv4(), ':pid': item.productID, ':plid': platformID, ':did': item.detailID ?? null,
        ':oid': orderID, ':date': date, ':price': item.sellingPrice ?? 0, ':vol': item.quantity ?? 0
      } as never
    )
  }

  private insertCosts(orderID: string, costs: CreateOrderInput['extraCosts']): void {
    const db = getDb()
    ;(costs ?? []).forEach((c, i) => {
      db.run(
        `INSERT INTO OrderCosts (CostID, OrderID, CostName, Amount, CurrencyCode, SortOrder)
         VALUES (:id, :oid, :name, :amt, :cur, :sort)`,
        { ':id': uuidv4(), ':oid': orderID, ':name': c.CostName ?? '', ':amt': c.Amount ?? 0, ':cur': c.CurrencyCode || 'TWD', ':sort': i } as never
      )
    })
  }

  findById(orderID: string): OrderWithCalc | undefined {
    const order = stmtGet<Order & { PlatformName: string }>(
      `SELECT o.*, pl.PlatformName FROM Orders o JOIN Platforms pl ON pl.PlatformID = o.PlatformID
       WHERE o.OrderID = :id`,
      { ':id': orderID }
    )
    if (!order) return undefined

    const items = stmtAll<OrderItemWithCalc>(ITEMS_BY_ORDER_SQL, { ':orderID': orderID })
    const extraCosts = stmtAll<OrderCost>('SELECT * FROM OrderCosts WHERE OrderID = :id ORDER BY SortOrder ASC', { ':id': orderID })
    const totalExtra = stmtGet<{ total: number }>(
      `SELECT COALESCE(SUM(oc.Amount * COALESCE(cur.RateToTWD, 1)), 0) AS total
       FROM OrderCosts oc LEFT JOIN Currencies cur ON cur.CurrencyCode = oc.CurrencyCode
       WHERE oc.OrderID = :id`,
      { ':id': orderID }
    )?.total ?? 0

    const itemsEarnings = items.reduce((s, i) => s + i.TotalEarnings, 0)
    const grossRevenue = items.reduce((s, i) => s + i.GrossRevenue, 0)
    const totalVolume = items.reduce((s, i) => s + i.SalesVolume, 0)

    return {
      ...order,
      items,
      extraCosts,
      TotalExtraCostNTD: totalExtra,
      GrossRevenue: grossRevenue,
      ItemsEarnings: itemsEarnings,
      NetEarnings: itemsEarnings - totalExtra,
      TotalVolume: totalVolume
    }
  }

  // Orders matching the filter, newest first. An order matches when at least one
  // of its sold lines passes the filter (date / platform / product / detail /
  // category); the returned order still carries ALL of its items for accurate totals.
  findAll(filter: AnalyticsFilter): OrderWithCalc[] {
    const matching = stmtAll<{ OrderID: string | null }>(MAPPINGS_WITH_CALC_SQL, {
      ':startDate': filter.startDate,
      ':endDate': filter.endDate,
      ':platformID': filter.platformID ?? null,
      ':productID': filter.productID ?? null,
      ':detailID': filter.detailID ?? null,
      ':categoryID': filter.categoryID ?? null
    })
    const orderIds: string[] = []
    const seen = new Set<string>()
    for (const r of matching) {
      if (r.OrderID && !seen.has(r.OrderID)) { seen.add(r.OrderID); orderIds.push(r.OrderID) }
    }
    return orderIds
      .map((id) => this.findById(id))
      .filter((o): o is OrderWithCalc => !!o)
      .sort((a, b) => b.DateRecorded.localeCompare(a.DateRecorded))
  }

  create(input: CreateOrderInput): OrderWithCalc {
    const orderID = uuidv4()
    const now = new Date().toISOString()
    const date = input.date || now
    const items = (input.items ?? []).filter((i) => i.productID && (i.quantity ?? 0) > 0)
    if (items.length === 0) throw new Error('訂單至少需要一個銷售商品。')

    transaction(() => {
      getDb().run(
        `INSERT INTO Orders (OrderID, PlatformID, DateRecorded, Note, CreatedAt)
         VALUES (:id, :plid, :date, :note, :ca)`,
        { ':id': orderID, ':plid': input.platformID, ':date': date, ':note': input.note ?? '', ':ca': now } as never
      )
      for (const item of items) {
        this.insertItem(orderID, input.platformID, date, item)
        this.adjustStock(item, item.quantity, -1)
      }
      this.insertCosts(orderID, input.extraCosts)
    })
    return this.findById(orderID)!
  }

  update(orderID: string, input: CreateOrderInput): OrderWithCalc {
    const existing = this.findById(orderID)
    if (!existing) throw new Error(`訂單「${orderID}」不存在。`)
    const date = input.date || existing.DateRecorded
    const items = (input.items ?? []).filter((i) => i.productID && (i.quantity ?? 0) > 0)
    if (items.length === 0) throw new Error('訂單至少需要一個銷售商品。')

    transaction(() => {
      const db = getDb()
      // Restore stock from the old items, then wipe them.
      for (const old of existing.items) this.adjustStock(old, old.SalesVolume, +1)
      db.run('DELETE FROM ProductPlatformMappings WHERE OrderID = :id', { ':id': orderID } as never)
      db.run('DELETE FROM OrderCosts WHERE OrderID = :id', { ':id': orderID } as never)
      db.run('UPDATE Orders SET PlatformID = :plid, DateRecorded = :date, Note = :note WHERE OrderID = :id',
        { ':plid': input.platformID, ':date': date, ':note': input.note ?? '', ':id': orderID } as never)
      // Re-create items + costs and re-decrement stock.
      for (const item of items) {
        this.insertItem(orderID, input.platformID, date, item)
        this.adjustStock(item, item.quantity, -1)
      }
      this.insertCosts(orderID, input.extraCosts)
    })
    return this.findById(orderID)!
  }

  delete(orderID: string): boolean {
    const existing = this.findById(orderID)
    if (!existing) return false
    transaction(() => {
      const db = getDb()
      for (const item of existing.items) this.adjustStock(item, item.SalesVolume, +1)
      // ON DELETE CASCADE removes the order's mappings and extra costs.
      db.run('DELETE FROM Orders WHERE OrderID = :id', { ':id': orderID } as never)
    })
    return true
  }
}
