import { useState, useCallback } from 'react'
import type { Platform, CreatePlatformInput, UpdatePlatformInput } from '@shared/types'

export function usePlatforms() {
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setPlatforms(await window.api.platforms.getAll())
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  const create = useCallback(async (input: CreatePlatformInput) => {
    const p = await window.api.platforms.create(input)
    setPlatforms((prev) => [...prev, p])
    return p
  }, [])

  const update = useCallback(async (id: string, input: UpdatePlatformInput) => {
    const p = await window.api.platforms.update(id, input)
    setPlatforms((prev) => prev.map((x) => (x.PlatformID === id ? p : x)))
    return p
  }, [])

  const remove = useCallback(async (id: string) => {
    await window.api.platforms.delete(id)
    setPlatforms((prev) => prev.filter((x) => x.PlatformID !== id))
  }, [])

  /** Total commission display, e.g. "6.5%" or "6.5% + NT$10". */
  const formatFee = (p: Platform) => {
    const pct = `${(p.TotalFeePercentage ?? 0).toFixed(1)}%`
    const fixed = p.TotalFixedFee ?? 0
    return fixed > 0 ? `${pct} + NT$${fixed}` : pct
  }

  return { platforms, loading, error, load, create, update, remove, formatFee }
}
