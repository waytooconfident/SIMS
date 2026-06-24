import { ipcMain, BrowserWindow } from 'electron'
import { IPC } from '@shared/types'
import type { OrderService } from '../core/services/OrderService'
import type { AnalyticsFilter, CreateOrderInput } from '@shared/types'

// Tell every window an order changed so their inventory/sales lists refetch —
// orders can now be created from the independent order window too.
function broadcastOrdersChanged(): void {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send(IPC.WINDOW.ORDERS_CHANGED)
  }
}

export function registerOrderHandlers(orderService: OrderService): void {
  ipcMain.handle(IPC.ORDERS.GET_ALL, (_e, filter: AnalyticsFilter) => orderService.getOrders(filter))

  ipcMain.handle(IPC.ORDERS.CREATE, (_e, input: CreateOrderInput) => {
    const result = orderService.createOrder(input)
    broadcastOrdersChanged()
    return result
  })

  ipcMain.handle(IPC.ORDERS.UPDATE, (_e, orderID: string, input: CreateOrderInput) => {
    const result = orderService.updateOrder(orderID, input)
    broadcastOrdersChanged()
    return result
  })

  ipcMain.handle(IPC.ORDERS.DELETE, (_e, orderID: string) => {
    orderService.deleteOrder(orderID)
    broadcastOrdersChanged()
    return true
  })
}
