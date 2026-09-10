import {
  ipcMain,
  type BrowserWindow,
  type IpcMainEvent,
  type IpcMainInvokeEvent
} from 'electron'

/** 当前主窗口引用（由 createWindow 设置） */
let mainWindowRef: BrowserWindow | null = null

/** 供主进程在创建/重建窗口时同步引用 */
export function setMainWindowRef(win: BrowserWindow | null): void {
  mainWindowRef = win
}

/** 供 IPC 子模块（如 dialog）读取当前主窗口 */
export function getMainWindowRef(): BrowserWindow | null {
  if (!mainWindowRef || mainWindowRef.isDestroyed()) return null
  return mainWindowRef
}

/**
 * 校验 IPC 调用来源是否为主窗口 webContents。
 * 非主窗口（含已销毁）一律拒绝，开发/生产行为一致。
 */
export function assertMainWindowSender(
  event: IpcMainInvokeEvent | IpcMainEvent
): void {
  const win = mainWindowRef
  if (!win || win.isDestroyed()) {
    throw new Error('非法 IPC 调用来源')
  }
  if (event.sender !== win.webContents) {
    throw new Error('非法 IPC 调用来源')
  }
}

/**
 * 注册 invoke：入口先校验 sender 再执行业务 handler。
 * 调用签名与 ipcMain.handle 一致，便于替换。
 */
export function handleFromMainWindow(
  channel: string,
  listener: (
    event: IpcMainInvokeEvent,
    ...args: any[]
  ) => Promise<unknown> | unknown
): void {
  ipcMain.handle(channel, (event, ...args) => {
    assertMainWindowSender(event)
    return listener(event, ...args)
  })
}
