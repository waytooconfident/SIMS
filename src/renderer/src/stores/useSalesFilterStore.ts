import { create } from 'zustand'
import type { TimePreset, AnalyticsFilter } from '@shared/types'

// Independent filter state for the 銷售紀錄 (Sales Records) page. Kept separate
// from the analytics filter so the two pages don't interfere. The inventory
// "查看銷售紀錄" shortcut writes into this store before navigating here.
interface SalesFilterState {
  timePreset: TimePreset
  platformID: string | null
  productID: string | null
  categoryID: string | null
  setTimePreset: (p: TimePreset) => void
  setPlatformID: (id: string | null) => void
  setProductID: (id: string | null) => void
  setCategoryID: (id: string | null) => void
  /** Apply a whole filter at once (used by the inventory shortcut). */
  applyFrom: (f: { productID?: string | null; platformID?: string | null; categoryID?: string | null }) => void
  buildFilter: () => AnalyticsFilter
}

function rangeFor(preset: TimePreset): { startDate: string; endDate: string } {
  const now = new Date()
  const end = now.toISOString()
  const daysAgo = (d: number) => { const dt = new Date(now); dt.setDate(dt.getDate() - d); return dt.toISOString() }
  const startDate =
    preset === 'today' ? new Date(now.toDateString()).toISOString() :
    preset === '7d'    ? daysAgo(7) :
    preset === '30d'   ? daysAgo(30) :
    preset === '90d'   ? daysAgo(90) :
    preset === '180d'  ? daysAgo(180) :
    preset === '365d'  ? daysAgo(365) :
                         '1970-01-01T00:00:00.000Z'
  return { startDate, endDate: end }
}

export const useSalesFilterStore = create<SalesFilterState>((set, get) => ({
  timePreset: 'all',
  platformID: null,
  productID: null,
  categoryID: null,

  setTimePreset: (p) => set({ timePreset: p }),
  setPlatformID: (id) => set({ platformID: id }),
  setProductID: (id) => set({ productID: id }),
  setCategoryID: (id) => set({ categoryID: id }),
  applyFrom: (f) => set({
    productID: f.productID ?? null,
    platformID: f.platformID ?? null,
    categoryID: f.categoryID ?? null
  }),

  buildFilter: () => {
    const { timePreset, platformID, productID, categoryID } = get()
    const { startDate, endDate } = rangeFor(timePreset)
    return { platformID, productID, categoryID, startDate, endDate }
  }
}))
