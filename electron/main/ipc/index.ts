import { registerAppIpc } from './app'
import { registerDialogIpc } from './dialog'
import { registerMediaIpc } from './media'
import { registerSettingsIpc } from './settings'
import { registerShellIpc } from './shell'

/** 注册与主窗口弱耦合的 IPC 域（任务/窗口仍留在 main/index） */
export function registerDomainIpc(): void {
  registerDialogIpc()
  registerSettingsIpc()
  registerMediaIpc()
  registerShellIpc()
  registerAppIpc()
}
