import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { UpdateState, UpdateStatusPayload } from '@shared/types'

/** 开发态 UI 预览用假数据（不走真实更新） */
const PREVIEW_NOTES = `## 新特性
- 更新弹窗改为系统更新风格
- 优化暗色主题对比度

## 修复
- 修复下载进度显示抖动
- 其它稳定性改进`

/** 应用版本与自动更新 */
export function useUpdater() {
  const appVersion = ref('—')
  const isPackaged = ref(false)
  const updateDialogVisible = ref(false)
  const updateChecking = ref(false)
  const updateDownloading = ref(false)
  const updateInfo = ref<UpdateStatusPayload>({ state: 'idle' })

  function applyUpdateStatus(payload: UpdateStatusPayload): void {
    const prev = updateInfo.value
    const silent = Boolean(payload.silent)
    updateInfo.value = {
      ...prev,
      ...payload,
      version: payload.version ?? prev.version,
      releaseNotes: payload.releaseNotes ?? prev.releaseNotes,
      currentVersion: payload.currentVersion || prev.currentVersion || appVersion.value
    }
    updateChecking.value = payload.state === 'checking'
    updateDownloading.value = payload.state === 'downloading'

    if (payload.state === 'available') {
      // 取消下载回到 available 时保持弹窗打开
      if (payload.message?.includes('取消') && updateDialogVisible.value) {
        ElMessage.info(payload.message)
      } else if (!silent) {
        // 启动检查 / 手动检查：弹窗；定时静默检查只更新标题栏 NEW
        updateDialogVisible.value = true
      }
    } else if (payload.state === 'downloaded') {
      updateDialogVisible.value = true
      if (!silent) ElMessage.success(payload.message || '更新已下载')
    } else if (payload.state === 'error') {
      if (!silent) {
        updateDialogVisible.value = true
        ElMessage.error(payload.message || '更新失败')
      }
    } else if (payload.state === 'not-available' && updateDialogVisible.value && !silent) {
      ElMessage.success(payload.message || '已是最新版本')
    }
  }

  async function loadVersion(): Promise<void> {
    try {
      const ver = await window.electronAPI.getAppVersion()
      appVersion.value = ver.version
      isPackaged.value = ver.packaged
    } catch {
      appVersion.value = '—'
    }
  }

  async function onCheckUpdate(): Promise<void> {
    updateDialogVisible.value = true
    updateChecking.value = true
    try {
      const res = await window.electronAPI.checkForUpdates()
      if (res?.state && res.state !== 'checking') {
        applyUpdateStatus(res)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      applyUpdateStatus({ state: 'error', message, currentVersion: appVersion.value })
    } finally {
      updateChecking.value = false
    }
  }

  async function onDownloadUpdate(): Promise<void> {
    updateDownloading.value = true
    try {
      const res = await window.electronAPI.downloadUpdate()
      if (!res.ok) {
        updateDownloading.value = false
        // 取消不弹 error（主进程已推 available + message）
        if (res.error && !res.error.includes('取消')) {
          ElMessage.error(res.error)
          if (updateInfo.value.state !== 'error') {
            applyUpdateStatus({
              state: 'error',
              message: res.error,
              version: updateInfo.value.version,
              currentVersion: appVersion.value
            })
          }
        }
      }
    } catch (err) {
      updateDownloading.value = false
      const message = err instanceof Error ? err.message : String(err)
      ElMessage.error(message || '下载失败')
      applyUpdateStatus({
        state: 'error',
        message: message || '下载失败',
        version: updateInfo.value.version,
        currentVersion: appVersion.value
      })
    }
  }

  async function onCancelDownload(): Promise<void> {
    try {
      const res = await window.electronAPI.cancelUpdateDownload()
      if (!res.ok) {
        ElMessage.warning(res.error || '无法取消下载')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      ElMessage.error(message || '取消下载失败')
    }
  }

  async function onInstallUpdate(): Promise<void> {
    // 先切到安装中 UI（禁关闭），再调主进程；主进程也会推 installing
    updateDialogVisible.value = true
    applyUpdateStatus({
      state: 'installing',
      version: updateInfo.value.version,
      currentVersion: appVersion.value,
      message: '正在安装更新，应用即将重启…',
      percent: 100
    })
    const res = await window.electronAPI.installUpdate()
    if (!res.ok) {
      applyUpdateStatus({
        state: 'error',
        version: updateInfo.value.version,
        currentVersion: appVersion.value,
        message: res.error || '安装失败'
      })
      ElMessage.error(res.error || '安装失败')
    }
  }

  /** 订阅更新状态，返回清理函数 */
  function subscribe(): () => void {
    return window.electronAPI.onUpdateStatus((p) => {
      applyUpdateStatus(p)
    })
  }

  /** 仅开发态：模拟各更新 UI 状态，便于预览弹窗样式 */
  function previewUpdateState(state: UpdateState): void {
    if (isPackaged.value) return
    updateDialogVisible.value = true
    const current = appVersion.value || '0.0.0'
    const next = `v${bumpPatch(current)}`
    const base: UpdateStatusPayload = {
      state,
      currentVersion: current,
      silent: true
    }

    switch (state) {
      case 'idle':
        applyUpdateStatus({ ...base, message: undefined, version: undefined })
        break
      case 'checking':
        applyUpdateStatus({ ...base, message: '正在连接更新服务器…' })
        break
      case 'available':
        applyUpdateStatus({
          ...base,
          version: next,
          message: `发现新版本 ${next}`,
          releaseNotes: PREVIEW_NOTES
        })
        break
      case 'not-available':
        applyUpdateStatus({
          ...base,
          version: current,
          message: `当前已是最新版本 v${current}`
        })
        break
      case 'downloading':
        applyUpdateStatus({
          ...base,
          version: next,
          message: '正在下载更新…',
          percent: 42,
          transferred: 18 * 1024 * 1024,
          total: 42 * 1024 * 1024,
          bytesPerSecond: 2.4 * 1024 * 1024,
          releaseNotes: PREVIEW_NOTES
        })
        break
      case 'downloaded':
        applyUpdateStatus({
          ...base,
          version: next,
          message: `新版本 ${next} 已下载，请点击「安装并重启」`,
          percent: 100,
          releaseNotes: PREVIEW_NOTES
        })
        break
      case 'installing':
        applyUpdateStatus({
          ...base,
          version: next,
          message: '正在安装更新，应用即将重启…',
          percent: 100
        })
        break
      case 'error':
        applyUpdateStatus({
          ...base,
          version: next,
          message: '连接更新服务器超时或中断，请检查网络后重试'
        })
        break
      default:
        applyUpdateStatus(base)
    }
  }

  function bumpPatch(ver: string): string {
    const raw = ver.replace(/^v/i, '')
    const parts = raw.split('.').map((p) => Number.parseInt(p, 10))
    if (parts.length >= 3 && parts.every((n) => Number.isFinite(n))) {
      parts[2] += 1
      return parts.join('.')
    }
    return `${raw || '0.0.0'}-next`
  }

  return {
    appVersion,
    isPackaged,
    updateDialogVisible,
    updateChecking,
    updateDownloading,
    updateInfo,
    applyUpdateStatus,
    loadVersion,
    onCheckUpdate,
    onDownloadUpdate,
    onCancelDownload,
    onInstallUpdate,
    previewUpdateState,
    subscribe
  }
}
