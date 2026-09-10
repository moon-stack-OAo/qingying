import { app } from 'electron'
import { IpcChannels } from '../../../shared/types'
import { setUserDataDir } from '../dataDir'
import { handleFromMainWindow } from '../ipcGuard'

/** 应用信息 / 数据目录 / 重启 */
export function registerAppIpc(): void {
  handleFromMainWindow(IpcChannels.APP_INFO, async () => {
    return {
      version: app.getVersion(),
      packaged: app.isPackaged,
      electron: process.versions.electron ?? '',
      chrome: process.versions.chrome ?? '',
      node: process.versions.node ?? '',
      userDataPath: app.getPath('userData')
    }
  })

  handleFromMainWindow(IpcChannels.SET_DATA_DIR, async (_e, dir: string) => {
    return setUserDataDir(typeof dir === 'string' ? dir : '')
  })

  handleFromMainWindow(IpcChannels.RELAUNCH_APP, async () => {
    app.relaunch()
    app.exit(0)
  })
}
