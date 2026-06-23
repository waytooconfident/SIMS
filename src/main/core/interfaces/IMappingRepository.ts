import type {
  ProductPlatformMapping,
  MappingWithCalc,
  AnalyticsSummary,
  ChartDataPoint,
  AnalyticsFilter,
  CreateMappingInput,
  UpdateMappingInput
} from '@shared/types'

export interface IMappingRepository {
  findAll(filter: AnalyticsFilter): MappingWithCalc[]
  findById(mappingID: string): ProductPlatformMapping | undefined
  reassignProduct(oldProductID: string, newProductID: string): void
  create(input: CreateMappingInput): ProductPlatformMapping
  /** All listing rows (OrderID NULL) joined with platform name. */
  findListings(): (ProductPlatformMapping & { PlatformName: string })[]
  /** Create or update a product×platform listing (OrderID NULL). */
  createOrUpdateListing(productID: string, platformID: string, title: string, description: string, price: number, competitorPrice: number | null): ProductPlatformMapping
  update(mappingID: string, input: UpdateMappingInput): ProductPlatformMapping | undefined
  /** Set title/description for a product's listing on a platform. */
  updateListing(productID: string, platformID: string, title: string, description: string): void
  /** Remove a product's listing on a platform (un-list it). Returns count removed. */
  deleteListing(productID: string, platformID: string): number
  delete(mappingID: string): boolean
  getAnalyticsSummary(filter: AnalyticsFilter): AnalyticsSummary[]
  getChartData(filter: AnalyticsFilter): ChartDataPoint[]
  /** Σ of order-level extra costs (currency-converted) in the filter's range. */
  getOrderExtraCostTotal(filter: AnalyticsFilter): number
}
