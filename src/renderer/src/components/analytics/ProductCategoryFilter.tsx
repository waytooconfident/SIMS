import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check, ChevronRight } from 'lucide-react'
import type { Category, Product } from '@shared/types'
import { Thumbnail } from '../inventory/Thumbnail'

interface Props {
  categories: Category[]
  products: Product[]
  productID: string | null
  categoryID: string | null
  onSelectAll: () => void
  onSelectCategory: (categoryID: string) => void
  onSelectProduct: (productID: string) => void
}

// Two-pane dropdown: LEFT lists 全商品 + categories (own scroll); hovering a
// category shows its products in the RIGHT pane (own scroll). Neither pane clips
// the other, so both scroll independently.
export function ProductCategoryFilter({
  categories, products, productID, categoryID,
  onSelectAll, onSelectCategory, onSelectProduct
}: Props) {
  const [open, setOpen] = useState(false)
  const [activeCat, setActiveCat] = useState<string | null>(null)
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

  const label = productID
    ? `商品 ${productID}`
    : categoryID
      ? categories.find((c) => c.CategoryID === categoryID)?.CategoryName ?? categoryID
      : '全商品'

  const pick = (fn: () => void) => { fn(); setOpen(false) }
  const activeProducts = activeCat ? products.filter((p) => p.CategoryID === activeCat) : []

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

          {/* Right: products of the hovered category */}
          <div className="w-52 max-h-[320px] overflow-y-auto py-1">
            {!activeCat ? (
              <p className="px-3 py-2 text-xs text-gray-400">將滑鼠移到左側分類</p>
            ) : activeProducts.length === 0 ? (
              <p className="px-3 py-2 text-xs text-gray-400">此分類尚無商品</p>
            ) : (
              activeProducts.map((p) => (
                <button
                  key={p.ProductID}
                  onClick={() => pick(() => onSelectProduct(p.ProductID))}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-indigo-50"
                >
                  <Thumbnail path={p.ImagePath} size={24} />
                  <span className="font-mono truncate flex-1 text-left">{p.ProductID}</span>
                  {productID === p.ProductID && <Check size={13} className="text-indigo-600" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
