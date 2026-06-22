import { ipcMain } from 'electron'
import { IPC } from '@shared/types'
import type { InventoryService } from '../core/services/InventoryService'
import type {
  CreatePlatformInput,
  UpdatePlatformInput,
  CreatePlatformFeeInput,
  UpdatePlatformFeeInput
} from '@shared/types'

export function registerPlatformHandlers(service: InventoryService): void {
  ipcMain.handle(IPC.PLATFORMS.GET_ALL, () => service.getAllPlatforms())

  ipcMain.handle(IPC.PLATFORMS.CREATE, (_e, input: CreatePlatformInput) => service.createPlatform(input))

  ipcMain.handle(IPC.PLATFORMS.UPDATE, (_e, platformID: string, input: UpdatePlatformInput) =>
    service.updatePlatform(platformID, input)
  )

  ipcMain.handle(IPC.PLATFORMS.DELETE, (_e, platformID: string) => {
    service.deletePlatform(platformID)
    return true
  })

  // ─── Fee line-items ───────────────────────────────────────────────────────
  ipcMain.handle(IPC.PLATFORM_FEES.GET_BY_PLATFORM, (_e, platformID: string) =>
    service.getPlatformFees(platformID)
  )

  ipcMain.handle(IPC.PLATFORM_FEES.CREATE, (_e, input: CreatePlatformFeeInput) =>
    service.createPlatformFee(input)
  )

  ipcMain.handle(IPC.PLATFORM_FEES.UPDATE, (_e, feeID: string, input: UpdatePlatformFeeInput) =>
    service.updatePlatformFee(feeID, input)
  )

  ipcMain.handle(IPC.PLATFORM_FEES.DELETE, (_e, feeID: string) => {
    service.deletePlatformFee(feeID)
    return true
  })
}
