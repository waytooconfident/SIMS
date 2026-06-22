import { useEffect } from 'react'
import { usePlatforms } from '../hooks/usePlatforms'
import { useProducts } from '../hooks/useProducts'
import { useCategories } from '../hooks/useCategories'
import { useExchangeRateStore } from '../stores/useExchangeRateStore'
import { ComparePanel } from '../components/analytics/ComparePanel'
import type { TimePreset } from '@shared/types'

// Rendered in a dedicated BrowserWindow (second monitor). Reads its initial
// selection from the URL hash: "#popout?platform=..&product=..&category=..&time=..".
function parseParams() {
  const hash = window.location.hash.replace(/^#/, '')
  const q = hash.indexOf('?')
  const params = new URLSearchParams(q >= 0 ? hash.slice(q + 1) : '')
  return {
    platformID: params.get('platform') || null,
    productID: params.get('product') || null,
    categoryID: params.get('category') || null,
    time: (params.get('time') as TimePreset) || '30d',
    label: params.get('label') || '對比'
  }
}

export function PopoutView() {
  const init = parseParams()
  const { platforms, load: loadPlatforms } = usePlatforms()
  const { products, load: loadProducts } = useProducts()
  const { categories, load: loadCategories } = useCategories()
  const rate = useExchangeRateStore((s) => s.rate)
  const loadRate = useExchangeRateStore((s) => s.loadRate)

  useEffect(() => { loadPlatforms(); loadProducts(); loadCategories(); loadRate() }, [])

  return (
    <div className="h-screen overflow-y-auto bg-gray-50 p-5">
      <ComparePanel
        label={init.label}
        platforms={platforms}
        products={products}
        categories={categories}
        exchangeRate={rate}
        embedded
        initial={{ platformID: init.platformID, productID: init.productID, categoryID: init.categoryID, time: init.time }}
      />
    </div>
  )
}
