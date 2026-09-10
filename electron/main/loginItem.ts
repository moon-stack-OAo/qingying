import { app } from 'electron'

const LOGIN_HIDDEN_ARG = '--hidden'

export function shouldStartHiddenToTray(): boolean {
  if (process.argv.includes(LOGIN_HIDDEN_ARG)) return true
  try {
    return Boolean(app.getLoginItemSettings().wasOpenedAsHidden)
  } catch {
    return false
  }
}

/** 同步系统登录项（Windows / macOS；Linux 无实际效果） */
export function applyLoginItemSettings(settings: {
  openAtLogin: boolean
  startMinimizedToTray: boolean
}): void {
  if (process.platform !== 'win32' && process.platform !== 'darwin') return
  const openAtLogin = Boolean(settings.openAtLogin)
  const startMinimizedToTray = openAtLogin && Boolean(settings.startMinimizedToTray)
  try {
    if (process.platform === 'win32') {
      app.setLoginItemSettings({
        openAtLogin,
        path: process.execPath,
        args: startMinimizedToTray ? [LOGIN_HIDDEN_ARG] : []
      })
      return
    }
    app.setLoginItemSettings({
      openAtLogin,
      openAsHidden: startMinimizedToTray
    })
  } catch (err) {
    console.warn('[main] setLoginItemSettings failed:', err)
  }
}
