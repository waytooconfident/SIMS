import { useCallback, useEffect, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { useProducts } from '../hooks/useProducts'
import { usePlatforms } from '../hooks/usePlatforms'
import { useMappings } from '../hooks/useMappings'
import { useCategories } from '../hooks/useCategories'
import { useDetails } from '../hooks/useDetails'
import { useOrders } from '../hooks/useOrders'
import { useFilterStore } from '../stores/useFilterStore'
import { useSalesFilterStore } from '../stores/useSalesFilterStore'
import { InventoryTable, type InventorySize } from '../components/inventory/InventoryTable'
import { ProductFormModal, type ProductListing } from '../components/inventory/ProductFormModal'
import { OrderFormModal } from '../components/inventory/OrderFormModal'
import type { Product, ProductPlatformMapping } from '@shared/types'
import type { ActiveView } from '../App'

const SIZES: { value: InventorySize; label: string }[] = [
  { value: 'sm', label: '小' }, { value: 'md', label: '中' }, { value: 'lg', label: '大' }
]

type Listing = ProductPlatformMapping & { PlatformName: string }

export function InventoryView({ onNavigate }: { onNavigate: (v: ActiveView) => void }) {
  const { products, loading: pLoading, load: loadProducts, remove: removeProduct, reorder } = useProducts()
  const { platforms, load: loadPlatforms } = usePlatforms()
  const { categories, load: loadCategories, nameOf } = useCategories()
  const { mappings, loadMappings } = useMappings()
  const { byProduct: detailsByProduct, details, load: loadDetails } = useDetails()
  const { create: createOrder } = useOrders()
  const [listings, setListings] = useState<Listing[]>([])
  const setFilterProduct = useFilterStore((s) => s.setProductID)
  const applySalesFilter = useSalesFilterStore((s) => s.applyFrom)

  const [search, setSearch] = useState('')
  const [platformFilter, setPlatformFilter] = useState<string>('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [size, setSize] = useState<InventorySize>('sm')
  const [productModal, setProductModal] = useState<{ open: boolean; target?: Product }>({ open: false })
  const [sellModal, setSellModal] = useState<{ open: boolean; prefill?: string }>({ open: false })

  const refreshMappings = useCallback(() =>
    loadMappings({ platformID: null, startDate: '1970-01-01T00:00:00.000Z', endDate: new Date().toISOString() }), [loadMappings])
  const refreshListings = useCallback(async () => { setListings(await window.api.mappings.getListings()) }, [])

  useEffect(() => { loadProducts(); loadPlatforms(); loadCategories(); loadDetails(); refreshMappings(); refreshListings() }, [])

  // Search matches: product ID, image filename, category name, detail names, OR a listing title.
  const filteredProducts = products.filter((p) => {
    const q = search.trim().toLowerCase()
    const matchesSearch = !q
      || p.ProductID.toLowerCase().includes(q)
      || (p.ImageKey ?? '').toLowerCase().includes(q)
      || nameOf(p.CategoryID).toLowerCase().includes(q)
      || detailsByProduct(p.ProductID).some((d) => d.DetailName.toLowerCase().includes(q))
      || listings.some((l) => l.ProductID === p.ProductID && (l.PlatformTitle ?? '').toLowerCase().includes(q))
    // Platform filter: products listed on, or sold on, the chosen platform.
    const matchesPlatform = !platformFilter
      || listings.some((l) => l.ProductID === p.ProductID && l.PlatformID === platformFilter)
      || mappings.some((m) => m.ProductID === p.ProductID && m.PlatformID === platformFilter)
    const matchesCategory = !categoryFilter || p.CategoryID === categoryFilter
    return matchesSearch && matchesPlatform && matchesCategory
  })

  // The product form saves the product, its details and its listings itself; we
  // just re-sync all the lists afterwards.
  const handleProductSaved = () => { loadProducts(); loadDetails(); refreshMappings(); refreshListings() }

  // Competitor price is per-platform (on listing rows). Show a single value or a
  // range across the product's listings.
  const competitorDisplay = (productID: string): string => {
    const prices = listings
      .filter((l) => l.ProductID === productID && l.CompetitorPrice != null)
      .map((l) => l.CompetitorPrice as number)
    if (prices.length === 0) return '-'
    const lo = Math.min(...prices), hi = Math.max(...prices)
    return lo === hi ? `NT$${lo}` : `NT$${lo}–${hi}`
  }

  const handleDeleteProduct = async (productID: string) => {
    if (!confirm(`確定刪除商品「${productID}」？所有相關平台紀錄也將一併刪除。`)) return
    try {
      await removeProduct(productID)
    } catch (e) {
      await loadProducts()
      alert('刪除失敗：' + String(e).replace(/^Error:\s*/, ''))
    }
    refreshMappings(); refreshListings()
  }

  // Quick-sell: open the new-order form as a popup right here, so the inventory
  // page stays visible/usable behind it. Pre-filled with this product.
  const handleQuickSell = (productID: string) => setSellModal({ open: true, prefill: productID })
  const handleQuickSellSubmit = async (input: Parameters<typeof createOrder>[0]) => {
    await createOrder(input)
    loadProducts(); loadDetails(); refreshMappings()  // stock changed
  }

  // Jump to the Sales Records page filtered to this product (+ current filters).
  const handleViewSales = (productID: string) => {
    applySalesFilter({ productID, platformID: platformFilter || null, categoryID: categoryFilter || null })
    onNavigate('sales')
  }

  // Jump to Analytics pre-filtered to this product.
  const handleAnalyze = (productID: string) => { setFilterProduct(productID); onNavigate('analytics') }

  const initialLoading = pLoading && products.length === 0
  const targetListings: ProductListing[] = productModal.target
    ? listings.filter((l) => l.ProductID === productModal.target!.ProductID)
    : []

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-8" placeholder="搜尋編號 / 圖名 / 分類 / 細項 / 平台標題…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <select className="input !w-auto text-sm" value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)}>
          <option value="">全部平台</option>
          {platforms.map((p) => <option key={p.PlatformID} value={p.PlatformID}>{p.PlatformName}</option>)}
        </select>

        <select className="input !w-auto text-sm" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">全部分類</option>
          {categories.map((c) => <option key={c.CategoryID} value={c.CategoryID}>{c.CategoryName}</option>)}
        </select>

        <div className="flex gap-0.5 bg-gray-100 p-0.5 rounded-lg">
          {SIZES.map(({ value, label }) => (
            <button key={value} onClick={() => setSize(value)}
              className={`px-3 py-1 rounded-md text-xs font-medium ${size === value ? 'bg-white shadow text-indigo-700' : 'text-gray-500'}`}>{label}</button>
          ))}
        </div>

        <button onClick={() => setProductModal({ open: true })} className="btn-primary ml-auto"><Plus size={15} /> 新增商品</button>
      </div>

      {initialLoading ? (
        <div className="card p-12 text-center text-gray-400 text-sm">載入中…</div>
      ) : (
        <InventoryTable
          products={filteredProducts}
          mappings={mappings}
          categoryName={nameOf}
          detailsByProduct={detailsByProduct}
          competitorDisplay={competitorDisplay}
          size={size}
          onReorder={reorder}
          onReorderDetails={async (orderedIds) => { await window.api.details.reorder(orderedIds); loadDetails() }}
          onEditProduct={(p) => setProductModal({ open: true, target: p })}
          onDeleteProduct={handleDeleteProduct}
          onSellProduct={(p) => handleQuickSell(p.ProductID)}
          onAnalyze={handleAnalyze}
          onViewSales={handleViewSales}
        />
      )}

      {productModal.open && (
        <ProductFormModal
          product={productModal.target}
          categories={categories}
          platforms={platforms}
          productListings={targetListings}
          onClose={() => setProductModal({ open: false })}
          onSaved={handleProductSaved}
        />
      )}

      {sellModal.open && (
        <OrderFormModal
          products={products}
          platforms={platforms}
          details={details}
          categoryName={nameOf}
          prefillProductID={sellModal.prefill}
          onSubmit={handleQuickSellSubmit}
          onClose={() => setSellModal({ open: false })}
        />
      )}
    </div>
  )
}
