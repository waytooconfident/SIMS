import { useState, useCallback } from 'react'
import type { Product, CreateProductInput, UpdateProductInput } from '@shared/types'

const byId = (a: Product, b: Product) => a.ProductID.localeCompare(b.ProductID)

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setProducts(await window.api.products.getAll())
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  const create = useCallback(async (input: CreateProductInput) => {
    const p = await window.api.products.create(input)
    setProducts((prev) => [...prev, p].sort(byId))
    return p
  }, [])

  // Update may re-key the product (when its category changes), so we reload from
  // the returned record by ProductID and drop any stale row.
  const update = useCallback(async (productID: string, input: UpdateProductInput) => {
    const p = await window.api.products.update(productID, input)
    setProducts((prev) => [...prev.filter((x) => x.ProductID !== productID && x.ProductID !== p.ProductID), p].sort(byId))
    return p
  }, [])

  const remove = useCallback(async (productID: string) => {
    // Optimistically drop the row, then re-sync from the DB so the list always
    // reflects the authoritative state (deletes also cascade to its mappings).
    setProducts((prev) => prev.filter((x) => x.ProductID !== productID))
    await window.api.products.delete(productID)
    setProducts(await window.api.products.getAll())
  }, [])

  // Move draggedId to where targetId currently is, persisting the new SortOrder.
  const reorder = useCallback(async (draggedId: string, targetId: string) => {
    if (draggedId === targetId) return
    let nextIds: string[] = []
    setProducts((prev) => {
      const arr = [...prev]
      const from = arr.findIndex((p) => p.ProductID === draggedId)
      const to = arr.findIndex((p) => p.ProductID === targetId)
      if (from < 0 || to < 0) return prev
      const [moved] = arr.splice(from, 1)
      arr.splice(to, 0, moved)
      nextIds = arr.map((p) => p.ProductID)
      return arr
    })
    if (nextIds.length) await window.api.products.reorder(nextIds)
  }, [])

  return { products, loading, error, load, create, update, remove, reorder }
}
