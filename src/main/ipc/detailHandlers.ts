import { ipcMain } from 'electron'
import { IPC } from '@shared/types'
import type { InventoryService } from '../core/services/InventoryService'
import type { CreateDetailInput, UpdateDetailInput } from '@shared/types'

export function registerDetailHandlers(service: InventoryService): void {
  ipcMain.handle(IPC.DETAILS.GET_BY_PRODUCT, (_e, productID: string) => service.getDetailsByProduct(productID))
  ipcMain.handle(IPC.DETAILS.GET_ALL, () => service.getAllDetails())
  ipcMain.handle(IPC.DETAILS.CREATE, (_e, input: CreateDetailInput) => service.createDetail(input))
  ipcMain.handle(IPC.DETAILS.UPDATE, (_e, detailID: string, input: UpdateDetailInput) => service.updateDetail(detailID, input))
  ipcMain.handle(IPC.DETAILS.DELETE, (_e, detailID: string) => { service.deleteDetail(detailID); return true })
  ipcMain.handle(IPC.DETAILS.REORDER, (_e, orderedIds: string[]) => { service.reorderDetails(orderedIds); return true })
}
