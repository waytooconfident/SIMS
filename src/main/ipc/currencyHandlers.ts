import { ipcMain } from 'electron'
import { IPC } from '@shared/types'
import type { CreateCurrencyInput, UpdateCurrencyInput } from '@shared/types'
import { SqliteCurrencyRepository } from '../repositories/SqliteCurrencyRepository'

export function registerCurrencyHandlers(): void {
  const repo = new SqliteCurrencyRepository()
  ipcMain.handle(IPC.CURRENCIES.GET_ALL, () => repo.findAll())
  ipcMain.handle(IPC.CURRENCIES.CREATE, (_e, input: CreateCurrencyInput) => repo.create(input))
  ipcMain.handle(IPC.CURRENCIES.UPDATE, (_e, code: string, input: UpdateCurrencyInput) => repo.update(code, input))
  ipcMain.handle(IPC.CURRENCIES.DELETE, (_e, code: string) => { repo.delete(code); return true })
}
