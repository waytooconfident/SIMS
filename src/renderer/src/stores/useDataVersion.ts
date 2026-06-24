import { create } from 'zustand'

// A simple global "something changed, please refetch" signal. The floating order
// panel bumps it after creating a sale so whichever views are mounted (inventory,
// sales records) reload their data — stock, mappings and orders stay in sync.
export const useDataVersion = create<{ version: number; bump: () => void }>((set) => ({
  version: 0,
  bump: () => set((s) => ({ version: s.version + 1 }))
}))
