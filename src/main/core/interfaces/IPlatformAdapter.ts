import type { ProductPlatformMapping } from '@shared/types'

// Platform adapters abstract how mapping data is sourced.
// ManualInputAdapter: data comes from user input via the UI.
// Future ShopeeApiAdapter / CoupangApiAdapter: data pulled from platform APIs.
export interface IPlatformAdapter {
  readonly platformID: string
  readonly platformName: string

  /** Fetch the latest listings for a product from the platform. */
  fetchListings(imageKey: string): Promise<Partial<ProductPlatformMapping>[]>

  /** Push a listing to the platform (stub for API adapters). */
  publishListing(mapping: ProductPlatformMapping): Promise<{ success: boolean; message: string }>
}
