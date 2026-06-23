import { create } from 'zustand'
import type { TimePreset, AnalyticsFilter } from '@shared/types'

interface FilterState {
  timePreset: TimePreset
  platformID: string | null   // null = all platforms
  productID: string | null    // null = all products
  detailID: string | null     // null = product aggregate (all its details)
  categoryID: string | null   // null = all categories
  setTimePreset: (p: TimePreset) => void
  setPlatformID: (id: string | null) => void
  setProductID: (id: string | null) => void
  setDetail: (productID: string, detailID: string) => void
  setCategoryID: (id: string | null) => void
  buildFilter: () => AnalyticsFilter
}

function dateRangeForPreset(preset: TimePreset): { startDate: string; endDate: string } {
  const now = new Date()
  const end = now.toISOString()
  const daysAgo = (d: number) => {
    const dt = new Date(now)
    dt.setDate(dt.getDate() - d)
    return dt.toISOString()
  }
  const startDate =
    preset === 'today'  ? new Date(now.toDateString()).toISOString() :
    preset === '7d'     ? daysAgo(7) :
    preset === '30d'    ? daysAgo(30) :
    preset === '90d'    ? daysAgo(90) :
    preset === '180d'   ? daysAgo(180) :
    preset === '365d'   ? daysAgo(365) :
                          '1970-01-01T00:00:00.000Z'
  return { startDate, endDate: end }
}

export const useFilterStore = create<FilterState>((set, get) => ({
  timePreset: 'all',
  platformID: null,
  productID: null,
  detailID: null,
  categoryID: null,

  setTimePreset: (p) => set({ timePreset: p }),
  setPlatformID: (id) => set({ platformID: id }),
  // Selecting a specific product clears the category filter (and the detail).
  setProductID: (id) => set({ productID: id, detailID: null, categoryID: id ? null : get().categoryID }),
  // Drill into one detail of a product.
  setDetail: (productID, detailID) => set({ productID, detailID, categoryID: null }),
  setCategoryID: (id) => set({ categoryID: id, productID: id ? null : get().productID, detailID: null }),

  buildFilter: (): AnalyticsFilter => {
    const { timePreset, platformID, productID, detailID, categoryID } = get()
    const { startDate, endDate } = dateRangeForPreset(timePreset)
    return { platformID, productID, detailID, categoryID, startDate, endDate }
  }
}))
