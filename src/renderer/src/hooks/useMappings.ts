import { useState, useCallback } from 'react'
import type {
  MappingWithCalc,
  AnalyticsSummary,
  ChartDataPoint,
  AnalyticsFilter,
  CreateMappingInput,
  UpdateMappingInput
} from '@shared/types'

export function useMappings() {
  const [mappings, setMappings] = useState<MappingWithCalc[]>([])
  const [analytics, setAnalytics] = useState<AnalyticsSummary[]>([])
  const [chartData, setChartData] = useState<ChartDataPoint[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadMappings = useCallback(async (filter: AnalyticsFilter) => {
    setLoading(true)
    setError(null)
    try {
      const [m, a, c] = await Promise.all([
        window.api.mappings.getAll(filter),
        window.api.mappings.getAnalytics(filter),
        window.api.mappings.getChartData(filter)
      ])
      setMappings(m)
      setAnalytics(a)
      setChartData(c)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  const create = useCallback(async (input: CreateMappingInput) => {
    return await window.api.mappings.create(input)
  }, [])

  const update = useCallback(async (id: string, input: UpdateMappingInput) => {
    return await window.api.mappings.update(id, input)
  }, [])

  const remove = useCallback(async (id: string) => {
    await window.api.mappings.delete(id)
    setMappings((prev) => prev.filter((m) => m.MappingID !== id))
  }, [])

  // Totals per the user's formulas: 總收益 = Σ(NetProfit*Volume); 淨利率 = 總收益/總成本.
  const totalEarnings = analytics.reduce((s, r) => s + r.TotalEarnings, 0)
  const totalCost = analytics.reduce((s, r) => s + r.TotalCost, 0)
  const overallTotals = {
    totalEarnings,
    totalCost,
    totalSales: analytics.reduce((s, r) => s + r.TotalSalesVolume, 0),
    avgMargin: totalCost > 0 ? (totalEarnings / totalCost) * 100 : 0
  }

  return {
    mappings, analytics, chartData, loading, error, overallTotals,
    loadMappings, create, update, remove
  }
}
