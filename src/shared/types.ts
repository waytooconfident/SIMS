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

export interface Product {
  ProductID: string          // Primary key — "0010001" = category 001, item 0001
  CategoryID: string         // FK → Categories ("000" if uncategorized)
  ImageKey: string | null    // first-image filename (auto-extracted on drop)
  ImagePath: string | null   // absolute path to the first image (for thumbnail)
  Cost_RMB: number
  CompetitorPrice: number | null
  StockQuantity: number
  LocalFolderPath: string | null
  SortOrder: number
  CreatedAt: string
  UpdatedAt: string
}

export interface ProductPlatformMapping {
  MappingID: string
  ProductID: string          // FK → Products
  PlatformID: string         // FK → Platforms
  DateRecorded: string       // ISO datetime, used for time-range filtering
  PlatformTitle: string      // listing title ("-" if unset)
  PlatformDescription: string
  SellingPrice: number       // per-unit selling price
  SalesVolume: number
}

// ─── Computed / Derived DTOs ─────────────────────────────────────────────────
// Never stored; computed at query time from the runtime exchange rate and the
// platform's summed fee %.
//
// Formulas (per user spec):
//   Cost_NTD        = Cost_RMB * exchangeRate                       (per unit)
//   NetProfit       = SellingPrice - Cost_NTD - SellingPrice*fee%   (per unit)
//   NetProfitMargin = NetProfit / Cost_NTD * 100                    (利潤÷成本)
//   TotalEarnings   = NetProfit * SalesVolume                       (總收益)

export interface MappingWithCalc extends ProductPlatformMapping {
  PlatformName: string
  CategoryID: string
  ImageKey: string | null
  ImagePath: string | null
  Cost_RMB: number
  StockQuantity: number
  LocalFolderPath: string | null
  CompetitorPrice: number | null
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
  categoryID?: string | null  // null = all categories
  startDate: string           // ISO datetime
  endDate: string             // ISO datetime
  exchangeRate: number
}

// ─── Settings ────────────────────────────────────────────────────────────────

export type CompareMode = 'split' | 'pages'

export interface AppSettings {
  exchangeRate: number
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
  PRODUCTS: {
    GET_ALL: 'products:getAll',
    CREATE: 'products:create',
    UPDATE: 'products:update',
    DELETE: 'products:delete',
    RECATEGORIZE: 'products:recategorize',
    SELL: 'products:sell',
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
    CREATE: 'mappings:create',
    UPDATE: 'mappings:update',
    DELETE: 'mappings:delete',
    UPDATE_LISTING: 'mappings:updateListing',
    DELETE_LISTING: 'mappings:deleteListing',
    GET_ANALYTICS: 'mappings:getAnalytics',
    GET_CHART_DATA: 'mappings:getChartData'
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
    OPEN_COMPARE: 'window:openCompare'
  }
} as const

// ─── CRUD input types ─────────────────────────────────────────────────────────

export type CreateCategoryInput = { CategoryName: string }
export type UpdateCategoryInput = { CategoryName: string }

// ProductID is assigned by the repository (category code + sequence), so callers
// never supply it. CategoryID is optional — omitted means "000" (未分類).
export type CreateProductInput = {
  CategoryID?: string
  ImageKey?: string | null
  ImagePath?: string | null
  Cost_RMB?: number
  CompetitorPrice?: number | null
  StockQuantity?: number
  LocalFolderPath?: string | null
}
export type UpdateProductInput = Partial<Omit<Product, 'ProductID' | 'CreatedAt' | 'UpdatedAt'>>

export type CreatePlatformInput = { PlatformName: string; FixedFee?: number }
export type UpdatePlatformInput = Partial<{ PlatformName: string; FixedFee: number }>

export type CreatePlatformFeeInput = { PlatformID: string; FeeName: string; FeePercentage: number; FeeType?: FeeType }
export type UpdatePlatformFeeInput = Partial<{ FeeName: string; FeePercentage: number; FeeType: FeeType; SortOrder: number }>

export type CreateMappingInput = Omit<ProductPlatformMapping, 'MappingID'>
export type UpdateMappingInput = Partial<Omit<ProductPlatformMapping, 'MappingID' | 'ProductID' | 'PlatformID'>>

// Title/description belong to a product×platform listing, not to one sales record,
// so editing them bulk-updates every record for that product on that platform.
export type UpdateListingInput = { PlatformTitle: string; PlatformDescription: string }

// Recording a sale: appends a dated sales record and decrements stock.
export type SellInput = {
  productID: string
  platformID: string
  date: string             // ISO datetime (day precision is fine)
  sellingPrice: number
  quantity: number
}
