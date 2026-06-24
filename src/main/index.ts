import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

import { closeDb } from './database/DatabaseManager'
import { initAuth } from './auth/AuthManager'
import { registerAuthHandlers } from './ipc/authHandlers'
import { SqliteProductRepository } from './repositories/SqliteProductRepository'
import { SqlitePlatformRepository } from './repositories/SqlitePlatformRepository'
import { SqlitePlatformFeeRepository } from './repositories/SqlitePlatformFeeRepository'
import { SqliteMappingRepository } from './repositories/SqliteMappingRepository'
import { SqliteCategoryRepository } from './repositories/SqliteCategoryRepository'
import { SqliteDetailRepository } from './repositories/SqliteDetailRepository'
import { SqliteOrderRepository } from './repositories/SqliteOrderRepository'
import { InventoryService } from './core/services/InventoryService'
import { SalesAnalyticsService } from './core/services/SalesAnalyticsService'
import { OrderService } from './core/services/OrderService'
import { registerProductHandlers } from './ipc/productHandlers'
import { registerPlatformHandlers } from './ipc/platformHandlers'
import { registerMappingHandlers } from './ipc/mappingHandlers'
import { registerOrderHandlers } from './ipc/orderHandlers'
import { registerSettingsHandlers } from './ipc/settingsHandlers'
import { registerCategoryHandlers } from './ipc/categoryHandlers'
import { registerCurrencyHandlers } from './ipc/currencyHandlers'
import { registerDetailHandlers } from './ipc/detailHandlers'
import { registerSystemHandlers } from './ipc/systemHandlers'
import { IPC } from '../shared/types'

// ─── Composition Root ────────────────────────────────────────────────────────
// Wire up the dependency graph here. Swap any repository implementation or
// adapter without touching the services or IPC handlers.

async function bootstrap(): Promise<void> {
  // Auth DB is opened now; the per-user DATA db is opened later, on login.
  await initAuth()

  const productRepo     = new SqliteProductRepository()
  const platformRepo    = new SqlitePlatformRepository()
  const platformFeeRepo = new SqlitePlatformFeeRepository()
  const mappingRepo     = new SqliteMappingRepository()
  const categoryRepo    = new SqliteCategoryRepository()
  const detailRepo      = new SqliteDetailRepository()
  const orderRepo       = new SqliteOrderRepository()

  const inventoryService = new InventoryService(
    productRepo,
    platformRepo,
    mappingRepo,
    categoryRepo,
    platformFeeRepo,
    detailRepo
  )
  const analyticsService = new SalesAnalyticsService(mappingRepo)
  const orderService = new OrderService(orderRepo, productRepo, platformRepo)

  registerAuthHandlers()
  registerCategoryHandlers(inventoryService)
  registerCurrencyHandlers()
  registerDetailHandlers(inventoryService)
  registerProductHandlers(inventoryService)
  registerPlatformHandlers(inventoryService)
  registerMappingHandlers(inventoryService, analyticsService)
  registerOrderHandlers(orderService)
  registerSettingsHandlers()
  registerSystemHandlers()
  registerWindowHandlers()
}

// ─── Electron Windows ──────────────────────────────────────────────────────────

// `hash` lets us open the renderer at a sub-route (used for the pop-out compare
// window on a second monitor).
function createWindow(hash = '', opts: Electron.BrowserWindowConstructorOptions = {}): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    title: 'SIMS 庫存系統',
    ...opts,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.on('ready-to-show', () => win.show())

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'] + (hash ? `#${hash}` : ''))
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), hash ? { hash } : undefined)
  }
  return win
}

// The single independent "新增銷售紀錄" window, plus the product currently being
// dragged from a main window towards it.
let orderWindow: BrowserWindow | null = null
let dragProductID: string | null = null

function isOverOrderWindow(x: number, y: number): boolean {
  if (!orderWindow || orderWindow.isDestroyed() || !orderWindow.isVisible() || orderWindow.isMinimized()) return false
  const b = orderWindow.getBounds()
  return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height
}

function registerWindowHandlers(): void {
  // Pop out a single comparison panel into its own window (dual-monitor use).
  ipcMain.handle(
    IPC.WINDOW.OPEN_COMPARE,
    (_e, payload: { platformID: string | null; productID?: string | null; categoryID?: string | null; time: string; label: string; mode?: string }) => {
    const params = new URLSearchParams({
      platform: payload.platformID ?? '',
      product: payload.productID ?? '',
      category: payload.categoryID ?? '',
      time: payload.time,
      label: payload.label
    })
    const win = createWindow(`popout?${params.toString()}`, {
      width: 720,
      height: 820,
      title: `對比視窗 ${payload.label}`
    })
    return win.id
  })

  // Open (or focus) the independent order window. A real OS window can be moved
  // outside the main window and survives the main window being minimised.
  ipcMain.handle(IPC.WINDOW.OPEN_ORDER, (_e, prefillProductID: string | null) => {
    if (orderWindow && !orderWindow.isDestroyed()) {
      if (orderWindow.isMinimized()) orderWindow.restore()
      orderWindow.show()
      orderWindow.focus()
      if (prefillProductID) orderWindow.webContents.send(IPC.WINDOW.ORDER_ADD_PRODUCT, prefillProductID)
      return
    }
    const win = createWindow('order', {
      width: 700, height: 880, minWidth: 460, minHeight: 560, title: '新增銷售紀錄'
    })
    orderWindow = win
    win.on('closed', () => { if (orderWindow === win) orderWindow = null })
    if (prefillProductID) {
      win.webContents.once('did-finish-load', () => {
        if (!win.isDestroyed()) win.webContents.send(IPC.WINDOW.ORDER_ADD_PRODUCT, prefillProductID)
      })
    }
  })

  // Custom cross-window product drag (HTML5 DnD cannot cross OS windows).
  ipcMain.on(IPC.WINDOW.DRAG_BEGIN, (_e, productID: string) => { dragProductID = productID })
  ipcMain.on(IPC.WINDOW.DRAG_MOVE, (_e, x: number, y: number) => {
    if (!dragProductID || !orderWindow || orderWindow.isDestroyed()) return
    orderWindow.webContents.send(IPC.WINDOW.ORDER_HOVER, isOverOrderWindow(x, y))
  })
  ipcMain.on(IPC.WINDOW.DRAG_END, (_e, x: number, y: number) => {
    const pid = dragProductID
    dragProductID = null
    if (!orderWindow || orderWindow.isDestroyed()) return
    orderWindow.webContents.send(IPC.WINDOW.ORDER_HOVER, false)
    if (pid && isOverOrderWindow(x, y)) {
      orderWindow.show()
      orderWindow.focus()
      orderWindow.webContents.send(IPC.WINDOW.ORDER_ADD_PRODUCT, pid)
    }
  })
}

// ─── App Lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  try {
    await bootstrap()
  } catch (err) {
    // Surface startup/DB failures instead of leaving the user with no window.
    dialog.showErrorBox(
      'SIMS 啟動失敗',
      `資料庫或初始化發生錯誤：\n\n${err instanceof Error ? err.stack ?? err.message : String(err)}`
    )
    app.quit()
    return
  }
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  closeDb()
  if (process.platform !== 'darwin') app.quit()
})
