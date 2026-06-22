import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { IPC } from '@shared/types'
import type {
  CreateUserInput,
  UpdateUserInput,
  CreateCategoryInput,
  UpdateCategoryInput,
  CreateCurrencyInput,
  UpdateCurrencyInput,
  CreateProductInput,
  UpdateProductInput,
  CreatePlatformInput,
  UpdatePlatformInput,
  CreatePlatformFeeInput,
  UpdatePlatformFeeInput,
  CreateMappingInput,
  UpdateMappingInput,
  AnalyticsFilter,
  SellInput
} from '@shared/types'

// Expose a typed `window.api` to the renderer.
// ONLY the methods listed here cross the security boundary — nothing else.
const api = {
  auth: {
    listUsers: () => ipcRenderer.invoke(IPC.AUTH.LIST_USERS),
    createUser: (input: CreateUserInput) => ipcRenderer.invoke(IPC.AUTH.CREATE_USER, input),
    updateUser: (userId: string, input: UpdateUserInput) => ipcRenderer.invoke(IPC.AUTH.UPDATE_USER, userId, input),
    deleteUser: (userId: string) => ipcRenderer.invoke(IPC.AUTH.DELETE_USER, userId),
    login: (userId: string, password: string, remember: boolean) => ipcRenderer.invoke(IPC.AUTH.LOGIN, userId, password, remember),
    rememberedPassword: (userId: string): Promise<string | null> => ipcRenderer.invoke(IPC.AUTH.REMEMBERED_PASSWORD, userId),
    autoLogin: () => ipcRenderer.invoke(IPC.AUTH.AUTO_LOGIN),
    logout: () => ipcRenderer.invoke(IPC.AUTH.LOGOUT),
    current: () => ipcRenderer.invoke(IPC.AUTH.CURRENT),
    lastUser: () => ipcRenderer.invoke(IPC.AUTH.LAST_USER)
  },

  categories: {
    getAll: () => ipcRenderer.invoke(IPC.CATEGORIES.GET_ALL),
    create: (input: CreateCategoryInput) => ipcRenderer.invoke(IPC.CATEGORIES.CREATE, input),
    update: (id: string, input: UpdateCategoryInput) => ipcRenderer.invoke(IPC.CATEGORIES.UPDATE, id, input),
    delete: (id: string) => ipcRenderer.invoke(IPC.CATEGORIES.DELETE, id)
  },

  currencies: {
    getAll: () => ipcRenderer.invoke(IPC.CURRENCIES.GET_ALL),
    create: (input: CreateCurrencyInput) => ipcRenderer.invoke(IPC.CURRENCIES.CREATE, input),
    update: (code: string, input: UpdateCurrencyInput) => ipcRenderer.invoke(IPC.CURRENCIES.UPDATE, code, input),
    delete: (code: string) => ipcRenderer.invoke(IPC.CURRENCIES.DELETE, code)
  },

  products: {
    getAll: () => ipcRenderer.invoke(IPC.PRODUCTS.GET_ALL),
    create: (input: CreateProductInput) => ipcRenderer.invoke(IPC.PRODUCTS.CREATE, input),
    update: (productID: string, input: UpdateProductInput) =>
      ipcRenderer.invoke(IPC.PRODUCTS.UPDATE, productID, input),
    delete: (productID: string) => ipcRenderer.invoke(IPC.PRODUCTS.DELETE, productID),
    recategorize: (productID: string, categoryID: string) =>
      ipcRenderer.invoke(IPC.PRODUCTS.RECATEGORIZE, productID, categoryID),
    sell: (input: SellInput) => ipcRenderer.invoke(IPC.PRODUCTS.SELL, input),
    reorder: (orderedIds: string[]) => ipcRenderer.invoke(IPC.PRODUCTS.REORDER, orderedIds)
  },

  platforms: {
    getAll: () => ipcRenderer.invoke(IPC.PLATFORMS.GET_ALL),
    create: (input: CreatePlatformInput) => ipcRenderer.invoke(IPC.PLATFORMS.CREATE, input),
    update: (platformID: string, input: UpdatePlatformInput) =>
      ipcRenderer.invoke(IPC.PLATFORMS.UPDATE, platformID, input),
    delete: (platformID: string) => ipcRenderer.invoke(IPC.PLATFORMS.DELETE, platformID)
  },

  platformFees: {
    getByPlatform: (platformID: string) => ipcRenderer.invoke(IPC.PLATFORM_FEES.GET_BY_PLATFORM, platformID),
    create: (input: CreatePlatformFeeInput) => ipcRenderer.invoke(IPC.PLATFORM_FEES.CREATE, input),
    update: (feeID: string, input: UpdatePlatformFeeInput) =>
      ipcRenderer.invoke(IPC.PLATFORM_FEES.UPDATE, feeID, input),
    delete: (feeID: string) => ipcRenderer.invoke(IPC.PLATFORM_FEES.DELETE, feeID)
  },

  mappings: {
    getAll: (filter: AnalyticsFilter) => ipcRenderer.invoke(IPC.MAPPINGS.GET_ALL, filter),
    create: (input: CreateMappingInput) => ipcRenderer.invoke(IPC.MAPPINGS.CREATE, input),
    update: (mappingID: string, input: UpdateMappingInput) =>
      ipcRenderer.invoke(IPC.MAPPINGS.UPDATE, mappingID, input),
    delete: (mappingID: string) => ipcRenderer.invoke(IPC.MAPPINGS.DELETE, mappingID),
    updateListing: (productID: string, platformID: string, title: string, description: string) =>
      ipcRenderer.invoke(IPC.MAPPINGS.UPDATE_LISTING, productID, platformID, title, description),
    deleteListing: (productID: string, platformID: string) =>
      ipcRenderer.invoke(IPC.MAPPINGS.DELETE_LISTING, productID, platformID),
    getAnalytics: (filter: AnalyticsFilter) => ipcRenderer.invoke(IPC.MAPPINGS.GET_ANALYTICS, filter),
    getChartData: (filter: AnalyticsFilter) => ipcRenderer.invoke(IPC.MAPPINGS.GET_CHART_DATA, filter)
  },

  settings: {
    get: (key: string): Promise<string | null> => ipcRenderer.invoke(IPC.SETTINGS.GET, key),
    set: (key: string, value: string): Promise<void> => ipcRenderer.invoke(IPC.SETTINGS.SET, key, value)
  },

  shell: {
    openFolder: (path: string): Promise<{ success: boolean; message?: string }> =>
      ipcRenderer.invoke(IPC.SHELL.OPEN_FOLDER, path)
  },

  images: {
    getDataUrl: (path: string): Promise<string | null> => ipcRenderer.invoke(IPC.IMAGES.GET_DATA_URL, path)
  },

  files: {
    // Electron's supported way to recover a dropped/picked File's absolute path.
    getPathForFile: (file: File): string => webUtils.getPathForFile(file)
  },

  window: {
    openCompare: (payload: {
      platformID: string | null
      productID?: string | null
      categoryID?: string | null
      time: string
      label: string
      mode?: string
    }): Promise<number> => ipcRenderer.invoke(IPC.WINDOW.OPEN_COMPARE, payload)
  }
}

contextBridge.exposeInMainWorld('api', api)

// Export the type so the renderer's env.d.ts can reference it
export type Api = typeof api
