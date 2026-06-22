import { useState, useCallback } from 'react'
import type { Currency, CreateCurrencyInput, UpdateCurrencyInput } from '@shared/types'

export function useCurrencies() {
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setCurrencies(await window.api.currencies.getAll())
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  const create = useCallback(async (input: CreateCurrencyInput) => {
    const c = await window.api.currencies.create(input)
    setCurrencies((prev) => [...prev, c].sort((a, b) => a.SortOrder - b.SortOrder))
    return c
  }, [])

  const update = useCallback(async (code: string, input: UpdateCurrencyInput) => {
    const c = await window.api.currencies.update(code, input)
    setCurrencies((prev) => prev.map((x) => (x.CurrencyCode === code ? c : x)))
    return c
  }, [])

  const remove = useCallback(async (code: string) => {
    await window.api.currencies.delete(code)
    setCurrencies((prev) => prev.filter((x) => x.CurrencyCode !== code))
  }, [])

  /** NT$ value of `amount` given in `code` (falls back to 1:1 if unknown). */
  const toTWD = useCallback(
    (amount: number, code: string) => amount * (currencies.find((c) => c.CurrencyCode === code)?.RateToTWD ?? 1),
    [currencies]
  )

  return { currencies, loading, error, load, create, update, remove, toTWD }
}
