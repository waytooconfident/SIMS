import { ipcMain } from 'electron'
import { IPC } from '@shared/types'
import type { CreateUserInput, UpdateUserInput } from '@shared/types'
import * as Auth from '../auth/AuthManager'

export function registerAuthHandlers(): void {
  ipcMain.handle(IPC.AUTH.LIST_USERS, () => Auth.listUsers())
  ipcMain.handle(IPC.AUTH.CREATE_USER, (_e, input: CreateUserInput) => Auth.createUser(input))
  ipcMain.handle(IPC.AUTH.UPDATE_USER, (_e, userId: string, input: UpdateUserInput) => Auth.updateUser(userId, input))
  ipcMain.handle(IPC.AUTH.DELETE_USER, (_e, userId: string) => { Auth.deleteUser(userId); return true })
  ipcMain.handle(IPC.AUTH.LOGIN, (_e, userId: string, password: string, remember: boolean) => Auth.login(userId, password, remember))
  ipcMain.handle(IPC.AUTH.REMEMBERED_PASSWORD, (_e, userId: string) => Auth.rememberedPassword(userId))
  ipcMain.handle(IPC.AUTH.AUTO_LOGIN, () => Auth.autoLogin())
  ipcMain.handle(IPC.AUTH.LOGOUT, () => { Auth.logout(); return true })
  ipcMain.handle(IPC.AUTH.CURRENT, () => Auth.currentUser())
  ipcMain.handle(IPC.AUTH.LAST_USER, () => Auth.lastUserId())
}
