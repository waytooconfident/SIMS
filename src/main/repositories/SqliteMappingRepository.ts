import { v4 as uuidv4 } from 'uuid'
import { stmtAll, stmtGet, run } from '../database/sqlHelpers'
import type { IMappingRepository } from '../core/interfaces/IMappingRepository'
import type {
  ProductPlatformMapping,
  MappingWithCalc,
  AnalyticsSummary,
  ChartDataPoint,
  AnalyticsFilter,
  CreateMappingInput,
  UpdateMappingInput
} from '@shared/types'
import { MAPPINGS_WITH_CALC_SQL, ANALYTICS_SUMMARY_SQL, CHART_DATA_SQL, ORDER_EXTRA_COST_SQL } from '../database/schema'

// :platformID = null triggers the "IS NULL OR" branch, returning all platforms.
function toSqlParams(filter: AnalyticsFilter) {
  return {
    ':startDate': filter.startDate,
    ':endDate': filter.endDate,
    ':platformID': filter.platformID ?? null,
    ':productID': filter.productID ?? null,
    ':detailID': filter.detailID ?? null,
    ':categoryID': filter.categoryID ?? null
  }
}

export class SqliteMappingRepository implements IMappingRepository {
  findAll(filter: AnalyticsFilter): MappingWithCalc[] {
    return stmtAll(MAPPINGS_WITH_CALC_SQL, toSqlParams(filter))
  }

  findById(mappingID: string): ProductPlatformMapping | undefined {
    return stmtGet('SELECT * FROM ProductPlatformMappings WHERE MappingID = :id', { ':id': mappingID })
  }

  reassignProduct(oldProductID: string, newProductID: string): void {
    run('UPDATE ProductPlatformMappings SET ProductID = :new WHERE ProductID = :old', {
      ':new': newProductID,
      ':old': oldProductID
    })
  }

  create(input: CreateMappingInput): ProductPlatformMapping {
    const record: ProductPlatformMapping = {
      MappingID: uuidv4(),
      ProductID: input.ProductID,
      PlatformID: input.PlatformID,
      DetailID: input.DetailID ?? null,
      OrderID: input.OrderID ?? null,
      DateRecorded: input.DateRecorded || new Date().toISOString(),
      PlatformTitle: input.PlatformTitle || '-',
      PlatformDescription: input.PlatformDescription || '-',
      SellingPrice: input.SellingPrice ?? 0,
      CompetitorPrice: input.CompetitorPrice ?? null,
      SalesVolume: input.SalesVolume ?? 0
    }
    run(
      `INSERT INTO ProductPlatformMappings
         (MappingID, ProductID, PlatformID, DetailID, OrderID, DateRecorded,
          PlatformTitle, PlatformDescription, SellingPrice, CompetitorPrice, SalesVolume)
       VALUES
         (:MappingID, :ProductID, :PlatformID, :DetailID, :OrderID, :DateRecorded,
          :PlatformTitle, :PlatformDescription, :SellingPrice, :CompetitorPrice, :SalesVolume)`,
      {
        ':MappingID': record.MappingID,
        ':ProductID': record.ProductID,
        ':PlatformID': record.PlatformID,
        ':DetailID': record.DetailID,
        ':OrderID': record.OrderID,
        ':DateRecorded': record.DateRecorded,
        ':PlatformTitle': record.PlatformTitle,
        ':PlatformDescription': record.PlatformDescription,
        ':SellingPrice': record.SellingPrice,
        ':CompetitorPrice': record.CompetitorPrice,
        ':SalesVolume': record.SalesVolume
      }
    )
    return record
  }

  /** All listing rows (OrderID NULL) joined with platform name. */
  findListings(): (ProductPlatformMapping & { PlatformName: string })[] {
    return stmtAll(
      `SELECT ppm.*, pl.PlatformName
       FROM ProductPlatformMappings ppm
       JOIN Platforms pl ON pl.PlatformID = ppm.PlatformID
       WHERE ppm.OrderID IS NULL`
    )
  }

  /** Create a product×platform listing (OrderID NULL), or update it if it exists. */
  createOrUpdateListing(productID: string, platformID: string, title: string, description: string, price: number, competitorPrice: number | null): ProductPlatformMapping {
    const existing = stmtGet<ProductPlatformMapping>(
      `SELECT * FROM ProductPlatformMappings
       WHERE ProductID = :pid AND PlatformID = :plid AND OrderID IS NULL LIMIT 1`,
      { ':pid': productID, ':plid': platformID }
    )
    if (existing) {
      run(
        `UPDATE ProductPlatformMappings SET PlatformTitle = :t, PlatformDescription = :d, SellingPrice = :p, CompetitorPrice = :cp
         WHERE MappingID = :id`,
        { ':t': title || '-', ':d': description || '-', ':p': price || 0, ':cp': competitorPrice, ':id': existing.MappingID }
      )
      return { ...existing, PlatformTitle: title || '-', PlatformDescription: description || '-', SellingPrice: price || 0, CompetitorPrice: competitorPrice }
    }
    return this.create({
      ProductID: productID,
      PlatformID: platformID,
      DetailID: null,
      OrderID: null,
      DateRecorded: new Date().toISOString(),
      PlatformTitle: title || '-',
      PlatformDescription: description || '-',
      SellingPrice: price || 0,
      CompetitorPrice: competitorPrice,
      SalesVolume: 0
    })
  }

  updateListing(productID: string, platformID: string, title: string, description: string): void {
    run(
      `UPDATE ProductPlatformMappings SET PlatformTitle = :t, PlatformDescription = :d
       WHERE ProductID = :pid AND PlatformID = :plid AND OrderID IS NULL`,
      { ':t': title || '-', ':d': description || '-', ':pid': productID, ':plid': platformID }
    )
  }

  // Un-list a product from a platform: removes the listing row only. Sold lines
  // belong to orders and are not affected.
  deleteListing(productID: string, platformID: string): number {
    return run('DELETE FROM ProductPlatformMappings WHERE ProductID = :pid AND PlatformID = :plid AND OrderID IS NULL', {
      ':pid': productID,
      ':plid': platformID
    })
  }

  update(mappingID: string, input: UpdateMappingInput): ProductPlatformMapping | undefined {
    const existing = this.findById(mappingID)
    if (!existing) return undefined

    const updated: ProductPlatformMapping = { ...existing, ...input }
    run(
      `UPDATE ProductPlatformMappings SET
         DateRecorded        = :DateRecorded,
         PlatformTitle       = :PlatformTitle,
         PlatformDescription = :PlatformDescription,
         SellingPrice        = :SellingPrice,
         SalesVolume         = :SalesVolume
       WHERE MappingID = :MappingID`,
      {
        ':DateRecorded': updated.DateRecorded,
        ':PlatformTitle': updated.PlatformTitle,
        ':PlatformDescription': updated.PlatformDescription,
        ':SellingPrice': updated.SellingPrice,
        ':SalesVolume': updated.SalesVolume,
        ':MappingID': updated.MappingID
      }
    )
    return updated
  }

  delete(mappingID: string): boolean {
    return run('DELETE FROM ProductPlatformMappings WHERE MappingID = :id', { ':id': mappingID }) > 0
  }

  // ─── Analytics ─────────────────────────────────────────────────────────────

  getAnalyticsSummary(filter: AnalyticsFilter): AnalyticsSummary[] {
    return stmtAll(ANALYTICS_SUMMARY_SQL, toSqlParams(filter))
  }

  // Σ of all order-level extra costs (currency-converted) in the filter's range —
  // subtracted from the dashboard's overall earnings.
  getOrderExtraCostTotal(filter: AnalyticsFilter): number {
    const row = stmtGet<{ total: number }>(ORDER_EXTRA_COST_SQL, {
      ':startDate': filter.startDate,
      ':endDate': filter.endDate,
      ':platformID': filter.platformID ?? null
    })
    return row?.total ?? 0
  }

  // Pivot flat (date, platform, value) rows into {date, earnings_蝦皮, sales_蝦皮…}
  // so Recharts can render multiple series directly from the array.
  getChartData(filter: AnalyticsFilter): ChartDataPoint[] {
    type RawRow = {
      date: string
      PlatformID: string
      PlatformName: string
      dailySalesVolume: number
      dailyEarnings: number
    }
    const rows = stmtAll<RawRow>(CHART_DATA_SQL, toSqlParams(filter))

    const dateMap = new Map<string, ChartDataPoint>()
    for (const row of rows) {
      if (!dateMap.has(row.date)) dateMap.set(row.date, { date: row.date })
      const point = dateMap.get(row.date)!
      point[`earnings_${row.PlatformName}`] = row.dailyEarnings
      point[`sales_${row.PlatformName}`] = row.dailySalesVolume
    }
    return Array.from(dateMap.values())
  }
}
