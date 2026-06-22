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
  /** Create, OR if a record already exists for the same product+platform+day,
   *  merge into it (sum volume, volume-weighted average price). */
  createOrMergeDaily(input: CreateMappingInput): ProductPlatformMapping
  update(mappingID: string, input: UpdateMappingInput): ProductPlatformMapping | undefined
  /** Bulk-set title/description for every record of a product on a platform. */
  updateListing(productID: string, platformID: string, title: string, description: string): void
  /** Remove ALL records of a product on a platform (un-list it). Returns count removed. */
  deleteListing(productID: string, platformID: string): number
  delete(mappingID: string): boolean
  getAnalyticsSummary(filter: AnalyticsFilter): AnalyticsSummary[]
  getChartData(filter: AnalyticsFilter): ChartDataPoint[]
}
