import { useEffect, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { useProducts } from '../hooks/useProducts'
import { usePlatforms } from '../hooks/usePlatforms'
import { useMappings } from '../hooks/useMappings'
import { useCategories } from '../hooks/useCategories'
import { useExchangeRateStore } from '../stores/useExchangeRateStore'
import { useFilterStore } from '../stores/useFilterStore'
import { InventoryTable, type ListingView, type InventorySize } from '../components/inventory/InventoryTable'
import { ProductFormModal, type PlatformBinding } from '../components/inventory/ProductFormModal'
import { MappingFormModal } from '../components/inventory/MappingFormModal'
import { ListingEditModal } from '../components/inventory/ListingEditModal'
import { SellModal } from '../components/inventory/SellModal'
import type {
  Product, MappingWithCalc, CreateProductInput, UpdateProductInput, UpdateMappingInput, SellInput
} from '@shared/types'
import type { ActiveView } from '../App'

const SIZES: { value: InventorySize; label: string }[] = [
  { value: 'sm', label: '小' }, { value: 'md', label: '中' }, { value: 'lg', label: '大' }
]

export function InventoryView({ onNavigate }: { onNavigate: (v: ActiveView) => void }) {
  const { products, loading: pLoading, load: loadProducts, create: createProduct, update: updateProduct, remove: removeProduct, reorder } = useProducts()
  const { platforms, load: loadPlatforms } = usePlatforms()
  const { categories, load: loadCategories, nameOf } = useCategories()
  const { mappings, loadMappings, create: createMapping, update: updateMapping, remove: removeMapping } = useMappings()
  const rate = useExchangeRateStore((s) => s.rate)
  const setFilterProduct = useFilterStore((s) => s.setProductID)

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [size, setSize] = useState<InventorySize>('sm')
  const [productModal, setProductModal] = useState<{ open: boolean; target?: Product }>({ open: false })
  const [recordModal, setRecordModal] = useState<{ open: boolean; target?: MappingWithCalc }>({ open: false })
  const [listingModal, setListingModal] = useState<{ open: boolean; target?: ListingView }>({ open: false })
  const [sellModal, setSellModal] = useState<{ open: boolean; target?: Product }>({ open: false })

  const refreshMappings = () =>
    loadMappings({ platformID: null, startDate: '1970-01-01T00:00:00.000Z', endDate: new Date().toISOString(), exchangeRate: rate })

  useEffect(() => { loadProducts(); loadPlatforms(); loadCategories(); refreshMappings() }, [rate])

  // Search matches: product ID, image filename, category name, OR any platform title.
  const filteredProducts = products.filter((p) => {
    const q = search.trim().toLowerCase()
    const matchesSearch = !q
      || p.ProductID.toLowerCase().includes(q)
      || (p.ImageKey ?? '').toLowerCase().includes(q)
      || nameOf(p.CategoryID).toLowerCase().includes(q)
      || mappings.some((m) => m.ProductID === p.ProductID && (m.PlatformTitle ?? '').toLowerCase().includes(q))
    const matchesCategory = !categoryFilter || p.CategoryID === categoryFilter
    return matchesSearch && matchesCategory
  })

  const applyBindings = async (productID: string, additions: PlatformBinding[], removals: string[]) => {
    for (const a of additions) {
      await createMapping({
        ProductID: productID, PlatformID: a.platformID, DateRecorded: new Date().toISOString(),
        PlatformTitle: a.title, PlatformDescription: a.desc, SellingPrice: a.price, SalesVolume: a.volume
      })
    }
    for (const platformID of removals) await window.api.mappings.deleteListing(productID, platformID)
  }

  const handleSaveProduct = async (input: CreateProductInput | UpdateProductInput, additions: PlatformBinding[], removals: string[]) => {
    try {
      let productID: string
      if (productModal.target) {
        const updated = await updateProduct(productModal.target.ProductID, input as UpdateProductInput)
        productID = updated.ProductID
      } else {
        const created = await createProduct(input as CreateProductInput)
        productID = created.ProductID
      }
      await applyBindings(productID, additions, removals)
      refreshMappings()
    } catch (e) {
      // If the target vanished (e.g. it was deleted), re-sync so no stale row lingers.
      await loadProducts()
      throw e
    }
  }

  const handleDeleteProduct = async (productID: string) => {
    if (!confirm(`確定刪除商品「${productID}」？所有相關平台紀錄也將一併刪除。`)) return
    try {
      await removeProduct(productID)
    } catch (e) {
      await loadProducts()
      alert('刪除失敗：' + String(e).replace(/^Error:\s*/, ''))
    }
    refreshMappings()
  }

  const handleSell = async (input: SellInput) => { await window.api.products.sell(input); await loadProducts(); refreshMappings() }
  const handleEditRecord = async (input: UpdateMappingInput, mappingID: string) => { await updateMapping(mappingID, input); refreshMappings() }
  const handleEditListing = async (productID: string, platformID: string, title: string, description: string) => {
    await window.api.mappings.updateListing(productID, platformID, title, description); refreshMappings()
  }

  // Jump to Analytics pre-filtered to this product.
  const handleAnalyze = (productID: string) => { setFilterProduct(productID); onNavigate('analytics') }

  const initialLoading = pLoading && products.length === 0

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-8" placeholder="搜尋編號 / 圖名 / 分類 / 平台標題…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <select className="input !w-auto text-sm" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">全部分類</option>
          {categories.map((c) => <option key={c.CategoryID} value={c.CategoryID}>{c.CategoryName}</option>)}
        </select>

        {/* Display size */}
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
          size={size}
          onReorder={reorder}
          onEditProduct={(p) => setProductModal({ open: true, target: p })}
          onDeleteProduct={handleDeleteProduct}
          onSellProduct={(p) => setSellModal({ open: true, target: p })}
          onAnalyze={handleAnalyze}
          onEditListing={(l) => setListingModal({ open: true, target: l })}
          onEditRecord={(m) => setRecordModal({ open: true, target: m })}
          onDeleteRecord={async (id) => { await removeMapping(id); refreshMappings() }}
        />
      )}

      {productModal.open && (
        <ProductFormModal
          product={productModal.target}
          categories={categories}
          platforms={platforms}
          productMappings={productModal.target ? mappings.filter((m) => m.ProductID === productModal.target!.ProductID) : []}
          onSave={handleSaveProduct}
          onClose={() => setProductModal({ open: false })}
        />
      )}

      {recordModal.open && recordModal.target && (
        <MappingFormModal mapping={recordModal.target} onSave={handleEditRecord} onClose={() => setRecordModal({ open: false })} />
      )}

      {listingModal.open && listingModal.target && (
        <ListingEditModal
          productID={listingModal.target.productID}
          platformID={listingModal.target.platformID}
          platformName={listingModal.target.platformName}
          title={listingModal.target.title}
          description={listingModal.target.description}
          onSave={handleEditListing}
          onClose={() => setListingModal({ open: false })}
        />
      )}

      {sellModal.open && sellModal.target && (
        <SellModal product={sellModal.target} platforms={platforms} mappings={mappings} onSell={handleSell} onClose={() => setSellModal({ open: false })} />
      )}
    </div>
  )
}
