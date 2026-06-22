import { useState, useCallback } from 'react'
import type { Category, CreateCategoryInput, UpdateCategoryInput } from '@shared/types'

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setCategories(await window.api.categories.getAll())
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  const create = useCallback(async (input: CreateCategoryInput) => {
    const c = await window.api.categories.create(input)
    setCategories((prev) => [...prev, c].sort((a, b) => a.CategoryID.localeCompare(b.CategoryID)))
    return c
  }, [])

  const update = useCallback(async (id: string, input: UpdateCategoryInput) => {
    const c = await window.api.categories.update(id, input)
    setCategories((prev) => prev.map((x) => (x.CategoryID === id ? c : x)))
    return c
  }, [])

  const remove = useCallback(async (id: string) => {
    await window.api.categories.delete(id)
    setCategories((prev) => prev.filter((x) => x.CategoryID !== id))
  }, [])

  /** "001 項鍊" style label; "000" maps to 未分類. */
  const nameOf = useCallback(
    (id: string) => categories.find((c) => c.CategoryID === id)?.CategoryName ?? '未分類',
    [categories]
  )

  return { categories, loading, error, load, create, update, remove, nameOf }
}
