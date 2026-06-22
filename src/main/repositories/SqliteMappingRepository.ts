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
import { MAPPINGS_WITH_CALC_SQL, ANALYTICS_SUMMARY_SQL, CHART_DATA_SQL } from '../database/schema'

// :platformID = null triggers the "IS NULL OR" branch, returning all platforms.
function toSqlParams(filter: AnalyticsFilter) {
  return {
    ':exchangeRate': filter.exchangeRate,
    ':startDate': filter.startDate,
    ':endDate': filter.endDate,
    ':platformID': filter.platformID ?? null,
    ':productID': filter.productID ?? null,
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
      DateRecorded: input.DateRecorded || new Date().toISOString(),
      PlatformTitle: input.PlatformTitle || '-',
      PlatformDescription: input.PlatformDescription || '-',
      SellingPrice: input.SellingPrice ?? 0,
      SalesVolume: input.SalesVolume ?? 0
    }
    run(
      `INSERT INTO ProductPlatformMappings
         (MappingID, ProductID, PlatformID, DateRecorded,
          PlatformTitle, PlatformDescription, SellingPrice, SalesVolume)
       VALUES
         (:MappingID, :ProductID, :PlatformID, :DateRecorded,
          :PlatformTitle, :PlatformDescription, :SellingPrice, :SalesVolume)`,
      {
        ':MappingID': record.MappingID,
        ':ProductID': record.ProductID,
        ':PlatformID': record.PlatformID,
        ':DateRecorded': record.DateRecorded,
        ':PlatformTitle': record.PlatformTitle,
        ':PlatformDescription': record.PlatformDescription,
        ':SellingPrice': record.SellingPrice,
        ':SalesVolume': record.SalesVolume
      }
    )
    return record
  }

  // Merge a sale into an existing same-day record for the same product+platform.
  // Volume is summed; price becomes the volume-weighted average so total revenue
  // stays correct. Title/description are only overwritten when meaningfully given.
  createOrMergeDaily(input: CreateMappingInput): ProductPlatformMapping {
    const day = (input.DateRecorded || new Date().toISOString()).slice(0, 10)
    const existing = stmtGet<ProductPlatformMapping>(
      `SELECT * FROM ProductPlatformMappings
       WHERE ProductID = :pid AND PlatformID = :plid AND DATE(DateRecorded) = :day
       LIMIT 1`,
      { ':pid': input.ProductID, ':plid': input.PlatformID, ':day': day }
    )
    if (!existing) return this.create(input)

    const addVol = input.SalesVolume ?? 0
    const newVol = existing.SalesVolume + addVol
    const newPrice =
      newVol > 0
        ? (existing.SellingPrice * existing.SalesVolume + (input.SellingPrice ?? 0) * addVol) / newVol
        : input.SellingPrice ?? existing.SellingPrice
    const title = input.PlatformTitle && input.PlatformTitle !== '-' ? input.PlatformTitle : existing.PlatformTitle
    const desc =
      input.PlatformDescription && input.PlatformDescription !== '-'
        ? input.PlatformDescription
        : existing.PlatformDescription

    return this.update(existing.MappingID, {
      SalesVolume: newVol,
      SellingPrice: newPrice,
      PlatformTitle: title,
      PlatformDescription: desc,
      DateRecorded: existing.DateRecorded
    })!
  }

  updateListing(productID: string, platformID: string, title: string, description: string): void {
    run(
      `UPDATE ProductPlatformMappings SET PlatformTitle = :t, PlatformDescription = :d
       WHERE ProductID = :pid AND PlatformID = :plid`,
      { ':t': title || '-', ':d': description || '-', ':pid': productID, ':plid': platformID }
    )
  }

  deleteListing(productID: string, platformID: string): number {
    return run('DELETE FROM ProductPlatformMappings WHERE ProductID = :pid AND PlatformID = :plid', {
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
