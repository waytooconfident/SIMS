import type { IProductRepository } from '../interfaces/IProductRepository'
import type { IPlatformRepository, IPlatformFeeRepository } from '../interfaces/IPlatformRepository'
import type { IMappingRepository } from '../interfaces/IMappingRepository'
import type { ICategoryRepository } from '../interfaces/ICategoryRepository'
import type { SqliteDetailRepository } from '../../repositories/SqliteDetailRepository'
import type {
  Product,
  Platform,
  PlatformFee,
  Category,
  ProductPlatformMapping,
  CreateProductInput,
  UpdateProductInput,
  CreatePlatformInput,
  UpdatePlatformInput,
  CreatePlatformFeeInput,
  UpdatePlatformFeeInput,
  CreateCategoryInput,
  UpdateCategoryInput,
  CreateMappingInput,
  UpdateMappingInput,
  SellInput
} from '@shared/types'

// InventoryService coordinates CRUD across the repositories.
// It holds no SQL — persistence is delegated entirely to the repositories.
export class InventoryService {
  constructor(
    private readonly products: IProductRepository,
    private readonly platforms: IPlatformRepository,
    private readonly mappings: IMappingRepository,
    private readonly categories: ICategoryRepository,
    private readonly platformFees: IPlatformFeeRepository,
    private readonly details: SqliteDetailRepository
  ) {}

  // ─── Product details (變體) ──────────────────────────────────────────────────

  getDetailsByProduct(productID: string) {
    return this.details.findByProduct(productID)
  }
  getAllDetails() {
    return this.details.findAll()
  }
  createDetail(input: import('@shared/types').CreateDetailInput) {
    if (!this.products.findById(input.ProductID)) throw new Error(`商品「${input.ProductID}」不存在。`)
    return this.details.create(input)
  }
  updateDetail(detailID: string, input: import('@shared/types').UpdateDetailInput) {
    return this.details.update(detailID, input)
  }
  deleteDetail(detailID: string): void {
    this.details.delete(detailID)
  }
  reorderDetails(orderedIds: string[]): void {
    this.details.reorder(orderedIds)
  }

  // ─── Categories ────────────────────────────────────────────────────────────

  getAllCategories(): Category[] {
    return this.categories.findAll()
  }

  createCategory(input: CreateCategoryInput): Category {
    if (!input.CategoryName?.trim()) throw new Error('分類名稱不能為空。')
    return this.categories.create({ CategoryName: input.CategoryName.trim() })
  }

  updateCategory(categoryID: string, input: UpdateCategoryInput): Category {
    if (!input.CategoryName?.trim()) throw new Error('分類名稱不能為空。')
    const result = this.categories.update(categoryID, { CategoryName: input.CategoryName.trim() })
    if (!result) throw new Error(`分類「${categoryID}」不存在。`)
    return result
  }

  deleteCategory(categoryID: string): void {
    // Move any products in this category back to 未分類 (000) before removing it.
    const affected = this.products.findAll().filter((p) => p.CategoryID === categoryID)
    for (const p of affected) this.recategorizeProduct(p.ProductID, '000')
    if (!this.categories.delete(categoryID)) throw new Error(`分類「${categoryID}」不存在。`)
  }

  // ─── Products ──────────────────────────────────────────────────────────────

  getAllProducts(): Product[] {
    return this.products.findAll()
  }

  createProduct(input: CreateProductInput): Product {
    const categoryID = (input.CategoryID || '000').padStart(3, '0')
    if (!this.categories.findById(categoryID)) throw new Error(`分類「${categoryID}」不存在。`)
    return this.products.create({ ...input, CategoryID: categoryID })
  }

  updateProduct(productID: string, input: UpdateProductInput): Product {
    // If the category changed, this is a re-key operation, not a plain update.
    if (input.CategoryID !== undefined) {
      const existing = this.products.findById(productID)
      if (!existing) throw new Error(`商品「${productID}」不存在。`)
      const newCat = (input.CategoryID || '000').padStart(3, '0')
      if (newCat !== existing.CategoryID) {
        const recoded = this.recategorizeProduct(productID, newCat)
        // Apply any remaining field edits to the new row.
        const { CategoryID: _omit, ...rest } = input
        return Object.keys(rest).length
          ? this.updateProduct(recoded.ProductID, rest)
          : recoded
      }
    }
    const result = this.products.update(productID, input)
    if (!result) throw new Error(`商品「${productID}」不存在。`)
    return result
  }

  /** Transparent re-key: copy to a new category-correct ID, repoint mappings, drop old. */
  recategorizeProduct(productID: string, newCategoryID: string): Product {
    if (!this.categories.findById(newCategoryID)) throw new Error(`分類「${newCategoryID}」不存在。`)
    return this.products.recategorize(productID, newCategoryID)
  }

  deleteProduct(productID: string): void {
    if (!this.products.delete(productID)) throw new Error(`商品「${productID}」不存在。`)
  }

  reorderProducts(orderedIds: string[]): void {
    this.products.reorder(orderedIds)
  }

  /** Un-list a product from a platform (removes all its records there). */
  deleteListing(productID: string, platformID: string): void {
    this.mappings.deleteListing(productID, platformID)
  }

  // ─── Platforms & fees ────────────────────────────────────────────────────────

  getAllPlatforms(): Platform[] {
    return this.platforms.findAll()
  }

  createPlatform(input: CreatePlatformInput): Platform {
    if (!input.PlatformName?.trim()) throw new Error('平台名稱不能為空。')
    return this.platforms.create(input)
  }

  updatePlatform(platformID: string, input: UpdatePlatformInput): Platform {
    const result = this.platforms.update(platformID, input)
    if (!result) throw new Error(`平台「${platformID}」不存在。`)
    return result
  }

  deletePlatform(platformID: string): void {
    if (!this.platforms.delete(platformID)) throw new Error(`平台「${platformID}」不存在。`)
  }

  getPlatformFees(platformID: string): PlatformFee[] {
    return this.platformFees.findByPlatform(platformID)
  }

  createPlatformFee(input: CreatePlatformFeeInput): PlatformFee {
    if (!input.FeeName?.trim()) throw new Error('抽成項目名稱不能為空。')
    return this.platformFees.create({ ...input, FeeName: input.FeeName.trim() })
  }

  updatePlatformFee(feeID: string, input: UpdatePlatformFeeInput): PlatformFee {
    const result = this.platformFees.update(feeID, input)
    if (!result) throw new Error(`抽成項目「${feeID}」不存在。`)
    return result
  }

  deletePlatformFee(feeID: string): void {
    if (!this.platformFees.delete(feeID)) throw new Error(`抽成項目「${feeID}」不存在。`)
  }

  // ─── Mappings ──────────────────────────────────────────────────────────────

  createMapping(input: CreateMappingInput): ProductPlatformMapping {
    if (!this.products.findById(input.ProductID)) throw new Error(`商品「${input.ProductID}」不存在。`)
    if (!this.platforms.findById(input.PlatformID)) throw new Error(`平台「${input.PlatformID}」不存在。`)
    // Same day + product + platform records are merged into one (per spec).
    return this.mappings.createOrMergeDaily(input)
  }

  /** Edit the title/description of a product's listing on one platform (bulk). */
  updateListing(productID: string, platformID: string, title: string, description: string): void {
    this.mappings.updateListing(productID, platformID, title, description)
  }

  updateMapping(mappingID: string, input: UpdateMappingInput): ProductPlatformMapping {
    const result = this.mappings.update(mappingID, input)
    if (!result) throw new Error(`紀錄「${mappingID}」不存在。`)
    return result
  }

  deleteMapping(mappingID: string): void {
    if (!this.mappings.delete(mappingID)) throw new Error(`紀錄「${mappingID}」不存在。`)
  }

  // ─── Sell (record a sale) ────────────────────────────────────────────────────
  // Appends a dated sales record on the chosen platform and decrements stock.
  // Returns the refreshed product so the UI can update the stock badge.
  sellProduct(input: SellInput): { product: Product; mappings: ProductPlatformMapping[] } {
    const product = this.products.findById(input.productID)
    if (!product) throw new Error(`商品「${input.productID}」不存在。`)
    if (!this.platforms.findById(input.platformID)) throw new Error(`平台「${input.platformID}」不存在。`)
    const date = input.date || new Date().toISOString()

    // Detail-level sale: one record per selected variant (sold together), each
    // tagged with its DetailID. Stock is decremented on the detail, not the product.
    if (input.details && input.details.length > 0) {
      const created: ProductPlatformMapping[] = []
      for (const d of input.details) {
        if (d.quantity <= 0) continue
        const m = this.mappings.createOrMergeDaily({
          ProductID: input.productID,
          PlatformID: input.platformID,
          DetailID: d.detailID,
          DateRecorded: date,
          PlatformTitle: '-',
          PlatformDescription: '-',
          SellingPrice: d.sellingPrice ?? 0,
          SalesVolume: d.quantity
        })
        this.details.decrementStock(d.detailID, d.quantity)
        created.push(m)
      }
      if (created.length === 0) throw new Error('請至少選擇一個細項並填入賣出數量。')
      return { product: this.products.findById(input.productID)!, mappings: created }
    }

    // Product-level sale (product has no details).
    const qty = input.quantity ?? 0
    if (qty <= 0) throw new Error('賣出數量需大於 0。')
    const mapping = this.mappings.createOrMergeDaily({
      ProductID: input.productID,
      PlatformID: input.platformID,
      DetailID: null,
      DateRecorded: date,
      PlatformTitle: '-',
      PlatformDescription: '-',
      SellingPrice: input.sellingPrice ?? 0,
      SalesVolume: qty
    })
    const newStock = Math.max(0, product.StockQuantity - qty)
    const updated = this.products.update(input.productID, { StockQuantity: newStock })!
    return { product: updated, mappings: [mapping] }
  }
}
