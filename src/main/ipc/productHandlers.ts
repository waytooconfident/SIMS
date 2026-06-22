import { ipcMain } from 'electron'
import { IPC } from '@shared/types'
import type { InventoryService } from '../core/services/InventoryService'
import type { CreateProductInput, UpdateProductInput, SellInput } from '@shared/types'

export function registerProductHandlers(service: InventoryService): void {
  ipcMain.handle(IPC.PRODUCTS.GET_ALL, () => service.getAllProducts())

  ipcMain.handle(IPC.PRODUCTS.CREATE, (_e, input: CreateProductInput) => service.createProduct(input))

  ipcMain.handle(IPC.PRODUCTS.UPDATE, (_e, productID: string, input: UpdateProductInput) =>
    service.updateProduct(productID, input)
  )

  ipcMain.handle(IPC.PRODUCTS.DELETE, (_e, productID: string) => {
    service.deleteProduct(productID)
    return true
  })

  ipcMain.handle(IPC.PRODUCTS.RECATEGORIZE, (_e, productID: string, categoryID: string) =>
    service.recategorizeProduct(productID, categoryID)
  )

  ipcMain.handle(IPC.PRODUCTS.SELL, (_e, input: SellInput) => service.sellProduct(input))

  ipcMain.handle(IPC.PRODUCTS.REORDER, (_e, orderedIds: string[]) => { service.reorderProducts(orderedIds); return true })
}
