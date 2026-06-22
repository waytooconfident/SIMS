import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check, ChevronRight, Boxes } from 'lucide-react'
import type { Category, Product, ProductDetail } from '@shared/types'
import { Thumbnail } from '../inventory/Thumbnail'

interface Props {
  categories: Category[]
  products: Product[]
  productID: string | null
  detailID?: string | null
  categoryID: string | null
  detailsByProduct?: (productID: string) => ProductDetail[]
  onSelectAll: () => void
  onSelectCategory: (categoryID: string) => void
  onSelectProduct: (productID: string) => void
  onSelectDetail?: (productID: string, detailID: string) => void
}

// Two-pane dropdown: LEFT lists 全商品 + categories (own scroll); hovering a
// category shows its products in the RIGHT pane (own scroll). Neither pane clips
// the other, so both scroll independently.
export function ProductCategoryFilter({
  categories, products, productID, detailID, categoryID, detailsByProduct,
  onSelectAll, onSelectCategory, onSelectProduct, onSelectDetail
}: Props) {
  const [open, setOpen] = useState(false)
  const [activeCat, setActiveCat] = useState<string | null>(null)
  const [activeProd, setActiveProd] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  // Default the right pane to the currently-selected category (or the first one).
  useEffect(() => {
    if (open) setActiveCat(categoryID ?? products.find((p) => p.ProductID === productID)?.CategoryID ?? categories[0]?.CategoryID ?? null)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const detailName = productID && detailID && detailsByProduct
    ? detailsByProduct(productID).find((d) => d.DetailID === detailID)?.DetailName ?? null
    : null
  const label = productID
    ? (detailName ? `${productID}·${detailName}` : `商品 ${productID}`)
    : categoryID
      ? categories.find((c) => c.CategoryID === categoryID)?.CategoryName ?? categoryID
      : '全商品'

  const pick = (fn: () => void) => { fn(); setOpen(false) }
  const activeProducts = activeCat ? products.filter((p) => p.CategoryID === activeCat) : []
  const hasDetails = (id: string) => (detailsByProduct ? detailsByProduct(id).length > 0 : false)
  const activeProdDetails = activeProd && detailsByProduct ? detailsByProduct(activeProd) : []

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="input !w-auto text-sm flex items-center gap-2 min-w-[140px] justify-between">
        <span className="truncate">{label}</span>
        <ChevronDown size={14} className="text-gray-400 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 flex bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {/* Left: categories */}
          <div className="w-44 max-h-[320px] overflow-y-auto py-1 border-r border-gray-100">
            <button onClick={() => pick(onSelectAll)} className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-indigo-50">
              全商品
              {!productID && !categoryID && <Check size={14} className="text-indigo-600" />}
            </button>
            <div className="my-1 border-t border-gray-100" />
            {categories.map((c) => (
              <button
                key={c.CategoryID}
                onMouseEnter={() => setActiveCat(c.CategoryID)}
                onClick={() => pick(() => onSelectCategory(c.CategoryID))}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-indigo-50
                  ${activeCat === c.CategoryID ? 'bg-indigo-50' : ''} ${categoryID === c.CategoryID ? 'text-indigo-600 font-medium' : ''}`}
              >
                <span className="truncate">{c.CategoryName}</span>
                <span className="flex items-center gap-1 text-xs text-gray-400">{products.filter((p) => p.CategoryID === c.CategoryID).length}<ChevronRight size={12} /></span>
              </button>
            ))}
          </div>

          {/* Middle: products of the hovered category */}
          <div className="w-52 max-h-[320px] overflow-y-auto py-1">
            {!activeCat ? (
              <p className="px-3 py-2 text-xs text-gray-400">將滑鼠移到左側分類</p>
            ) : activeProducts.length === 0 ? (
              <p className="px-3 py-2 text-xs text-gray-400">此分類尚無商品</p>
            ) : (
              activeProducts.map((p) => (
                <button
                  key={p.ProductID}
                  onMouseEnter={() => setActiveProd(p.ProductID)}
                  onClick={() => pick(() => onSelectProduct(p.ProductID))}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-indigo-50 ${activeProd === p.ProductID ? 'bg-indigo-50' : ''}`}
                >
                  <Thumbnail path={p.ImagePath} size={24} />
                  <span className="font-mono truncate flex-1 text-left">{p.ProductID}</span>
                  {hasDetails(p.ProductID) && <Boxes size={12} className="text-indigo-400 shrink-0" />}
                  {productID === p.ProductID && !detailID && <Check size={13} className="text-indigo-600 shrink-0" />}
                </button>
              ))
            )}
          </div>

          {/* Right: details of the hovered product (only when it has any) */}
          {onSelectDetail && activeProdDetails.length > 0 && (
            <div className="w-48 max-h-[320px] overflow-y-auto py-1 border-l border-gray-100">
              <button onClick={() => pick(() => onSelectProduct(activeProd!))}
                className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-medium hover:bg-indigo-50">
                <span className="truncate">全部細項加總</span>
                {productID === activeProd && !detailID && <Check size={13} className="text-indigo-600" />}
              </button>
              <div className="my-1 border-t border-gray-100" />
              {activeProdDetails.map((d) => (
                <button key={d.DetailID}
                  onClick={() => pick(() => onSelectDetail(activeProd!, d.DetailID))}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-indigo-50">
                  <Thumbnail path={d.ImagePath} size={22} />
                  <span className="truncate flex-1 text-left">{d.DetailName}</span>
                  {detailID === d.DetailID && <Check size={13} className="text-indigo-600 shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
