import { useState, useCallback } from 'react'
import type { ProductDetail } from '@shared/types'

// Loads ALL product details once and indexes them by ProductID, for the
// inventory aggregate rows and the analytics dropdown.
export function useDetails() {
  const [details, setDetails] = useState<ProductDetail[]>([])

  const load = useCallback(async () => {
    setDetails(await window.api.details.getAll())
  }, [])

  const byProduct = useCallback(
    (productID: string) => details.filter((d) => d.ProductID === productID),
    [details]
  )

  return { details, load, byProduct }
}
