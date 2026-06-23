import { ipcMain } from 'electron'
import { IPC } from '@shared/types'
import type { OrderService } from '../core/services/OrderService'
import type { AnalyticsFilter, CreateOrderInput } from '@shared/types'

export function registerOrderHandlers(orderService: OrderService): void {
  ipcMain.handle(IPC.ORDERS.GET_ALL, (_e, filter: AnalyticsFilter) => orderService.getOrders(filter))

  ipcMain.handle(IPC.ORDERS.CREATE, (_e, input: CreateOrderInput) => orderService.createOrder(input))

  ipcMain.handle(IPC.ORDERS.UPDATE, (_e, orderID: string, input: CreateOrderInput) =>
    orderService.updateOrder(orderID, input)
  )

  ipcMain.handle(IPC.ORDERS.DELETE, (_e, orderID: string) => {
    orderService.deleteOrder(orderID)
    return true
  })
}
