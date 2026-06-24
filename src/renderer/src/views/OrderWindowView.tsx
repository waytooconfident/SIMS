import { useEffect } from 'react'
import { useProducts } from '../hooks/useProducts'
import { usePlatforms } from '../hooks/usePlatforms'
import { useDetails } from '../hooks/useDetails'
import { useCategories } from '../hooks/useCategories'
import { useOrders } from '../hooks/useOrders'
import { OrderFormModal } from '../components/inventory/OrderFormModal'

// Rendered in its own BrowserWindow (route "#order"). A real OS window can be
// dragged outside the main window, dropped on a second monitor, and stays open
// when the main window is minimised. Products dragged from the main window's
// inventory arrive over IPC (handled inside OrderFormModal's windowMode).
export function OrderWindowView() {
  const { products, load: loadProducts } = useProducts()
  const { platforms, load: loadPlatforms } = usePlatforms()
  const { details, load: loadDetails } = useDetails()
  const { load: loadCategories, nameOf } = useCategories()
  const { create } = useOrders()

  useEffect(() => {
    loadProducts(); loadPlatforms(); loadDetails(); loadCategories()
  }, [loadProducts, loadPlatforms, loadDetails, loadCategories])

  return (
    <OrderFormModal
      windowMode
      products={products}
      platforms={platforms}
      details={details}
      categoryName={nameOf}
      onSubmit={async (input) => { await create(input) }}
      onClose={() => window.close()}
    />
  )
}
