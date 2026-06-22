import type { Product, CreateProductInput, UpdateProductInput } from '@shared/types'

// Swap out SqliteProductRepository for any other storage without touching Services.
export interface IProductRepository {
  findAll(): Product[]
  findById(productID: string): Product | undefined
  create(input: CreateProductInput): Product
  update(productID: string, input: UpdateProductInput): Product | undefined
  delete(productID: string): boolean
  /** Persist a manual ordering (SortOrder follows the given ID list). */
  reorder(orderedIds: string[]): void
  /** Compute the next free ProductID for a category ("0010001" style). */
  nextProductID(categoryID: string): string
  /**
   * Move a product to a different category. Because the category is baked into
   * the ProductID, this re-keys the row to a new ID, re-points its mappings, and
   * deletes the old row — all transparently. Returns the new product.
   */
  recategorize(productID: string, newCategoryID: string): Product
}
