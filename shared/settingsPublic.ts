import type { AppSettings, AppSettingsPublic } from './types'

/**
 * 生成下发给渲染进程的设置副本：去掉 lanPasswordHash，避免哈希进入渲染层。
 */
export function stripSettingsForRenderer(settings: AppSettings): AppSettingsPublic {
  const { lanPasswordHash: _omit, ...rest } = settings
  return rest
}
