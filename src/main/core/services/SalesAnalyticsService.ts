import type { IMappingRepository } from '../interfaces/IMappingRepository'
import type { AnalyticsFilter, AnalyticsSummary, ChartDataPoint, MappingWithCalc, TimePreset } from '@shared/types'

// SalesAnalyticsService translates UI filter choices into concrete date ranges
// and delegates all heavy SQL work to the mapping repository.
// Exchange rate is passed in at call time — never cached — so values stay live.
export class SalesAnalyticsService {
  constructor(private readonly mappings: IMappingRepository) {}

  /** Convert a TimePreset enum into an ISO date range ending now. */
  static buildDateRange(preset: TimePreset): { startDate: string; endDate: string } {
    const now = new Date()
    const end = now.toISOString()

    const daysAgo = (d: number) => {
      const dt = new Date(now)
      dt.setDate(dt.getDate() - d)
      return dt.toISOString()
    }

    const startDate =
      preset === 'today'   ? new Date(now.toDateString()).toISOString() :
      preset === '7d'      ? daysAgo(7) :
      preset === '30d'     ? daysAgo(30) :
      preset === '90d'     ? daysAgo(90) :
      preset === '180d'    ? daysAgo(180) :
      preset === '365d'    ? daysAgo(365) :
      /* 'all' */            '1970-01-01T00:00:00.000Z'

    return { startDate, endDate: end }
  }

  getMappingsWithCalc(filter: AnalyticsFilter): MappingWithCalc[] {
    return this.mappings.findAll(filter)
  }

  getAnalyticsSummary(filter: AnalyticsFilter): AnalyticsSummary[] {
    return this.mappings.getAnalyticsSummary(filter)
  }

  getChartData(filter: AnalyticsFilter): ChartDataPoint[] {
    return this.mappings.getChartData(filter)
  }

  getOrderExtraCostTotal(filter: AnalyticsFilter): number {
    return this.mappings.getOrderExtraCostTotal(filter)
  }

  /** Aggregate totals across all rows for a dashboard overview. */
  getOverallTotals(summaries: AnalyticsSummary[]) {
    const totalEarnings = summaries.reduce((s, r) => s + r.TotalEarnings, 0)
    const totalCost = summaries.reduce((s, r) => s + r.TotalCost, 0)
    const totalSales = summaries.reduce((s, r) => s + r.TotalSalesVolume, 0)
    const avgMargin = totalCost > 0 ? (totalEarnings / totalCost) * 100 : 0

    return { totalEarnings, totalCost, totalSales, avgMargin }
  }
}
