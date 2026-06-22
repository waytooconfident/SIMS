// ─── ShopeeApiAdapter (PLACEHOLDER) ─────────────────────────────────────────
// When Shopee Open API integration is ready, implement IPlatformAdapter here.
// Replace ManualInputAdapter with this class in src/main/index.ts.
//
// Required credentials (store in Settings table, never in code):
//   shopee_partner_id, shopee_partner_key, shopee_shop_id, shopee_access_token
//
// API reference: https://open.shopee.com/documents
//
// Implementation checklist:
//   1. OAuth2 token refresh logic
//   2. GET /api/v2/product/get_item_list  → fetchListings()
//   3. POST /api/v2/product/add_item      → publishListing()
//   4. HMAC-SHA256 request signing
//
// ─────────────────────────────────────────────────────────────────────────────

import type { IPlatformAdapter } from '../core/interfaces/IPlatformAdapter'
import type { ProductPlatformMapping } from '@shared/types'

export class ShopeeApiAdapter implements IPlatformAdapter {
  readonly platformID = 'shopee'
  readonly platformName = '蝦皮'

  async fetchListings(_imageKey: string): Promise<Partial<ProductPlatformMapping>[]> {
    throw new Error('ShopeeApiAdapter is not yet implemented.')
  }

  async publishListing(
    _mapping: ProductPlatformMapping
  ): Promise<{ success: boolean; message: string }> {
    throw new Error('ShopeeApiAdapter is not yet implemented.')
  }
}
