import type { IPlatformAdapter } from '../core/interfaces/IPlatformAdapter'
import type { ProductPlatformMapping } from '@shared/types'

// ManualInputAdapter: the user is the data source.
// All listings are entered through the PIMS UI — no API calls made.
// This is the default adapter for all three pre-seeded platforms.
export class ManualInputAdapter implements IPlatformAdapter {
  constructor(
    public readonly platformID: string,
    public readonly platformName: string
  ) {}

  async fetchListings(_imageKey: string): Promise<Partial<ProductPlatformMapping>[]> {
    // No automated source — return empty; data comes from the UI.
    return []
  }

  async publishListing(
    _mapping: ProductPlatformMapping
  ): Promise<{ success: boolean; message: string }> {
    return {
      success: false,
      message: `${this.platformName} 目前為手動模式，請至平台官網手動上架。`
    }
  }
}
