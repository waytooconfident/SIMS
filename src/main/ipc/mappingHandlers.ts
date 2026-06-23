import { ipcMain } from 'electron'
import { IPC } from '@shared/types'
import type { InventoryService } from '../core/services/InventoryService'
import type { SalesAnalyticsService } from '../core/services/SalesAnalyticsService'
import type {
  CreateMappingInput,
  UpdateMappingInput,
  AnalyticsFilter
} from '@shared/types'

export function registerMappingHandlers(
  inventoryService: InventoryService,
  analyticsService: SalesAnalyticsService
): void {
  ipcMain.handle(IPC.MAPPINGS.GET_ALL, (_e, filter: AnalyticsFilter) =>
    analyticsService.getMappingsWithCalc(filter)
  )

  ipcMain.handle(IPC.MAPPINGS.GET_LISTINGS, () => inventoryService.getListings())

  ipcMain.handle(IPC.MAPPINGS.CREATE, (_e, input: CreateMappingInput) =>
    inventoryService.createMapping(input)
  )

  ipcMain.handle(IPC.MAPPINGS.UPDATE, (_e, mappingID: string, input: UpdateMappingInput) =>
    inventoryService.updateMapping(mappingID, input)
  )

  ipcMain.handle(IPC.MAPPINGS.DELETE, (_e, mappingID: string) => {
    inventoryService.deleteMapping(mappingID)
    return true
  })

  ipcMain.handle(
    IPC.MAPPINGS.UPDATE_LISTING,
    (_e, productID: string, platformID: string, title: string, description: string) => {
      inventoryService.updateListing(productID, platformID, title, description)
      return true
    }
  )

  ipcMain.handle(IPC.MAPPINGS.DELETE_LISTING, (_e, productID: string, platformID: string) => {
    inventoryService.deleteListing(productID, platformID)
    return true
  })

  ipcMain.handle(IPC.MAPPINGS.GET_ANALYTICS, (_e, filter: AnalyticsFilter) =>
    analyticsService.getAnalyticsSummary(filter)
  )

  ipcMain.handle(IPC.MAPPINGS.GET_CHART_DATA, (_e, filter: AnalyticsFilter) =>
    analyticsService.getChartData(filter)
  )

  ipcMain.handle(IPC.MAPPINGS.GET_ORDER_COST_TOTAL, (_e, filter: AnalyticsFilter) =>
    analyticsService.getOrderExtraCostTotal(filter)
  )
}
