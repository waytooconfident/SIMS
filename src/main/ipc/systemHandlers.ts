import { ipcMain, shell } from 'electron'
import fs from 'fs'
import path from 'path'
import { IPC } from '@shared/types'

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.avif': 'image/avif'
}

export function registerSystemHandlers(): void {
  // Open a local folder in the OS file explorer.
  ipcMain.handle(IPC.SHELL.OPEN_FOLDER, async (_e, folderPath: string) => {
    const err = await shell.openPath(folderPath)
    return err === '' ? { success: true } : { success: false, message: err }
  })

  // Read a local image and return it as a data URL so the sandboxed renderer can
  // display it without us having to disable webSecurity or register a protocol.
  ipcMain.handle(IPC.IMAGES.GET_DATA_URL, (_e, filePath: string): string | null => {
    try {
      if (!filePath || !fs.existsSync(filePath)) return null
      const ext = path.extname(filePath).toLowerCase()
      const mime = MIME[ext] ?? 'application/octet-stream'
      const buf = fs.readFileSync(filePath)
      return `data:${mime};base64,${buf.toString('base64')}`
    } catch {
      return null
    }
  })
}
