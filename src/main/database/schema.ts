// SQL DDL for the PIMS SQLite database.
// Business-logic values (Cost_NTD, NetProfit, margins, earnings) are NOT stored —
// they are computed at query time from each cost line's currency rate and the
// platform's summed fee %, so they stay correct when rates or fees change.

// Bump whenever the table structure changes incompatibly. Stored in the DB via
// PRAGMA user_version so DatabaseManager can detect & migrate stale databases.
//   v2: ProductID PK (was ImageKey) + Categories + PlatformFees tables.
//   v3: PlatformFees gains FeeType ('percent' | 'fixed').
//   v4: Products gains SortOrder for manual drag-reordering.
//   v5: Currencies table (multi-currency support).
//   v6: ProductDetails + DetailCosts tables (variants) + DetailID on mappings.
//   v7: Cost model + order model rework (DESTRUCTIVE — DB is reset on upgrade):
//       • Products.Cost_RMB removed → ProductCosts line-items (currency-aware).
//       • Orders + OrderCosts tables; ProductPlatformMappings gains OrderID
//         (an order's sold line; null = listing-only metadata row).
//       • Global exchange rate removed — all costs use per-currency rates.
//   v8: CompetitorPrice moves from Products onto the listing row
//       (ProductPlatformMappings) so it can differ per platform. Added
//       non-destructively via ALTER — data is preserved on upgrade.
export const SCHEMA_VERSION = 8

// Drops every app table (children first for FK safety). Settings & Currencies are
// left intact so the user's preferences and currency rates survive a reset.
export const DROP_RESTRUCTURED_SQL = `
PRAGMA foreign_keys = OFF;
DROP TABLE IF EXISTS OrderCosts;
DROP TABLE IF EXISTS ProductPlatformMappings;
DROP TABLE IF EXISTS Orders;
DROP TABLE IF EXISTS DetailCosts;
DROP TABLE IF EXISTS ProductDetails;
DROP TABLE IF EXISTS ProductCosts;
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
-- Cost is held in ProductCosts line-items (when the product has no details).
CREATE TABLE IF NOT EXISTS Products (
  ProductID       TEXT PRIMARY KEY,
  CategoryID      TEXT NOT NULL DEFAULT '000',
  ImageKey        TEXT,                     -- first-image filename
  ImagePath       TEXT,                     -- absolute path to the first image
  StockQuantity   INTEGER NOT NULL DEFAULT 0,
  LocalFolderPath TEXT,
  SortOrder       INTEGER NOT NULL DEFAULT 0,
  CreatedAt       DATETIME DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt       DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (CategoryID) REFERENCES Categories(CategoryID)
);

-- ─── ProductCosts ───────────────────────────────────────────────────────────
-- A product (with NO details) may have several cost line-items, each in any
-- currency. The product's NT$ cost = SUM(Amount × that currency's RateToTWD).
CREATE TABLE IF NOT EXISTS ProductCosts (
  CostID       TEXT PRIMARY KEY,
  ProductID    TEXT NOT NULL,
  CostName     TEXT NOT NULL DEFAULT '',
  Amount       REAL NOT NULL DEFAULT 0,
  CurrencyCode TEXT NOT NULL DEFAULT 'TWD',
  SortOrder    INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (ProductID) REFERENCES Products(ProductID) ON DELETE CASCADE
);

-- ─── ProductDetails (變體/SKU) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ProductDetails (
  DetailID      TEXT PRIMARY KEY,
  ProductID     TEXT NOT NULL,
  DetailName    TEXT NOT NULL,
  ImageKey      TEXT,                       -- null = inherit the product's image
  ImagePath     TEXT,
  SellingPrice  REAL NOT NULL DEFAULT 0,
  StockQuantity INTEGER NOT NULL DEFAULT 0,
  SortOrder     INTEGER NOT NULL DEFAULT 0,
  CreatedAt     DATETIME DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt     DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ProductID) REFERENCES Products(ProductID) ON DELETE CASCADE
);

-- ─── DetailCosts ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS DetailCosts (
  CostID       TEXT PRIMARY KEY,
  DetailID     TEXT NOT NULL,
  CostName     TEXT NOT NULL DEFAULT '',
  Amount       REAL NOT NULL DEFAULT 0,
  CurrencyCode TEXT NOT NULL DEFAULT 'TWD',
  SortOrder    INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (DetailID) REFERENCES ProductDetails(DetailID) ON DELETE CASCADE
);

-- ─── Orders (訂單) ────────────────────────────────────────────────────────────
-- A sale on one platform/date. Holds several sold line-items (in
-- ProductPlatformMappings.OrderID) plus order-specific extra costs (OrderCosts).
CREATE TABLE IF NOT EXISTS Orders (
  OrderID      TEXT PRIMARY KEY,
  PlatformID   TEXT NOT NULL,
  DateRecorded DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  Note         TEXT NOT NULL DEFAULT '',
  CreatedAt    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (PlatformID) REFERENCES Platforms(PlatformID) ON DELETE CASCADE
);

-- ─── OrderCosts ───────────────────────────────────────────────────────────────
-- Order-specific extra costs (e.g. shipping paid for the customer), any currency.
CREATE TABLE IF NOT EXISTS OrderCosts (
  CostID       TEXT PRIMARY KEY,
  OrderID      TEXT NOT NULL,
  CostName     TEXT NOT NULL DEFAULT '',
  Amount       REAL NOT NULL DEFAULT 0,
  CurrencyCode TEXT NOT NULL DEFAULT 'TWD',
  SortOrder    INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (OrderID) REFERENCES Orders(OrderID) ON DELETE CASCADE
);

-- ─── ProductPlatformMappings ───────────────────────────────────────────────
-- A row is either a listing (OrderID NULL, volume 0) or a sold line within an
-- order (OrderID set).
CREATE TABLE IF NOT EXISTS ProductPlatformMappings (
  MappingID           TEXT PRIMARY KEY,
  ProductID           TEXT NOT NULL,
  PlatformID          TEXT NOT NULL,
  DetailID            TEXT,                  -- null = product-level line
  OrderID             TEXT,                  -- null = listing-only metadata row
  DateRecorded        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PlatformTitle       TEXT NOT NULL DEFAULT '-',
  PlatformDescription TEXT NOT NULL DEFAULT '-',
  SellingPrice        REAL NOT NULL DEFAULT 0,
  CompetitorPrice     REAL,                  -- per-platform competitor price (listing rows)
  SalesVolume         INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (ProductID)  REFERENCES Products(ProductID)   ON DELETE CASCADE,
  FOREIGN KEY (PlatformID) REFERENCES Platforms(PlatformID) ON DELETE CASCADE,
  FOREIGN KEY (DetailID)   REFERENCES ProductDetails(DetailID) ON DELETE CASCADE,
  FOREIGN KEY (OrderID)    REFERENCES Orders(OrderID) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_products_category    ON Products(CategoryID);
CREATE INDEX IF NOT EXISTS idx_mappings_productid   ON ProductPlatformMappings(ProductID);
CREATE INDEX IF NOT EXISTS idx_mappings_platformid  ON ProductPlatformMappings(PlatformID);
CREATE INDEX IF NOT EXISTS idx_mappings_detailid    ON ProductPlatformMappings(DetailID);
CREATE INDEX IF NOT EXISTS idx_mappings_orderid     ON ProductPlatformMappings(OrderID);
CREATE INDEX IF NOT EXISTS idx_mappings_date        ON ProductPlatformMappings(DateRecorded);
CREATE INDEX IF NOT EXISTS idx_platformfees_plat    ON PlatformFees(PlatformID);
CREATE INDEX IF NOT EXISTS idx_details_productid    ON ProductDetails(ProductID);
CREATE INDEX IF NOT EXISTS idx_detailcosts_detailid ON DetailCosts(DetailID);
CREATE INDEX IF NOT EXISTS idx_productcosts_product ON ProductCosts(ProductID);
CREATE INDEX IF NOT EXISTS idx_orders_platform      ON Orders(PlatformID);
CREATE INDEX IF NOT EXISTS idx_orders_date          ON Orders(DateRecorded);
CREATE INDEX IF NOT EXISTS idx_ordercosts_orderid   ON OrderCosts(OrderID);

-- ─── Currencies ────────────────────────────────────────────────────────────
-- Named currencies and their exchange rate to NT$. 'TWD' is the base (rate 1)
-- and is protected from edit/delete. Used by all cost line-items.
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

// Per-detail summed NT$ cost (each cost line converted via its currency rate).
const DETAIL_COST_JOIN = `
  LEFT JOIN (
    SELECT dc.DetailID, SUM(dc.Amount * COALESCE(cur.RateToTWD, 1)) AS DetailCostNTD
    FROM DetailCosts dc
    LEFT JOIN Currencies cur ON cur.CurrencyCode = dc.CurrencyCode
    GROUP BY dc.DetailID
  ) dcost ON dcost.DetailID = ppm.DetailID`

// Per-product summed NT$ cost (each cost line converted via its currency rate).
const PRODUCT_COST_JOIN = `
  LEFT JOIN (
    SELECT pc.ProductID, SUM(pc.Amount * COALESCE(cur.RateToTWD, 1)) AS ProductCostNTD
    FROM ProductCosts pc
    LEFT JOIN Currencies cur ON cur.CurrencyCode = pc.CurrencyCode
    GROUP BY pc.ProductID
  ) pcost ON pcost.ProductID = ppm.ProductID`

// Per-unit cost in NT$: a detail-level line uses the detail's summed cost,
// otherwise the product's summed cost line-items.
const COST_NTD_EXPR = `
  (CASE WHEN ppm.DetailID IS NULL
        THEN COALESCE(pcost.ProductCostNTD, 0)
        ELSE COALESCE(dcost.DetailCostNTD, 0) END)`

// Per-unit net-profit expression, reused so the formula lives in one place.
//   NetProfit = SellingPrice - Cost_NTD - SellingPrice*fee% - fixedFee
const NET_PROFIT_EXPR = `
  (ppm.SellingPrice
   - ${COST_NTD_EXPR}
   - (ppm.SellingPrice * COALESCE(fee.TotalFeePercentage, 0) / 100.0)
   - COALESCE(fee.TotalFixedFee, 0))`

const COST_JOINS = `${FEE_SUM_JOIN}\n${DETAIL_COST_JOIN}\n${PRODUCT_COST_JOIN}`

// ─── Analytics SQL ────────────────────────────────────────────────────────────
// Caller passes { startDate, endDate, platformID, productID, detailID, categoryID }.
// Only sold lines (OrderID NOT NULL) participate — listing-only rows are excluded.

const SALES_FILTER = `
WHERE ppm.OrderID IS NOT NULL
  AND ppm.DateRecorded BETWEEN :startDate AND :endDate
  AND (:platformID IS NULL OR ppm.PlatformID = :platformID)
  AND (:productID IS NULL OR ppm.ProductID = :productID)
  AND (:detailID IS NULL OR ppm.DetailID = :detailID)
  AND (:categoryID IS NULL OR p.CategoryID = :categoryID)`

export const MAPPINGS_WITH_CALC_SQL = `
SELECT
  ppm.*,
  pl.PlatformName,
  pd.DetailName,
  p.CategoryID,
  p.ImageKey,
  p.ImagePath,
  p.StockQuantity,
  p.LocalFolderPath,
  COALESCE(fee.TotalFeePercentage, 0)                          AS TotalFeePercentage,
  COALESCE(fee.TotalFixedFee, 0)                               AS TotalFixedFee,
  ${COST_NTD_EXPR}                                             AS Cost_NTD,
  ${NET_PROFIT_EXPR}                                           AS NetProfit,
  CASE
    WHEN ${COST_NTD_EXPR} > 0
    THEN ${NET_PROFIT_EXPR} / ${COST_NTD_EXPR} * 100.0
    ELSE 0
  END                                                          AS NetProfitMargin,
  (${NET_PROFIT_EXPR} * ppm.SalesVolume)                       AS TotalEarnings,
  (ppm.SellingPrice * ppm.SalesVolume)                         AS GrossRevenue
FROM ProductPlatformMappings ppm
JOIN Products  p  ON ppm.ProductID  = p.ProductID
JOIN Platforms pl ON ppm.PlatformID = pl.PlatformID
LEFT JOIN ProductDetails pd ON pd.DetailID = ppm.DetailID
${COST_JOINS}
${SALES_FILTER}
ORDER BY ppm.DateRecorded DESC
`

// Sold lines for a SINGLE order, with per-line calc. Used to hydrate one order.
export const ITEMS_BY_ORDER_SQL = `
SELECT
  ppm.*,
  pl.PlatformName,
  pd.DetailName,
  p.CategoryID,
  p.ImageKey,
  p.ImagePath,
  ${COST_NTD_EXPR}                                             AS Cost_NTD,
  ${NET_PROFIT_EXPR}                                           AS NetProfit,
  (${NET_PROFIT_EXPR} * ppm.SalesVolume)                       AS TotalEarnings,
  (ppm.SellingPrice * ppm.SalesVolume)                         AS GrossRevenue
FROM ProductPlatformMappings ppm
JOIN Products  p  ON ppm.ProductID  = p.ProductID
JOIN Platforms pl ON ppm.PlatformID = pl.PlatformID
LEFT JOIN ProductDetails pd ON pd.DetailID = ppm.DetailID
${COST_JOINS}
WHERE ppm.OrderID = :orderID
ORDER BY ppm.MappingID ASC
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
  SUM(${COST_NTD_EXPR} * ppm.SalesVolume)           AS TotalCost,
  CASE
    WHEN SUM(${COST_NTD_EXPR} * ppm.SalesVolume) > 0
    THEN SUM(${NET_PROFIT_EXPR} * ppm.SalesVolume)
         / SUM(${COST_NTD_EXPR} * ppm.SalesVolume) * 100.0
    ELSE 0
  END                                               AS NetProfitMargin
FROM ProductPlatformMappings ppm
JOIN Products  p  ON ppm.ProductID  = p.ProductID
JOIN Platforms pl ON ppm.PlatformID = pl.PlatformID
${COST_JOINS}
${SALES_FILTER}
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
${COST_JOINS}
${SALES_FILTER}
GROUP BY DATE(ppm.DateRecorded), ppm.PlatformID
ORDER BY date ASC
`

// Σ of all order-level extra costs (currency-converted) for orders matching the
// filter — subtracted from the analytics dashboard's overall earnings.
export const ORDER_EXTRA_COST_SQL = `
SELECT COALESCE(SUM(oc.Amount * COALESCE(cur.RateToTWD, 1)), 0) AS total
FROM OrderCosts oc
JOIN Orders o ON o.OrderID = oc.OrderID
LEFT JOIN Currencies cur ON cur.CurrencyCode = oc.CurrencyCode
WHERE o.DateRecorded BETWEEN :startDate AND :endDate
  AND (:platformID IS NULL OR o.PlatformID = :platformID)
`
