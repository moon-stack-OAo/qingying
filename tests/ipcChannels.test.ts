import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'
import { IpcChannels } from '../shared/types'

/**
 * IPC 通道对账（建议级）
 * - 完整：IpcChannels ↔ ElectronAPI 方法语义映射（types 层）
 * - 静态：preload invoke/on 与 main handleFromMainWindow / ipcMain.on 引用的通道值
 * 说明：main 注册分散在 index.ts / updater.ts；FILES_DROPPED_FROM_PRELOAD 用 ipcMain.on。
 * 本测不做 AST，字符串包含即可；漏注册会在差集中暴露。
 */

const ROOT = resolve(__dirname, '..')

/** ElectronAPI 方法 → 对应 IpcChannels 键（getPathForFile 为 preload 本地，无通道） */
const API_TO_CHANNEL: Record<string, keyof typeof IpcChannels | null> = {
  selectFiles: 'SELECT_FILES',
  selectDirectory: 'SELECT_DIR',
  selectImage: 'SELECT_IMAGE',
  getFfmpegStatus: 'GET_FFMPEG_STATUS',
  detectEncoders: 'DETECT_ENCODERS',
  getPathForFile: null,
  startTask: 'START_TASK',
  startTasks: 'START_TASKS',
  cancelTask: 'CANCEL_TASK',
  cancelAll: 'CANCEL_ALL',
  setConcurrency: 'SET_CONCURRENCY',
  getConcurrency: 'GET_CONCURRENCY',
  getSettings: 'SETTINGS_GET',
  setSettings: 'SETTINGS_SET',
  setFfmpegBinDir: 'FFMPEG_SET_BIN_DIR',
  getImageEngineStatus: 'IMAGE_STATUS',
  processImage: 'IMAGE_PROCESS',
  setMagickPath: 'IMAGE_SET_MAGICK_PATH',
  getImageInfo: 'IMAGE_GET_INFO',
  getImageDataUrl: 'IMAGE_GET_DATA_URL',
  extractVideoFrame: 'VIDEO_EXTRACT_FRAME',
  getLanStatus: 'LAN_GET_STATUS',
  setLanRemoteConfig: 'LAN_SET_CONFIG',
  clearStoredTasks: 'TASKS_CLEAR',
  resetSettings: 'SETTINGS_RESET',
  getAppInfo: 'APP_INFO',
  loadTasks: 'TASKS_GET',
  saveTasks: 'TASKS_SAVE',
  getAppVersion: 'UPDATE_GET_VERSION',
  checkForUpdates: 'UPDATE_CHECK',
  downloadUpdate: 'UPDATE_DOWNLOAD',
  cancelUpdateDownload: 'UPDATE_CANCEL_DOWNLOAD',
  installUpdate: 'UPDATE_INSTALL',
  openPath: 'OPEN_PATH',
  showItemInFolder: 'SHOW_ITEM_IN_FOLDER',
  setDataDir: 'SET_DATA_DIR',
  relaunchApp: 'RELAUNCH_APP',
  windowMinimize: 'WINDOW_MINIMIZE',
  windowMaximizeToggle: 'WINDOW_MAXIMIZE',
  windowClose: 'WINDOW_CLOSE',
  windowIsMaximized: 'WINDOW_IS_MAXIMIZED',
  windowCloseDecision: 'WINDOW_CLOSE_DECISION',
  windowCloseCancel: 'WINDOW_CLOSE_CANCEL',
  onFilesDropped: 'FILES_DROPPED',
  onTaskProgress: 'TASK_PROGRESS',
  onTaskEnd: 'TASK_END',
  onTaskQueued: 'TASK_QUEUED',
  onTaskAdded: 'TASK_ADDED',
  onUpdateStatus: 'UPDATE_STATUS',
  onWindowMaximizedChanged: 'WINDOW_MAXIMIZED_CHANGED',
  onWindowCloseAsk: 'WINDOW_CLOSE_ASK',
  onTrayCommand: 'TRAY_COMMAND'
}

/** 渲染 → 主：须由 main handle 或 ipcMain.on 注册 */
const INVOKE_OR_ON_FROM_RENDERER: Array<keyof typeof IpcChannels> = [
  'SELECT_FILES',
  'SELECT_DIR',
  'SELECT_IMAGE',
  'GET_FFMPEG_STATUS',
  'DETECT_ENCODERS',
  'START_TASK',
  'START_TASKS',
  'CANCEL_TASK',
  'CANCEL_ALL',
  'SET_CONCURRENCY',
  'GET_CONCURRENCY',
  'SETTINGS_GET',
  'SETTINGS_SET',
  'SETTINGS_RESET',
  'FFMPEG_SET_BIN_DIR',
  'IMAGE_STATUS',
  'IMAGE_PROCESS',
  'IMAGE_SET_MAGICK_PATH',
  'IMAGE_GET_INFO',
  'IMAGE_GET_DATA_URL',
  'VIDEO_EXTRACT_FRAME',
  'LAN_GET_STATUS',
  'LAN_SET_CONFIG',
  'TASKS_CLEAR',
  'APP_INFO',
  'TASKS_GET',
  'TASKS_SAVE',
  'UPDATE_GET_VERSION',
  'UPDATE_CHECK',
  'UPDATE_DOWNLOAD',
  'UPDATE_CANCEL_DOWNLOAD',
  'UPDATE_INSTALL',
  'OPEN_PATH',
  'SHOW_ITEM_IN_FOLDER',
  'SET_DATA_DIR',
  'RELAUNCH_APP',
  'WINDOW_MINIMIZE',
  'WINDOW_MAXIMIZE',
  'WINDOW_CLOSE',
  'WINDOW_IS_MAXIMIZED',
  'WINDOW_CLOSE_DECISION',
  'WINDOW_CLOSE_CANCEL',
  'FILES_DROPPED_FROM_PRELOAD'
]

/** 主 → 渲染：preload 订阅；main 侧多为 send，不强制 handle */
const MAIN_TO_RENDERER: Array<keyof typeof IpcChannels> = [
  'TASK_PROGRESS',
  'TASK_END',
  'TASK_QUEUED',
  'TASK_ADDED',
  'UPDATE_STATUS',
  'FILES_DROPPED',
  'WINDOW_MAXIMIZED_CHANGED',
  'WINDOW_CLOSE_ASK',
  'TRAY_COMMAND'
]

function readSrc(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf8')
}

function extractElectronApiKeys(typesSrc: string): string[] {
  const start = typesSrc.indexOf('export interface ElectronAPI {')
  expect(start).toBeGreaterThanOrEqual(0)
  const body = typesSrc.slice(start)
  const end = body.indexOf('\n}')
  expect(end).toBeGreaterThan(0)
  const block = body.slice(0, end)
  const keys: string[] = []
  for (const line of block.split('\n')) {
    const m = line.match(/^\s{2}([a-zA-Z][a-zA-Z0-9]*)\s*[:(]/)
    if (m) keys.push(m[1])
  }
  return keys
}

function channelLiteralRefs(src: string): Set<string> {
  const found = new Set<string>()
  const re = /IpcChannels\.([A-Z0-9_]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) {
    found.add(m[1])
  }
  return found
}

describe('IPC 通道对账', () => {
  it('IpcChannels 键覆盖 API 映射表，且无未知键', () => {
    const channelKeys = new Set(Object.keys(IpcChannels))
    const mapped = Object.values(API_TO_CHANNEL).filter(
      (k): k is keyof typeof IpcChannels => k != null
    )
    for (const k of mapped) {
      expect(channelKeys.has(k), `映射指向不存在的通道: ${k}`).toBe(true)
    }
    const covered = new Set<string>([
      ...mapped,
      'FILES_DROPPED_FROM_PRELOAD' // preload → main，无 ElectronAPI 方法
    ])
    const uncovered = Array.from(channelKeys).filter((k) => !covered.has(k))
    expect(uncovered, `IpcChannels 未映射到 ElectronAPI: ${uncovered.join(', ')}`).toEqual(
      []
    )
  })

  it('ElectronAPI 方法集合与映射表一致', () => {
    const typesSrc = readSrc('shared/types.ts')
    const apiKeys = extractElectronApiKeys(typesSrc)
    const mappedKeys = Object.keys(API_TO_CHANNEL).sort()
    expect([...apiKeys].sort()).toEqual(mappedKeys)
  })

  it('preload 引用 invoke/on 通道；main 注册渲染→主通道', () => {
    const preload = readSrc('electron/preload/index.ts')
    const mainIndex = readSrc('electron/main/index.ts')
    const updater = readSrc('electron/main/updater.ts')
    const mainCombined = `${mainIndex}\n${updater}`

    const preloadRefs = channelLiteralRefs(preload)
    const mainRefs = channelLiteralRefs(mainCombined)

    for (const key of INVOKE_OR_ON_FROM_RENDERER) {
      // FILES_DROPPED_FROM_PRELOAD 为 preload → main 的 send；其余为 invoke
      expect(preloadRefs.has(key), `preload 缺少通道: ${key}`).toBe(true)
      expect(mainRefs.has(key), `main 未注册/引用 ${key}`).toBe(true)
    }

    for (const key of MAIN_TO_RENDERER) {
      expect(preloadRefs.has(key), `preload 未订阅 ${key}`).toBe(true)
    }
  })

  it('映射表中的通道字面量与 IpcChannels 值一致（防漂移）', () => {
    for (const [api, ch] of Object.entries(API_TO_CHANNEL)) {
      if (ch == null) continue
      expect(IpcChannels[ch], api).toBeTruthy()
      expect(typeof IpcChannels[ch]).toBe('string')
    }
  })
})
