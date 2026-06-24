// ─── Auth / Users ─────────────────────────────────────────────────────────────
// Public user shape — passwords/hashes never cross to the renderer.
export interface User {
  UserID: string
  Username: string
  Avatar: string            // emoji
  CreatedAt: string
}
export type CreateUserInput = { username: string; password: string; avatar?: string }
export type UpdateUserInput = { username?: string; password?: string; avatar?: string }

// ─── Domain Models ──────────────────────────────────────────────────────────
// Canonical shapes shared by the main process and renderer. All IPC payloads
// conform to these types.

export interface Category {
  CategoryID: string         // 3-digit code, "000".."999" ("000" = 未分類/uncategorized)
  CategoryName: string
  CreatedAt: string
}

// ─── Currencies ────────────────────────────────────────────────────────────────
// A named currency and how many NT$ one unit of it is worth. 'TWD' is the base
// (RateToTWD = 1) and is not editable/deletable.
export interface Currency {
  CurrencyCode: string       // e.g. 'TWD','CNY','USD'
  CurrencyName: string       // e.g. '新台幣','人民幣'
  RateToTWD: number          // 1 unit = ? NT$
  SortOrder: number
  CreatedAt: string
}
export interface CreateCurrencyInput {
  CurrencyCode: string
  CurrencyName: string
  RateToTWD: number
}
export interface UpdateCurrencyInput {
  CurrencyName?: string
  RateToTWD?: number
}

export type FeeType = 'percent' | 'fixed'

export interface PlatformFee {
  FeeID: string
  PlatformID: string
  FeeName: string            // e.g. "成交手續費"
  /** The value: a % when FeeType='percent', or a flat NT$ amount when 'fixed'. */
  FeePercentage: number
  FeeType: FeeType
  SortOrder: number
}

export interface Platform {
  PlatformID: string
  PlatformName: string
  /** @deprecated legacy column — fixed fees are now PlatformFees of type 'fixed'. */
  FixedFee: number
  CreatedAt: string
  /** Joined: the platform's fee line-items (filled by the repository). */
  fees?: PlatformFee[]
  /** Joined: SUM of percent fee-items — the platform's total commission %. */
  TotalFeePercentage?: number
  /** Joined: SUM of fixed fee-items — the platform's total flat NT$ fee. */
  TotalFixedFee?: number
}

// A product-level cost line-item (used when the product has NO details). Mirrors
// DetailCost. The product's NT$ cost = Σ(Amount × that currency's RateToTWD).
export interface ProductCost {
  CostID: string
  ProductID: string
  CostName: string           // optional label, e.g. '進貨' / '運費'
  Amount: number             // amount in CurrencyCode
  CurrencyCode: string       // FK → Currencies
  SortOrder: number
}

export interface Product {
  ProductID: string          // Primary key — "0010001" = category 001, item 0001
  CategoryID: string         // FK → Categories ("000" if uncategorized)
  ImageKey: string | null    // first-image filename (auto-extracted on drop)
  ImagePath: string | null   // absolute path to the first image (for thumbnail)
  StockQuantity: number
  LocalFolderPath: string | null
  SortOrder: number
  CreatedAt: string
  UpdatedAt: string
  costs: ProductCost[]        // joined cost line-items (empty if the product has details)
  TotalCostNTD: number        // computed: Σ(Amount × currency rate)
}

export interface ProductPlatformMapping {
  MappingID: string
  ProductID: string          // FK → Products
  PlatformID: string         // FK → Platforms
  DetailID: string | null    // FK → ProductDetails (null = product-level sale)
  OrderID: string | null     // FK → Orders (null = listing-only metadata row)
  DateRecorded: string       // ISO datetime, used for time-range filtering
  PlatformTitle: string      // listing title ("-" if unset)
  PlatformDescription: string
  SellingPrice: number       // per-unit selling price
  CompetitorPrice: number | null  // per-platform competitor price (listing rows)
  SalesVolume: number
}

// ─── Orders (訂單) ────────────────────────────────────────────────────────────
// A sale is an order on one platform/date containing several sold items
// (each a product/detail line) plus order-specific extra costs (e.g. shipping
// paid for the customer). Order profit = Σ(item net profit) − Σ(order costs).
export interface OrderCost {
  CostID: string
  OrderID: string
  CostName: string
  Amount: number
  CurrencyCode: string
  SortOrder: number
}

export interface OrderItem {
  ProductID: string
  DetailID: string | null
  SellingPrice: number
  SalesVolume: number
}

export interface Order {
  OrderID: string
  PlatformID: string
  DateRecorded: string       // ISO datetime
  Note: string
  CreatedAt: string
}

// An order item enriched with computed per-unit cost/profit (reuses the per-line
// formula). One row per sold line.
export interface OrderItemWithCalc extends OrderItem {
  MappingID: string
  DetailName: string | null
  CategoryID: string
  ImageKey: string | null
  ImagePath: string | null
  PlatformName: string
  Cost_NTD: number           // per unit
  NetProfit: number          // per unit (before order-level costs)
  TotalEarnings: number      // NetProfit * SalesVolume
  GrossRevenue: number       // SellingPrice * SalesVolume
}

// A full order with its items, extra costs and rolled-up totals.
export interface OrderWithCalc extends Order {
  PlatformName: string
  items: OrderItemWithCalc[]
  extraCosts: OrderCost[]
  TotalExtraCostNTD: number  // Σ(extra cost × currency rate)
  GrossRevenue: number       // Σ item gross revenue
  ItemsEarnings: number      // Σ item net profit (before extra costs)
  NetEarnings: number        // ItemsEarnings − TotalExtraCostNTD
  TotalVolume: number        // Σ item volume
}

// ─── Product details (變體/SKU) ──────────────────────────────────────────────
// A product may have several "details" (variants). When it does, sales/stock/
// cost/profit are tracked per detail and the product row shows the aggregate.
export interface DetailCost {
  CostID: string
  DetailID: string
  CostName: string           // optional label, e.g. '進貨' / '運費'
  Amount: number             // amount in CurrencyCode
  CurrencyCode: string       // FK → Currencies
  SortOrder: number
}

export interface ProductDetail {
  DetailID: string
  ProductID: string          // FK → Products
  DetailName: string
  ImageKey: string | null    // null = inherit the parent product's image
  ImagePath: string | null
  SellingPrice: number       // NT$
  StockQuantity: number
  SortOrder: number
  CreatedAt: string
  UpdatedAt: string
  costs: DetailCost[]         // joined cost line-items
  TotalCostNTD: number       // computed: Σ(Amount × currency rate)
}

// ─── Computed / Derived DTOs ─────────────────────────────────────────────────
// Never stored; computed at query time from the runtime exchange rate and the
// platform's summed fee %.
//
// Formulas (per user spec):
//   Cost_NTD        = Σ(cost line × currency rate)                  (per unit)
//   NetProfit       = SellingPrice - Cost_NTD - SellingPrice*fee%   (per unit)
//   NetProfitMargin = NetProfit / Cost_NTD * 100                    (利潤÷成本)
//   TotalEarnings   = NetProfit * SalesVolume                       (總收益)

export interface MappingWithCalc extends ProductPlatformMapping {
  PlatformName: string
  DetailName: string | null   // joined: the detail's name (null for product-level)
  CategoryID: string
  ImageKey: string | null
  ImagePath: string | null
  StockQuantity: number
  LocalFolderPath: string | null
  TotalFeePercentage: number  // summed platform percent fees
  TotalFixedFee: number       // summed platform fixed fees (NT$/unit)
  Cost_NTD: number            // per unit
  NetProfit: number           // per unit
  NetProfitMargin: number     // NetProfit / Cost_NTD * 100  (利潤÷成本)
  TotalEarnings: number       // NetProfit * SalesVolume (總收益)
  GrossRevenue: number        // SellingPrice * SalesVolume (營業額, for reference)
}

// ─── Analytics ───────────────────────────────────────────────────────────────

export interface AnalyticsSummary {
  ProductID: string
  CategoryID: string
  ImageKey: string | null
  ImagePath: string | null
  PlatformID: string
  PlatformName: string
  date: string                // "YYYY-MM-DD" — grouped per day
  TotalSalesVolume: number
  AvgSellingPrice: number
  TotalEarnings: number       // SUM(NetProfit * SalesVolume) — 總收益
  TotalCost: number           // SUM(Cost_NTD * SalesVolume)
  NetProfitMargin: number     // TotalEarnings / TotalCost * 100  (利潤÷成本)
}

export interface ChartDataPoint {
  date: string                // "YYYY-MM-DD"
  [seriesKey: string]: number | string  // dynamic per-platform keys
}

// ─── Filter DTOs ─────────────────────────────────────────────────────────────

export type TimePreset = 'today' | '7d' | '30d' | '90d' | '180d' | '365d' | 'all'

export interface AnalyticsFilter {
  platformID: string | null   // null = all platforms (aggregated)
  productID?: string | null   // null = all products
  detailID?: string | null    // null = all details (or the product's aggregate)
  categoryID?: string | null  // null = all categories
  startDate: string           // ISO datetime
  endDate: string             // ISO datetime
}

// ─── Settings ────────────────────────────────────────────────────────────────

export type CompareMode = 'split' | 'pages'

export interface AppSettings {
  compareMode: CompareMode
}

// ─── IPC Channel names (type-safe constants) ─────────────────────────────────

export const IPC = {
  AUTH: {
    LIST_USERS: 'auth:listUsers',
    CREATE_USER: 'auth:createUser',
    UPDATE_USER: 'auth:updateUser',
    DELETE_USER: 'auth:deleteUser',
    LOGIN: 'auth:login',
    REMEMBERED_PASSWORD: 'auth:rememberedPassword',
    AUTO_LOGIN: 'auth:autoLogin',
    LOGOUT: 'auth:logout',
    CURRENT: 'auth:current',
    LAST_USER: 'auth:lastUser'
  },
  CATEGORIES: {
    GET_ALL: 'categories:getAll',
    CREATE: 'categories:create',
    UPDATE: 'categories:update',
    DELETE: 'categories:delete'
  },
  CURRENCIES: {
    GET_ALL: 'currencies:getAll',
    CREATE: 'currencies:create',
    UPDATE: 'currencies:update',
    DELETE: 'currencies:delete'
  },
  DETAILS: {
    GET_BY_PRODUCT: 'details:getByProduct',
    GET_ALL: 'details:getAll',
    CREATE: 'details:create',
    UPDATE: 'details:update',
    DELETE: 'details:delete',
    REORDER: 'details:reorder'
  },
  PRODUCTS: {
    GET_ALL: 'products:getAll',
    CREATE: 'products:create',
    UPDATE: 'products:update',
    DELETE: 'products:delete',
    RECATEGORIZE: 'products:recategorize',
    REORDER: 'products:reorder'
  },
  PLATFORMS: {
    GET_ALL: 'platforms:getAll',
    CREATE: 'platforms:create',
    UPDATE: 'platforms:update',
    DELETE: 'platforms:delete'
  },
  PLATFORM_FEES: {
    GET_BY_PLATFORM: 'platformFees:getByPlatform',
    CREATE: 'platformFees:create',
    UPDATE: 'platformFees:update',
    DELETE: 'platformFees:delete'
  },
  MAPPINGS: {
    GET_ALL: 'mappings:getAll',
    GET_LISTINGS: 'mappings:getListings',
    CREATE: 'mappings:create',
    UPDATE: 'mappings:update',
    DELETE: 'mappings:delete',
    UPDATE_LISTING: 'mappings:updateListing',
    DELETE_LISTING: 'mappings:deleteListing',
    GET_ANALYTICS: 'mappings:getAnalytics',
    GET_CHART_DATA: 'mappings:getChartData',
    GET_ORDER_COST_TOTAL: 'mappings:getOrderCostTotal'
  },
  ORDERS: {
    GET_ALL: 'orders:getAll',
    CREATE: 'orders:create',
    UPDATE: 'orders:update',
    DELETE: 'orders:delete'
  },
  SETTINGS: {
    GET: 'settings:get',
    SET: 'settings:set'
  },
  SHELL: {
    OPEN_FOLDER: 'shell:openFolder'
  },
  IMAGES: {
    GET_DATA_URL: 'images:getDataUrl'
  },
  WINDOW: {
    OPEN_COMPARE: 'window:openCompare',
    OPEN_ORDER: 'window:openOrder',
    DRAG_BEGIN: 'window:dragBegin',
    DRAG_MOVE: 'window:dragMove',
    DRAG_END: 'window:dragEnd',
    ORDER_ADD_PRODUCT: 'window:orderAddProduct',
    ORDER_HOVER: 'window:orderHover',
    ORDERS_CHANGED: 'window:ordersChanged'
  }
} as const

// ─── CRUD input types ─────────────────────────────────────────────────────────

export type CreateCategoryInput = { CategoryName: string }
export type UpdateCategoryInput = { CategoryName: string }

// A product-level cost line-item input (currency-selectable). Mirrors DetailCostInput.
export type ProductCostInput = { CostName?: string; Amount: number; CurrencyCode: string }

// ProductID is assigned by the repository (category code + sequence), so callers
// never supply it. CategoryID is optional — omitted means "000" (未分類).
export type CreateProductInput = {
  CategoryID?: string
  ImageKey?: string | null
  ImagePath?: string | null
  StockQuantity?: number
  LocalFolderPath?: string | null
  costs?: ProductCostInput[]
}
export type UpdateProductInput = Partial<{
  CategoryID: string
  ImageKey: string | null
  ImagePath: string | null
  StockQuantity: number
  LocalFolderPath: string | null
  costs: ProductCostInput[]
}>

export type CreatePlatformInput = { PlatformName: string; FixedFee?: number }
export type UpdatePlatformInput = Partial<{ PlatformName: string; FixedFee: number }>

export type CreatePlatformFeeInput = { PlatformID: string; FeeName: string; FeePercentage: number; FeeType?: FeeType }
export type UpdatePlatformFeeInput = Partial<{ FeeName: string; FeePercentage: number; FeeType: FeeType; SortOrder: number }>

export type CreateMappingInput = Omit<ProductPlatformMapping, 'MappingID' | 'DetailID' | 'OrderID'>
  & { DetailID?: string | null; OrderID?: string | null }
export type UpdateMappingInput = Partial<Omit<ProductPlatformMapping, 'MappingID' | 'ProductID' | 'PlatformID' | 'DetailID' | 'OrderID'>>

// Title/description belong to a product×platform listing, not to one sales record,
// so editing them bulk-updates every record for that product on that platform.
export type UpdateListingInput = { PlatformTitle: string; PlatformDescription: string }

// ─── Product detail (變體) inputs ────────────────────────────────────────────
export type DetailCostInput = { CostName?: string; Amount: number; CurrencyCode: string }
export type CreateDetailInput = {
  ProductID: string
  DetailName: string
  ImageKey?: string | null
  ImagePath?: string | null
  SellingPrice?: number
  StockQuantity?: number
  costs: DetailCostInput[]
}
export type UpdateDetailInput = Partial<Omit<CreateDetailInput, 'ProductID'>>

// ─── Order (訂單) inputs ──────────────────────────────────────────────────────
export type OrderCostInput = { CostName?: string; Amount: number; CurrencyCode: string }
export type OrderItemInput = {
  productID: string
  detailID?: string | null
  sellingPrice: number
  quantity: number
}
export type CreateOrderInput = {
  platformID: string
  date: string                 // ISO datetime (day precision is fine)
  note?: string
  items: OrderItemInput[]
  extraCosts?: OrderCostInput[]
}
export type UpdateOrderInput = CreateOrderInput

// Recording a sale: appends a dated sales record and decrements stock.
// For a product WITH details, `details` lists the variant(s) sold together;
// otherwise the product-level sellingPrice/quantity are used.
export type SellInput = {
  productID: string
  platformID: string
  date: string             // ISO datetime (day precision is fine)
  sellingPrice?: number
  quantity?: number
  details?: { detailID: string; quantity: number; sellingPrice: number }[]
}
