// SQL DDL for the PIMS SQLite database.
// Business-logic values (Cost_NTD, NetProfit, margins, earnings) are NOT stored —
// they are computed at query time from a runtime exchange rate and the platform's
// summed fee %, so they stay correct when the rate or fees change.

// Bump whenever the table structure changes incompatibly. Stored in the DB via
// PRAGMA user_version so DatabaseManager can detect & migrate stale databases.
//   v2: ProductID PK (was ImageKey) + Categories + PlatformFees tables.
//   v3: PlatformFees gains FeeType ('percent' | 'fixed') — fixed fees are now
//       just fee line-items (added non-destructively via ALTER TABLE).
//   v4: Products gains SortOrder for manual drag-reordering (ALTER TABLE).
//   v5: Currencies table (multi-currency support; created via CREATE IF NOT EXISTS).
export const SCHEMA_VERSION = 5

// Drops the restructured tables (children first for FK safety). Settings is left
// intact so the user's exchange rate / preferences survive a schema reset.
export const DROP_RESTRUCTURED_SQL = `
PRAGMA foreign_keys = OFF;
DROP TABLE IF EXISTS ProductPlatformMappings;
DROP TABLE IF EXISTS PlatformFees;
DROP TABLE IF EXISTS Products;
DROP TABLE IF EXISTS Platforms;
DROP TABLE IF EXISTS Categories;
PRAGMA foreign_keys = ON;
`

export const CREATE_TABLES_SQL = `
PRAGMA foreign_keys = ON;

-- ─── Categories ────────────────────────────────────────────────────────────
-- 3-digit code "000".."999".  "000" is the reserved "未分類" (uncategorized) bucket.
CREATE TABLE IF NOT EXISTS Categories (
  CategoryID   TEXT PRIMARY KEY,
  CategoryName TEXT NOT NULL,
  CreatedAt    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ─── Platforms ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS Platforms (
  PlatformID   TEXT PRIMARY KEY,
  PlatformName TEXT NOT NULL UNIQUE,
  FixedFee     REAL NOT NULL DEFAULT 0,   -- optional flat NTD fee
  CreatedAt    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ─── PlatformFees ──────────────────────────────────────────────────────────
-- Named fee line-items. FeeType selects how the value is applied:
--   'percent' → FeeValue is a % of the selling price
--   'fixed'   → FeeValue is a flat NT$ amount per unit sold
-- A platform's commission = SUM(percent items) % + SUM(fixed items) NT$.
CREATE TABLE IF NOT EXISTS PlatformFees (
  FeeID         TEXT PRIMARY KEY,
  PlatformID    TEXT NOT NULL,
  FeeName       TEXT NOT NULL,
  FeePercentage REAL NOT NULL DEFAULT 0,    -- the value (% or NT$ per FeeType)
  FeeType       TEXT NOT NULL DEFAULT 'percent',
  SortOrder     INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (PlatformID) REFERENCES Platforms(PlatformID) ON DELETE CASCADE
);

-- ─── Products ──────────────────────────────────────────────────────────────
-- ProductID is a 7-char code: 3-digit category + 4-digit sequence ("0010001").
CREATE TABLE IF NOT EXISTS Products (
  ProductID       TEXT PRIMARY KEY,
  CategoryID      TEXT NOT NULL DEFAULT '000',
  ImageKey        TEXT,                     -- first-image filename
  ImagePath       TEXT,                     -- absolute path to the first image
  Cost_RMB        REAL NOT NULL DEFAULT 0,
  CompetitorPrice REAL,
  StockQuantity   INTEGER NOT NULL DEFAULT 0,
  LocalFolderPath TEXT,
  SortOrder       INTEGER NOT NULL DEFAULT 0,
  CreatedAt       DATETIME DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt       DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (CategoryID) REFERENCES Categories(CategoryID)
);

-- ─── ProductPlatformMappings ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ProductPlatformMappings (
  MappingID           TEXT PRIMARY KEY,
  ProductID           TEXT NOT NULL,
  PlatformID          TEXT NOT NULL,
  DateRecorded        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PlatformTitle       TEXT NOT NULL DEFAULT '-',
  PlatformDescription TEXT NOT NULL DEFAULT '-',
  SellingPrice        REAL NOT NULL DEFAULT 0,
  SalesVolume         INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (ProductID)  REFERENCES Products(ProductID)   ON DELETE CASCADE,
  FOREIGN KEY (PlatformID) REFERENCES Platforms(PlatformID) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_products_category    ON Products(CategoryID);
CREATE INDEX IF NOT EXISTS idx_mappings_productid   ON ProductPlatformMappings(ProductID);
CREATE INDEX IF NOT EXISTS idx_mappings_platformid  ON ProductPlatformMappings(PlatformID);
CREATE INDEX IF NOT EXISTS idx_mappings_date        ON ProductPlatformMappings(DateRecorded);
CREATE INDEX IF NOT EXISTS idx_platformfees_plat    ON PlatformFees(PlatformID);

-- ─── Currencies ────────────────────────────────────────────────────────────
-- Named currencies and their exchange rate to NT$. 'TWD' is the base (rate 1)
-- and is protected from edit/delete. Used by product-detail costs.
CREATE TABLE IF NOT EXISTS Currencies (
  CurrencyCode TEXT PRIMARY KEY,
  CurrencyName TEXT NOT NULL,
  RateToTWD    REAL NOT NULL DEFAULT 1,
  SortOrder    INTEGER NOT NULL DEFAULT 0,
  CreatedAt    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ─── Settings (key-value store) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS Settings (
  Key   TEXT PRIMARY KEY,
  Value TEXT NOT NULL
);

-- ─── Default seed data ─────────────────────────────────────────────────────
INSERT OR IGNORE INTO Settings (Key, Value) VALUES ('exchangeRate', '4.45');
INSERT OR IGNORE INTO Settings (Key, Value) VALUES ('compareMode', 'split');

INSERT OR IGNORE INTO Categories (CategoryID, CategoryName) VALUES ('000', '未分類');

INSERT OR IGNORE INTO Currencies (CurrencyCode, CurrencyName, RateToTWD, SortOrder) VALUES
  ('TWD', '新台幣', 1,    0),
  ('CNY', '人民幣', 4.45, 1),
  ('USD', '美元',   32,   2);

INSERT OR IGNORE INTO Platforms (PlatformID, PlatformName, FixedFee) VALUES
  ('shopee',   '蝦皮',   0),
  ('coupang',  '酷澎',   0),
  ('rotadon',  '旋轉拍賣', 0);

INSERT OR IGNORE INTO PlatformFees (FeeID, PlatformID, FeeName, FeePercentage, SortOrder) VALUES
  ('shopee-base',  'shopee',  '成交手續費', 5.0, 0),
  ('coupang-base', 'coupang', '成交手續費', 8.0, 0),
  ('rotadon-base', 'rotadon', '成交手續費', 3.5, 0);
`

// A derived table giving each platform's summed % fees and summed fixed (NT$)
// fees. Reused by every analytics query below.
const FEE_SUM_JOIN = `
  LEFT JOIN (
    SELECT PlatformID,
      SUM(CASE WHEN FeeType = 'fixed' THEN 0 ELSE FeePercentage END) AS TotalFeePercentage,
      SUM(CASE WHEN FeeType = 'fixed' THEN FeePercentage ELSE 0 END) AS TotalFixedFee
    FROM PlatformFees GROUP BY PlatformID
  ) fee ON fee.PlatformID = pl.PlatformID`

// Per-unit net-profit expression, reused so the formula lives in one place.
//   NetProfit = SellingPrice - Cost_NTD - SellingPrice*fee% - fixedFee
const NET_PROFIT_EXPR = `
  (ppm.SellingPrice
   - (p.Cost_RMB * :exchangeRate)
   - (ppm.SellingPrice * COALESCE(fee.TotalFeePercentage, 0) / 100.0)
   - COALESCE(fee.TotalFixedFee, 0))`

// ─── Analytics SQL ────────────────────────────────────────────────────────────
// All profit fields use the bound :exchangeRate parameter.
// Caller passes { exchangeRate, startDate, endDate, platformID }.

export const MAPPINGS_WITH_CALC_SQL = `
SELECT
  ppm.*,
  pl.PlatformName,
  p.CategoryID,
  p.ImageKey,
  p.ImagePath,
  p.Cost_RMB,
  p.StockQuantity,
  p.LocalFolderPath,
  p.CompetitorPrice,
  COALESCE(fee.TotalFeePercentage, 0)                          AS TotalFeePercentage,
  COALESCE(fee.TotalFixedFee, 0)                               AS TotalFixedFee,
  (p.Cost_RMB * :exchangeRate)                                 AS Cost_NTD,
  ${NET_PROFIT_EXPR}                                           AS NetProfit,
  CASE
    WHEN (p.Cost_RMB * :exchangeRate) > 0
    THEN ${NET_PROFIT_EXPR} / (p.Cost_RMB * :exchangeRate) * 100.0
    ELSE 0
  END                                                          AS NetProfitMargin,
  (${NET_PROFIT_EXPR} * ppm.SalesVolume)                       AS TotalEarnings,
  (ppm.SellingPrice * ppm.SalesVolume)                         AS GrossRevenue
FROM ProductPlatformMappings ppm
JOIN Products  p  ON ppm.ProductID  = p.ProductID
JOIN Platforms pl ON ppm.PlatformID = pl.PlatformID
${FEE_SUM_JOIN}
WHERE ppm.DateRecorded BETWEEN :startDate AND :endDate
  AND (:platformID IS NULL OR ppm.PlatformID = :platformID)
  AND (:productID IS NULL OR ppm.ProductID = :productID)
  AND (:categoryID IS NULL OR p.CategoryID = :categoryID)
ORDER BY ppm.DateRecorded DESC
`

export const ANALYTICS_SUMMARY_SQL = `
SELECT
  p.ProductID,
  p.CategoryID,
  p.ImageKey,
  p.ImagePath,
  ppm.PlatformID,
  pl.PlatformName,
  DATE(ppm.DateRecorded)                            AS date,
  SUM(ppm.SalesVolume)                              AS TotalSalesVolume,
  AVG(ppm.SellingPrice)                             AS AvgSellingPrice,
  SUM(${NET_PROFIT_EXPR} * ppm.SalesVolume)         AS TotalEarnings,
  SUM(p.Cost_RMB * :exchangeRate * ppm.SalesVolume) AS TotalCost,
  CASE
    WHEN SUM(p.Cost_RMB * :exchangeRate * ppm.SalesVolume) > 0
    THEN SUM(${NET_PROFIT_EXPR} * ppm.SalesVolume)
         / SUM(p.Cost_RMB * :exchangeRate * ppm.SalesVolume) * 100.0
    ELSE 0
  END                                               AS NetProfitMargin
FROM ProductPlatformMappings ppm
JOIN Products  p  ON ppm.ProductID  = p.ProductID
JOIN Platforms pl ON ppm.PlatformID = pl.PlatformID
${FEE_SUM_JOIN}
WHERE ppm.DateRecorded BETWEEN :startDate AND :endDate
  AND (:platformID IS NULL OR ppm.PlatformID = :platformID)
  AND (:productID IS NULL OR ppm.ProductID = :productID)
  AND (:categoryID IS NULL OR p.CategoryID = :categoryID)
GROUP BY p.ProductID, ppm.PlatformID, DATE(ppm.DateRecorded)
ORDER BY date DESC, TotalEarnings DESC
`

export const CHART_DATA_SQL = `
SELECT
  DATE(ppm.DateRecorded)                       AS date,
  ppm.PlatformID,
  pl.PlatformName,
  SUM(ppm.SalesVolume)                         AS dailySalesVolume,
  SUM(${NET_PROFIT_EXPR} * ppm.SalesVolume)    AS dailyEarnings
FROM ProductPlatformMappings ppm
JOIN Products  p  ON ppm.ProductID  = p.ProductID
JOIN Platforms pl ON ppm.PlatformID = pl.PlatformID
${FEE_SUM_JOIN}
WHERE ppm.DateRecorded BETWEEN :startDate AND :endDate
  AND (:platformID IS NULL OR ppm.PlatformID = :platformID)
  AND (:productID IS NULL OR ppm.ProductID = :productID)
  AND (:categoryID IS NULL OR p.CategoryID = :categoryID)
GROUP BY DATE(ppm.DateRecorded), ppm.PlatformID
ORDER BY date ASC
`
