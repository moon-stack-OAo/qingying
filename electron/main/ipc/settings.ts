import type { AppSettings, LanRemoteConfigInput } from '../../../shared/types'
import { IpcChannels } from '../../../shared/types'
import { stripSettingsForRenderer } from '../../../shared/settingsPublic'
import { setBinaryOverride } from '../ffmpeg'
import { setImageEngine, setMagickPath } from '../image'
import {
  applyLanRemoteConfig,
  getLanStatus,
  refreshLanPairCode,
  stopLanServer,
  syncLanServerFromSettings
} from '../lanServer'
import { applyLoginItemSettings } from '../loginItem'
import { isAllowedOutputDirForPersist } from '../pathAllowlist'
import { getSettings, resetSettings, saveSettings } from '../settings'
import { taskQueue } from '../taskQueue'
import { handleFromMainWindow } from '../ipcGuard'

/** 设置 / 并发 / 局域网 / 二进制覆盖相关 IPC */
export function registerSettingsIpc(): void {
  handleFromMainWindow(IpcChannels.SET_CONCURRENCY, async (_e, n: number) => {
    const concurrency = taskQueue.setConcurrency(Number(n))
    saveSettings({ concurrency })
    return { concurrency }
  })

  handleFromMainWindow(IpcChannels.GET_CONCURRENCY, async () => {
    return { concurrency: taskQueue.getConcurrency() }
  })

  handleFromMainWindow(IpcChannels.SETTINGS_GET, async () => {
    return stripSettingsForRenderer(getSettings())
  })

  handleFromMainWindow(IpcChannels.SETTINGS_SET, async (_e, partial: Partial<AppSettings>) => {
    // ffmpeg bin 目录需主进程校验；无效则回退不保存（避免把无效目录写盘）
    const part = { ...(partial || {}) }
    // 局域网密码哈希仅允许通过 LAN_SET_CONFIG 写入，避免明文/误改
    delete (part as Partial<AppSettings> & { lanPasswordHash?: string }).lanPasswordHash
    if (typeof part.ffmpegBinDir === 'string') {
      const override = setBinaryOverride(part.ffmpegBinDir)
      if (!override.accepted) {
        delete part.ffmpegBinDir
      }
    }
    if (typeof part.imagemagickPath === 'string') {
      const magick = setMagickPath(part.imagemagickPath)
      if (!magick.accepted) {
        delete part.imagemagickPath
      }
    }
    const prev = getSettings()
    // outputDir 必须已在白名单（SELECT_DIR）或与当前可信设置相同，禁止任意路径回灌
    if (typeof part.outputDir === 'string') {
      if (!isAllowedOutputDirForPersist(part.outputDir, prev.outputDir)) {
        delete part.outputDir
      }
    }
    const next = saveSettings(part)
    if (typeof part.concurrency === 'number') {
      taskQueue.setConcurrency(next.concurrency)
    }
    if (typeof part.imageEngine === 'string') {
      setImageEngine(next.imageEngine)
    }
    if (
      typeof part.openAtLogin === 'boolean' ||
      typeof part.startMinimizedToTray === 'boolean'
    ) {
      applyLoginItemSettings(next)
    }
    // 局域网开关/端口/用户名变更时同步 HTTP 服务
    const lanChanged =
      next.lanRemoteEnabled !== prev.lanRemoteEnabled ||
      next.lanPort !== prev.lanPort ||
      next.lanUsername !== prev.lanUsername
    if (lanChanged) {
      void syncLanServerFromSettings()
    }
    return stripSettingsForRenderer(next)
  })

  // 重置全部设置为默认（删除设置文件、清除 ffmpeg / magick 覆盖）
  handleFromMainWindow(IpcChannels.SETTINGS_RESET, async () => {
    stopLanServer()
    const next = resetSettings()
    taskQueue.setConcurrency(next.concurrency)
    setBinaryOverride('')
    setMagickPath('')
    setImageEngine(next.imageEngine)
    applyLoginItemSettings(next)
    return stripSettingsForRenderer(next)
  })

  // 局域网远程访问状态
  handleFromMainWindow(IpcChannels.LAN_GET_STATUS, async () => {
    return getLanStatus()
  })

  // 局域网远程访问配置（开关/端口/账号/密码）
  handleFromMainWindow(
    IpcChannels.LAN_SET_CONFIG,
    async (_e, config: LanRemoteConfigInput) => {
      return applyLanRemoteConfig(config || {})
    }
  )

  handleFromMainWindow(IpcChannels.LAN_REFRESH_PAIR_CODE, async () => {
    return refreshLanPairCode()
  })

  // 自定义 ffmpeg bin 目录（空串=清除覆盖）
  handleFromMainWindow(IpcChannels.FFMPEG_SET_BIN_DIR, async (_e, dir: string) => {
    const value = typeof dir === 'string' ? dir.trim() : ''
    const override = setBinaryOverride(value)
    if (!override.accepted) {
      return { ok: false, error: override.error }
    }
    saveSettings({ ffmpegBinDir: value })
    return { ok: true }
  })

  handleFromMainWindow(IpcChannels.IMAGE_SET_MAGICK_PATH, async (_e, p: string) => {
    const value = typeof p === 'string' ? p.trim() : ''
    const result = setMagickPath(value)
    if (!result.accepted) {
      return { ok: false, error: result.error }
    }
    saveSettings({ imagemagickPath: value })
    return { ok: true }
  })
}
