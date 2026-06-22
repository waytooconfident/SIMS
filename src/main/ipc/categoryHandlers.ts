import { ipcMain } from 'electron'
import { IPC } from '@shared/types'
import type { InventoryService } from '../core/services/InventoryService'
import type { CreateCategoryInput, UpdateCategoryInput } from '@shared/types'

export function registerCategoryHandlers(service: InventoryService): void {
  ipcMain.handle(IPC.CATEGORIES.GET_ALL, () => service.getAllCategories())

  ipcMain.handle(IPC.CATEGORIES.CREATE, (_e, input: CreateCategoryInput) => service.createCategory(input))

  ipcMain.handle(IPC.CATEGORIES.UPDATE, (_e, categoryID: string, input: UpdateCategoryInput) =>
    service.updateCategory(categoryID, input)
  )

  ipcMain.handle(IPC.CATEGORIES.DELETE, (_e, categoryID: string) => {
    service.deleteCategory(categoryID)
    return true
  })
}
