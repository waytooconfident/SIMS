import type { SqliteOrderRepository } from '../../repositories/SqliteOrderRepository'
import type { IProductRepository } from '../interfaces/IProductRepository'
import type { IPlatformRepository } from '../interfaces/IPlatformRepository'
import type { AnalyticsFilter, CreateOrderInput, OrderWithCalc } from '@shared/types'

// Coordinates order (訂單) CRUD: validates platform/products then delegates to the
// repository, which handles stock adjustment and per-line persistence.
export class OrderService {
  constructor(
    private readonly orders: SqliteOrderRepository,
    private readonly products: IProductRepository,
    private readonly platforms: IPlatformRepository
  ) {}

  getOrders(filter: AnalyticsFilter): OrderWithCalc[] {
    return this.orders.findAll(filter)
  }

  private validate(input: CreateOrderInput): void {
    if (!this.platforms.findById(input.platformID)) throw new Error(`平台「${input.platformID}」不存在。`)
    const items = (input.items ?? []).filter((i) => i.productID && (i.quantity ?? 0) > 0)
    if (items.length === 0) throw new Error('訂單至少需要一個銷售商品。')
    for (const i of items) {
      if (!this.products.findById(i.productID)) throw new Error(`商品「${i.productID}」不存在。`)
    }
  }

  createOrder(input: CreateOrderInput): OrderWithCalc {
    this.validate(input)
    return this.orders.create(input)
  }

  updateOrder(orderID: string, input: CreateOrderInput): OrderWithCalc {
    this.validate(input)
    return this.orders.update(orderID, input)
  }

  deleteOrder(orderID: string): void {
    if (!this.orders.delete(orderID)) throw new Error(`訂單「${orderID}」不存在。`)
  }
}
