import { useState, useCallback } from 'react'
import type { OrderWithCalc, AnalyticsFilter, CreateOrderInput } from '@shared/types'

// Loads orders (訂單) for the Sales Records page and exposes CRUD.
export function useOrders() {
  const [orders, setOrders] = useState<OrderWithCalc[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (filter: AnalyticsFilter) => {
    setLoading(true)
    setError(null)
    try {
      setOrders(await window.api.orders.getAll(filter))
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  const create = useCallback(async (input: CreateOrderInput) => window.api.orders.create(input), [])
  const update = useCallback(async (orderID: string, input: CreateOrderInput) => window.api.orders.update(orderID, input), [])
  const remove = useCallback(async (orderID: string) => { await window.api.orders.delete(orderID) }, [])

  return { orders, loading, error, load, create, update, remove }
}
