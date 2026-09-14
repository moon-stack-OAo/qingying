import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  screen,
  shell,
  Tray
} from 'electron'
import {basename, join} from 'path'
import {existsSync} from 'fs'
import type {
  AppSettings,
  CloseAction,
  CompressTask
} from '../../shared/types'
import { IpcChannels } from '../../shared/types'
import { isAllowedExternalUrl } from '../../shared/urlAllowlist'
import {
  buildOutputPath,
  checkFfmpegAvailable,
  setBinaryOverride
} from './ffmpeg'
import {
  getImageEngineStatus,
  setImageEngine,
  setMagickPath
} from './image'
import {collectMediaFiles} from './mediaScan'
import {getSettings, loadSettings, saveSettings} from './settings'
import {clearStoredTasks, loadTasks, saveTasks} from './taskStore'
import {applyAppIdentity, applyUserDataOverride} from './dataDir'
import {APP_ID, PRODUCT_NAME} from '../../shared/brand'
import {taskQueue} from './taskQueue'
import {initAutoUpdater, registerUpdaterIpc} from './updater'
import {
  stopLanServer,
  syncLanServerFromSettings
} from './lanServer'
import {
  allowDir,
  allowPaths,
  ensureOutputPathAllowed,
  isPathAllowed,
  pathNotAllowedError
} from './pathAllowlist'
import {
  assertMainWindowSender,
  handleFromMainWindow,
  setMainWindowRef
} from './ipcGuard'
import { registerDomainIpc } from './ipc'
import {
  applyLoginItemSettings,
  shouldStartHiddenToTray
} from './loginItem'

// 固定 ASCII 应用名后再读 userData，避免落到中文产品名目录
applyAppIdentity()
applyUserDataOverride()

function isDev(): boolean {
  return !app.isPackaged
}

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
/** 为 true 时允许真正关闭窗口（退出应用） */
let allowQuit = false
/** 关闭询问中，避免重复弹窗 */
let closeAskPending = false
/** 开机自启且选择启动到托盘时，首屏不显示主窗口 */
let startHiddenToTray = false

/** 图标搜索根目录：打包后在 process.resourcesPath/icons，开发态用仓库 resources/build */
function iconSearchRoots(): string[] {
  if (app.isPackaged) {
    return [join(process.resourcesPath, 'icons'), process.resourcesPath]
  }
  return [join(__dirname, '../../resources'), join(__dirname, '../../build')]
}

function resolveIconPath(names: string[]): string | undefined {
  for (const root of iconSearchRoots()) {
    for (const name of names) {
      const p = join(root, name)
      if (existsSync(p)) return p
    }
  }
  return undefined
}

/** 窗口图标；打包后优先 extraResources，其次 exe 内嵌图标 */
function resolveWindowIcon(): string | undefined {
  return (
    resolveIconPath(['icon.ico', 'icon.png', 'icon-256.png', 'icon-128.png']) ||
    (app.isPackaged ? process.execPath : undefined)
  )
}

function showMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

function hideToTray(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  ensureTray()
  mainWindow.hide()
  closeAskPending = false
}

function quitApp(): void {
  allowQuit = true
  closeAskPending = false
  taskQueue.cancelAll(true)
  stopLanServer()
  if (tray) {
    tray.destroy()
    tray = null
  }
  app.quit()
}

function normalizeTrayImage(img: Electron.NativeImage): Electron.NativeImage {
  if (img.isEmpty()) return img
  // Windows 托盘约 16–32px；过大时缩到 32，高 DPI 更清晰
  const { width } = img.getSize()
  if (width > 32) {
    return img.resize({ width: 32, height: 32, quality: 'best' })
  }
  return img
}

/** 托盘优先小尺寸 PNG；打包后读 extraResources，再回退 exe 图标 */
function resolveTrayIconSync(): Electron.NativeImage {
  const names = ['icon-32.png', 'icon-24.png', 'icon-16.png', 'icon.ico', 'icon.png']
  for (const root of iconSearchRoots()) {
    for (const name of names) {
      const p = join(root, name)
      if (!existsSync(p)) continue
      try {
        const img = normalizeTrayImage(nativeImage.createFromPath(p))
        if (!img.isEmpty()) return img
      } catch {
        // 忽略无法解析的路径
      }
    }
  }
  if (app.isPackaged) {
    try {
      const fromExe = normalizeTrayImage(nativeImage.createFromPath(process.execPath))
      if (!fromExe.isEmpty()) return fromExe
    } catch {
      // ignore
    }
  }
  return nativeImage.createEmpty()
}

async function resolveTrayIcon(): Promise<Electron.NativeImage> {
  const sync = resolveTrayIconSync()
  if (!sync.isEmpty()) return sync
  // 打包后最后手段：系统读取 exe 文件图标
  if (app.isPackaged) {
    try {
      const fromSystem = await app.getFileIcon(process.execPath, { size: 'small' })
      return normalizeTrayImage(fromSystem)
    } catch {
      // ignore
    }
  }
  return nativeImage.createEmpty()
}

function sendTrayCommand(cmd: 'check-update' | 'open-settings'): void {
  showMainWindow()
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IpcChannels.TRAY_COMMAND, cmd)
  }
}

function buildTrayMenu(): Menu {
  return Menu.buildFromTemplate([
    {
      label: '打开主窗口',
      click: () => showMainWindow()
    },
    {
      label: '检查更新',
      click: () => sendTrayCommand('check-update')
    },
    {
      label: '打开设置',
      click: () => sendTrayCommand('open-settings')
    },
    { type: 'separator' },
    {
      label: '退出应用',
      click: () => quitApp()
    }
  ])
}

function ensureTray(): void {
  if (tray) return
  // 先用同步路径创建，避免 hide 时无托盘；图标异步再校正
  const placeholder = resolveTrayIconSync()
  tray = new Tray(placeholder.isEmpty() ? nativeImage.createEmpty() : placeholder)
  tray.setToolTip(`${PRODUCT_NAME} v${app.getVersion()}`)
  tray.setContextMenu(buildTrayMenu())
  // Windows：左键打开主窗口，右键系统菜单
  tray.on('click', () => showMainWindow())
  tray.on('double-click', () => showMainWindow())

  if (placeholder.isEmpty()) {
    void resolveTrayIcon().then((image) => {
      if (!tray || image.isEmpty()) return
      tray.setImage(image)
    })
  }
}

function handleCloseRequest(): void {
  if (allowQuit) return
  const action: CloseAction = getSettings().closeAction || 'ask'
  if (action === 'quit') {
    quitApp()
    return
  }
  if (action === 'tray') {
    hideToTray()
    return
  }
  // ask
  if (closeAskPending) return
  closeAskPending = true
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (!mainWindow.isVisible()) showMainWindow()
    mainWindow.webContents.send(IpcChannels.WINDOW_CLOSE_ASK)
  } else {
    closeAskPending = false
    quitApp()
  }
}

/** 设计默认尺寸；不超过当前显示器工作区，避免 macOS 最大化/缩放被 min 尺寸卡住 */
function resolveWindowBounds(): {
  width: number
  height: number
  minWidth: number
  minHeight: number
} {
  const { width: aw, height: ah } = screen.getPrimaryDisplay().workAreaSize
  // 略留边，避免贴满工作区时系统缩放异常
  const maxW = Math.max(800, aw)
  const maxH = Math.max(600, ah)
  const designW = 1360
  const designH = 900
  const width = Math.min(designW, maxW)
  const height = Math.min(designH, maxH)
  // 最小尺寸不超过工作区，否则 maximize 在小屏 Mac 上会失败或裁切
  const minWidth = Math.min(1100, width, maxW)
  const minHeight = Math.min(720, height, maxH)
  return { width, height, minWidth, minHeight }
}

function createWindow(): void {
  const icon = resolveWindowIcon()
  const bounds = resolveWindowBounds()
  const isMac = process.platform === 'darwin'
  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    minWidth: bounds.minWidth,
    minHeight: bounds.minHeight,
    // macOS 上 resizable:false 会导致绿键最大化/缩放异常；允许缩放但受 min 约束
    resizable: true,
    maximizable: true,
    fullscreenable: true,
    show: false,
    title: PRODUCT_NAME,
    frame: false,
    // macOS：hidden 标题栏配合自定义 TitleBar，避免系统栏与最大化区域冲突
    ...(isMac ? { titleBarStyle: 'hidden' as const } : {}),
    autoHideMenuBar: true,
    backgroundColor: '#0f1115',
    ...(icon ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // Electron 20+ 默认即为 sandbox；preload 仅用 contextBridge/ipcRenderer/webUtils，可安全开启
      sandbox: true
    }
  })
  setMainWindowRef(mainWindow)

  // 隐藏 macOS 原生红绿灯，统一用自定义按钮（frame:false + titleBarStyle 时仍可能露出）
  if (isMac) {
    try {
      mainWindow.setWindowButtonVisibility(false)
    } catch {
      // ignore
    }
  }

  taskQueue.setWindow(mainWindow)

  const sendMaximized = (): void => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      // 全屏也视为「最大化」态，便于标题栏还原图标
      const maximized =
        mainWindow.isMaximized() || mainWindow.isFullScreen()
      mainWindow.webContents.send(IpcChannels.WINDOW_MAXIMIZED_CHANGED, maximized)
    }
  }
  mainWindow.on('maximize', sendMaximized)
  mainWindow.on('unmaximize', sendMaximized)
  mainWindow.on('enter-full-screen', sendMaximized)
  mainWindow.on('leave-full-screen', sendMaximized)
  mainWindow.on('resize', sendMaximized)

  mainWindow.on('close', (e) => {
    if (allowQuit) return
    e.preventDefault()
    handleCloseRequest()
  })

  mainWindow.on('ready-to-show', () => {
    if (startHiddenToTray) {
      hideToTray()
    } else {
      mainWindow?.show()
    }
    sendMaximized()
    if (mainWindow) {
      initAutoUpdater(mainWindow)
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (isAllowedExternalUrl(details.url)) {
      void shell.openExternal(details.url)
    }
    return { action: 'deny' }
  })

  // 禁止把拖入的文件当成页面导航打开
  mainWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault()
  })
  mainWindow.webContents.on('will-redirect', (event) => {
    event.preventDefault()
  })

  // 开发态自动打开调试工具，便于查看 preload 拖拽日志
  if (isDev()) {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }

  // electron-vite 开发态注入 ELECTRON_RENDERER_URL
  if (isDev() && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

/** 解析任务输入路径列表 */
function resolveTaskInputPaths(task: CompressTask): string[] {
  const multi = (task.inputPaths || [])
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean)
  if (multi.length > 0) return multi
  const single =
    typeof task.inputPath === 'string' ? task.inputPath.trim() : ''
  return single ? [single] : []
}

/** 收集任务相关附加资源路径（水印 / 混剪素材） */
function collectTaskAssetPaths(task: CompressTask): string[] {
  const out: string[] = []
  const wm = task.options?.watermark?.imagePath
  if (typeof wm === 'string' && wm.trim()) out.push(wm.trim())
  const compose = task.options?.compose
  if (compose) {
    for (const p of [
      compose.intro?.imagePath,
      compose.outro?.imagePath,
      compose.overlay?.imagePath
    ]) {
      if (typeof p === 'string' && p.trim()) out.push(p.trim())
    }
  }
  return out
}

/**
 * 启动时播种允许根：仅 userData 相关目录 + 已校验的 settings.outputDir。
 * 禁止从持久化任务回灌路径（否则 TASKS_SAVE 可注入任意路径扩大白名单）。
 */
function seedPathAllowlist(settings: AppSettings): void {
  try {
    const userData = app.getPath('userData')
    allowDir(userData)
    allowDir(join(userData, 'lan-uploads'))
    allowDir(join(userData, 'lan-outputs'))
    allowDir(join(userData, 'image-test'))
  } catch (err) {
    console.warn('[main] seed userData allowlist failed:', err)
  }

  // settings.outputDir 仅能经 SETTINGS_SET 校验后写入，故启动时可信
  if (typeof settings.outputDir === 'string' && settings.outputDir.trim()) {
    allowDir(settings.outputDir.trim())
  }
}

/**
 * 校验启动任务：路径存在、输出目录、引擎依赖、路径允许列表
 * skipEngineCheck：批量入口已统一检查引擎时使用
 */
function validateStartTask(
  task: CompressTask | null | undefined,
  opts?: { skipEngineCheck?: boolean }
): { ok: true; paths: string[] } | { ok: false; error: string } {
  if (!task) {
    return { ok: false, error: '任务无效' }
  }

  const paths = resolveTaskInputPaths(task)
  if (paths.length === 0) {
    return { ok: false, error: '输入文件无效' }
  }
  // 不在此处 existsSync：局域网/UNC 路径同步探测可能卡死整个 IPC，
  // 存在性改到队列 runItem 内异步检查（带超时）。
  for (const p of paths) {
    if (!isPathAllowed(p)) {
      return { ok: false, error: pathNotAllowedError(`输入文件 ${basename(p)}`) }
    }
  }

  for (const p of collectTaskAssetPaths(task)) {
    if (!isPathAllowed(p)) {
      return { ok: false, error: pathNotAllowedError(`素材 ${basename(p)}`) }
    }
  }

  const dirMode = task.options?.outputDirMode || 'fixed'
  if (dirMode !== 'sidecar' && !task.options?.outputDir) {
    return { ok: false, error: '请先选择输出目录' }
  }

  // 校验将要写入的输出路径：已 allowDir 的 outputDir 直接 OK；
  // sidecar 等同父旁路则显式登记精确 planned（不放开整目录）
  const primary = paths[0]
  try {
    const planned = buildOutputPath(primary, task.options)
    if (!ensureOutputPathAllowed(planned, paths)) {
      return { ok: false, error: pathNotAllowedError('输出路径') }
    }
  } catch {
    return { ok: false, error: pathNotAllowedError('输出路径') }
  }

  const mode = task.options?.mode
  const isImage =
    mode === 'image' || mode === 'image-crop' || mode === 'image-stitch'

  if (mode === 'image-stitch' && paths.length < 2) {
    return { ok: false, error: '图片拼接至少需要 2 张图片' }
  }
  if (mode === 'images-to-gif' && paths.length < 2) {
    return { ok: false, error: '多图转动图至少需要 2 张图片' }
  }
  if (mode === 'video-concat' && paths.length < 2) {
    return { ok: false, error: '视频拼接至少需要 2 个输入文件' }
  }

  if (!opts?.skipEngineCheck) {
    if (isImage) {
      const img = getImageEngineStatus()
      if (!img.sharpReady && !img.magickReady) {
        return {
          ok: false,
          error: img.error || '图片引擎不可用（Sharp / ImageMagick）'
        }
      }
      if (mode === 'image-stitch' && !img.sharpReady) {
        return { ok: false, error: '拼接请使用 Sharp 引擎（当前 Sharp 不可用）' }
      }
    } else {
      const status = checkFfmpegAvailable()
      if (!status.ready) {
        return { ok: false, error: status.error || 'ffmpeg 未就绪' }
      }
    }
  }

  return { ok: true, paths }
}

function registerIpc(): void {
  registerDomainIpc()

  // 清空已持久化任务
  handleFromMainWindow(IpcChannels.TASKS_CLEAR, async () => {
    return clearStoredTasks()
  })

  // 任务列表持久化：读（不扩展 allowlist，避免经 TASKS_SAVE 回灌任意路径）
  handleFromMainWindow(IpcChannels.TASKS_GET, async () => {
    try {
      const settings = getSettings()
      if (settings.persistTasks === false) {
        return []
      }
      return loadTasks()
    } catch (err) {
      console.warn('[main] TASKS_GET failed:', err)
      return []
    }
  })

  // 任务列表持久化：写（不由此扩展 allowlist，避免渲染进程注入任意路径）
  handleFromMainWindow(IpcChannels.TASKS_SAVE, async (_e, tasks: CompressTask[]) => {
    try {
      const settings = getSettings()
      if (settings.persistTasks === false) {
        return { ok: true }
      }
      return saveTasks(Array.isArray(tasks) ? tasks : [])
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { ok: false, error: msg }
    }
  })

  handleFromMainWindow(IpcChannels.START_TASK, async (_e, task: CompressTask) => {
    try {
      const validated = validateStartTask(task)
      if (!validated.ok) {
        return { ok: false, error: validated.error }
      }

      // 补齐默认 encoder；输出路径由队列按 options 重建
      const options = {
        ...task.options,
        encoder: task.options.encoder || ('auto' as const)
      }

      taskQueue.enqueue({
        ...task,
        inputPath: validated.paths[0],
        inputPaths:
          validated.paths.length > 1 ? validated.paths : task.inputPaths,
        options,
        outputPath: '',
        status: 'queued',
        progress: 0
      })
      return { ok: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { ok: false, error: msg }
    }
  })

  handleFromMainWindow(IpcChannels.START_TASKS, async (_e, tasks: CompressTask[]) => {
    try {
      if (!Array.isArray(tasks) || tasks.length === 0) {
        return { ok: false, error: '没有可执行的任务' }
      }

      // 按模式检查依赖（图片不强制 ffmpeg）
      let needFfmpeg = false
      let needImage = false
      for (const t of tasks) {
        const mode = t?.options?.mode
        if (
          mode === 'image' ||
          mode === 'image-crop' ||
          mode === 'image-stitch'
        ) {
          needImage = true
        } else {
          needFfmpeg = true
        }
      }
      if (needFfmpeg) {
        const status = checkFfmpegAvailable()
        if (!status.ready) {
          return { ok: false, error: status.error || 'ffmpeg 未就绪' }
        }
      }
      if (needImage) {
        const img = getImageEngineStatus()
        if (!img.sharpReady && !img.magickReady) {
          return {
            ok: false,
            error: img.error || '图片引擎不可用（Sharp / ImageMagick）'
          }
        }
      }

      const prepared: CompressTask[] = []
      for (const task of tasks) {
        const validated = validateStartTask(task, {
          skipEngineCheck: true
        })
        if (!validated.ok) {
          // 批量时跳过无效项；若全部无效则后面报错
          continue
        }
        const options = {
          ...task.options,
          encoder: task.options.encoder || ('auto' as const)
        }
        prepared.push({
          ...task,
          inputPath: validated.paths[0],
          inputPaths:
            validated.paths.length > 1 ? validated.paths : task.inputPaths,
          options,
          // 清空旧路径，由队列按最新 options 重建
          outputPath: '',
          status: 'queued',
          progress: 0
        })
      }

      if (!prepared.length) {
        return { ok: false, error: '没有有效的输入文件' }
      }

      taskQueue.enqueueMany(prepared)
      return { ok: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { ok: false, error: msg }
    }
  })

  handleFromMainWindow(IpcChannels.CANCEL_TASK, async (_e, taskId: string) => {
    taskQueue.cancel(taskId)
    return { ok: true }
  })

  handleFromMainWindow(IpcChannels.CANCEL_ALL, async () => {
    taskQueue.cancelAll()
    return { ok: true }
  })

  handleFromMainWindow(IpcChannels.WINDOW_MINIMIZE, async () => {
    mainWindow?.minimize()
  })

  handleFromMainWindow(IpcChannels.WINDOW_MAXIMIZE, async () => {
    if (!mainWindow) return false
    // macOS 绿键可能进全屏；标题栏按钮统一：最大化 ↔ 还原
    if (mainWindow.isFullScreen()) {
      mainWindow.setFullScreen(false)
      return false
    }
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
      return false
    }
    mainWindow.maximize()
    return true
  })

  handleFromMainWindow(IpcChannels.WINDOW_CLOSE, async () => {
    handleCloseRequest()
  })

  handleFromMainWindow(IpcChannels.WINDOW_IS_MAXIMIZED, async () => {
    if (!mainWindow) return false
    return mainWindow.isMaximized() || mainWindow.isFullScreen()
  })

  handleFromMainWindow(
    IpcChannels.WINDOW_CLOSE_DECISION,
    async (_e, action: 'tray' | 'quit', remember: boolean) => {
      const next: CloseAction = action === 'tray' ? 'tray' : 'quit'
      if (remember) {
        saveSettings({ closeAction: next })
      }
      if (next === 'tray') {
        hideToTray()
      } else {
        quitApp()
      }
    }
  )

  handleFromMainWindow(IpcChannels.WINDOW_CLOSE_CANCEL, async () => {
    closeAskPending = false
  })

  // preload 拖拽解析结果 → 展开目录后转发到渲染进程
  ipcMain.on(
    IpcChannels.FILES_DROPPED_FROM_PRELOAD,
    (event, files: Array<{ path: string; name: string }>) => {
      assertMainWindowSender(event)
      const list = Array.isArray(files) ? files : []
      if (isDev()) {
        console.log('[main] FILES_DROPPED_FROM_PRELOAD count=', list.length, list)
      } else {
        console.log(
          '[main] FILES_DROPPED_FROM_PRELOAD count=',
          list.length,
          list.map((f) => (f && f.name) || basename(typeof f?.path === 'string' ? f.path : ''))
        )
      }
      const paths = list
        .filter((f) => f && typeof f.path === 'string' && f.path.length > 0)
        .map((f) => f.path)
      // 拖入的根路径先登记（含目录），展开后的媒体再逐一登记
      allowPaths(paths)
      // 递归展开目录中的视频+图片（深度 8，最多 500），由前端按 mode 过滤
      const filtered = collectMediaFiles(paths, 500)
      allowPaths(filtered.map((f) => f.path))
      if (isDev()) {
        console.log('[main] forward FILES_DROPPED filtered=', filtered.length, filtered)
      } else {
        console.log(
          '[main] forward FILES_DROPPED filtered=',
          filtered.length,
          filtered.map((f) => f.name || basename(f.path))
        )
      }
      event.sender.send(IpcChannels.FILES_DROPPED, filtered)
    }
  )
}

app.whenReady().then(() => {
  app.setAppUserModelId(APP_ID)
  const settings = loadSettings()
  startHiddenToTray =
    Boolean(settings.openAtLogin) &&
    Boolean(settings.startMinimizedToTray) &&
    shouldStartHiddenToTray()
  // 启动即应用用户自定义 ffmpeg bin 目录（无效时回退自动探测）
  setBinaryOverride(settings.ffmpegBinDir)
  setMagickPath(settings.imagemagickPath || '')
  setImageEngine(settings.imageEngine || 'sharp')
  taskQueue.setConcurrency(settings.concurrency)
  applyLoginItemSettings(settings)
  seedPathAllowlist(settings)
  registerIpc()
  registerUpdaterIpc()
  createWindow()
  // 启动后托盘常驻，不依赖「最小化到托盘」才创建
  ensureTray()
  // 若上次开启了局域网远程，启动时恢复 HTTP 服务
  void syncLanServerFromSettings().catch((err) => {
    console.warn('[main] syncLanServerFromSettings failed:', err)
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    } else {
      showMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  // 托盘常驻时窗口可能被 hide 而非销毁；仅在真正退出时清理
  if (allowQuit && process.platform !== 'darwin') {
    taskQueue.cancelAll(true)
    app.quit()
  }
})

app.on('before-quit', () => {
  allowQuit = true
  closeAskPending = false
  stopLanServer()
})
