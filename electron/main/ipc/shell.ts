import { shell } from 'electron'
import { existsSync } from 'fs'
import { IpcChannels } from '../../../shared/types'
import { isPathAllowed, pathNotAllowedError } from '../pathAllowlist'
import { handleFromMainWindow } from '../ipcGuard'

/** 系统打开路径 / 在文件夹中显示 */
export function registerShellIpc(): void {
  handleFromMainWindow(IpcChannels.OPEN_PATH, async (_e, p: string) => {
    try {
      if (!p || typeof p !== 'string') {
        return { ok: false, error: '路径无效' }
      }
      if (!isPathAllowed(p)) {
        return { ok: false, error: pathNotAllowedError() }
      }
      if (!existsSync(p)) {
        return { ok: false, error: '路径不存在' }
      }
      const err = await shell.openPath(p)
      if (err) {
        return { ok: false, error: err }
      }
      return { ok: true }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { ok: false, error: msg }
    }
  })

  handleFromMainWindow(IpcChannels.SHOW_ITEM_IN_FOLDER, async (_e, p: string) => {
    try {
      if (!p || typeof p !== 'string') {
        return { ok: false, error: pathNotAllowedError() }
      }
      if (!isPathAllowed(p)) {
        return { ok: false, error: pathNotAllowedError() }
      }
      shell.showItemInFolder(p)
      return { ok: true }
    } catch {
      return { ok: false }
    }
  })
}
