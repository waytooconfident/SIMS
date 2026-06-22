import { create } from 'zustand'

interface ExchangeRateState {
  rate: number
  setRate: (rate: number) => void
  loadRate: () => Promise<void>
  saveRate: (rate: number) => Promise<void>
}

export const useExchangeRateStore = create<ExchangeRateState>((set) => ({
  rate: 4.45,

  setRate: (rate) => set({ rate }),

  loadRate: async () => {
    const val = await window.api.settings.get('exchangeRate')
    if (val !== null) set({ rate: parseFloat(val) })
  },

  saveRate: async (rate) => {
    await window.api.settings.set('exchangeRate', String(rate))
    set({ rate })
  }
}))
