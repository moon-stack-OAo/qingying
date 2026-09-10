<script lang="ts" setup>
import {computed, onMounted, onUnmounted, ref, watch} from 'vue'
import {ElMessage, ElMessageBox} from 'element-plus'
import type {
  AppInfo,
  CompressOptions,
  CompressTask,
  ImageEngineStatus,
  LanStatus,
  MediaComposeOptions,
  MosaicRegion,
  TaskMode,
  WatermarkPosition
} from '@shared/types'
import {IMAGE_EXTENSIONS, TASK_MODE_OPTIONS} from '@shared/types'
import TitleBar from './components/TitleBar.vue'
import ModeSidebar from './components/ModeSidebar.vue'
import CompressOptionsPanel from './components/CompressOptionsPanel.vue'
import VideoMosaicDialog from './components/VideoMosaicDialog.vue'
import StitchOrderDialog, {type StitchOrderConfirmPayload} from './components/StitchOrderDialog.vue'
import DropZone from './components/DropZone.vue'
import CloseConfirmDialog from './components/CloseConfirmDialog.vue'
import SettingsDrawer from './components/SettingsDrawer.vue'
import ShortcutHelpDialog from './components/ShortcutHelpDialog.vue'
import MosaicWorkbench from './components/MosaicWorkbench.vue'
import SizeSummaryBar from './components/SizeSummaryBar.vue'
import TaskTable from './components/TaskTable.vue'
import UpdateDialog from './components/UpdateDialog.vue'
import {useDragDrop} from './composables/useDragDrop'
import {useFfmpegStatus} from './composables/useFfmpegStatus'
import {subscribeHotkeys} from './composables/useHotkeys'
import {useSettings} from './composables/useSettings'
import {useTasks} from './composables/useTasks'
import {useTheme} from './composables/useTheme'
import {useUpdater} from './composables/useUpdater'

const {ffmpegStatus, encoderInfo, loadStatus} = useFfmpegStatus()

// 任务依赖 settings，先占位；sync 在 settings 回调里绑定
let syncPendingOptionsRef: (() => void) | undefined

const settings = useSettings({
  onOptionsChange: () => syncPendingOptionsRef?.()
})

const {
  outputDir,
  presetId,
  encoder,
  concurrency,
  nameTemplate,
  nameTemplateCustom,
  outputDirMode,
  targetSizeMb,
  twoPass,
  taskMode,
  audioFormat,
  audioBitrate,
  notifyOnComplete,
  theme,
  closeAction,
  openAtLogin,
  startMinimizedToTray,
  trimStart,
  trimEnd,
  rotate90,
  muteAudio,
  compatProfile,
  videoAudioBitrate,
  fps,
  encodePreset,
  watermarkMode,
  watermarkImagePath,
  watermarkText,
  watermarkPosition,
  watermarkOpacity,
  watermarkScalePercent,
  watermarkFontSize,
  watermarkMargin,
  custom,
  scaleMode,
  outWidth,
  outHeight,
  aspectRatio,
  scalePad,
  currentPreset,
  isCustom,
  isWebm,
  isAudioMode,
  isImageMode,
  isVideoConcatMode,
  isMediaComposeMode,
  isVideoMosaicMode,
  isVideoCompressMode,
  imageFormat,
  imageQuality,
  imageMaxEdge,
  imageStrip,
  imageLayout,
  imageGridCols,
  imageGap,
  imageBackground,
  cropX,
  cropY,
  cropW,
  cropH,
  concatPreferCopy,
  mosaicFrameByFrame,
  composeIntroPath,
  composeIntroDuration,
  composeOutroPath,
  composeOutroDuration,
  composeOverlayPath,
  composeOverlayPosition,
  composeOverlayOpacity,
  composeOverlayScalePercent,
  composeOverlayMargin,
  composeOverlayStartSec,
  composeOverlayEndSec,
  composeFitIntroOutro,
  buildOptions,
  loadSettings,
  onPresetChange,
  onEncoderChange,
  onConcurrencyChange,
  onNameTemplateChange,
  onCustomNameTemplateInput,
  onOutputDirModeChange,
  onTargetSizeMbChange,
  onTwoPassChange,
  onThemeChange,
  onTaskModeChange,
  onImageFormatChange,
  onImageQualityChange,
  onImageMaxEdgeChange,
  onImageStripChange,
  onImageLayoutChange,
  onImageGridColsChange,
  onImageGapChange,
  onImageBackgroundChange,
  onCropXChange,
  onCropYChange,
  onCropWChange,
  onCropHChange,
  onConcatPreferCopyChange,
  onMosaicFrameByFrameChange,
  onComposeIntroPathChange,
  onComposeIntroDurationChange,
  onComposeOutroPathChange,
  onComposeOutroDurationChange,
  onComposeOverlayPathChange,
  onComposeOverlayPositionChange,
  onComposeOverlayOpacityChange,
  onComposeOverlayScalePercentChange,
  onComposeOverlayMarginChange,
  onComposeOverlayStartSecChange,
  onComposeOverlayEndSecChange,
  onComposeFitIntroOutroChange,
  onSelectComposeIntroImage,
  onSelectComposeOutroImage,
  onSelectComposeOverlayImage,
  onAudioFormatChange,
  onAudioBitrateChange,
  onNotifyOnCompleteChange,
  onPersistTasksChange,
  onCloseActionChange,
  onOpenAtLoginChange,
  onStartMinimizedToTrayChange,
  onTrimStartChange,
  onTrimEndChange,
  onRotate90Change,
  onMuteAudioChange,
  onCompatProfileChange,
  onVideoAudioBitrateChange,
  onFpsChange,
  onEncodePresetChange,
  onWatermarkModeChange,
  onWatermarkImagePathChange,
  onWatermarkTextChange,
  onWatermarkPositionChange,
  onWatermarkOpacityChange,
  onWatermarkScalePercentChange,
  onWatermarkFontSizeChange,
  onWatermarkMarginChange,
  onScaleModeChange,
  onOutWidthChange,
  onOutHeightChange,
  onAspectRatioChange,
  onScalePadChange,
  onSelectWatermarkImage,
  onSelectOutput,
  startWatchers,
  stopWatchers,
  persistTasks,
  ffmpegBinDir,
  imageEngine,
  imagemagickPath,
  applyLoadedSettings,
  onSetFfmpegBinDir,
  onImageEngineChange,
  onSetMagickPath
} = settings

const {
  tasks,
  selectedTaskId,
  selectedTask,
  selectTask,
  lastDropOkAt,
  hasPending,
  pendingCount,
  hasActive,
  sizeSummary,
  addFiles,
  onSelectFiles,
  appendStitchInputs,
  applyStitchOrder,
  startOne,
  startAll,
  cancelOne,
  cancelAll,
  clearFinished,
  clearAll,
  removeOne,
  openOutput,
  showInFolder,
  applyOptionsToPending,
  updateTask,
  syncPendingOptions,
  getMismatchedPendingCount,
  removeMismatchedPending,
  loadTasks,
  subscribe: subscribeTasks
} = useTasks({
  buildOptions,
  outputDir,
  ffmpegStatus,
  concurrency,
  persistTasks,
  taskMode
})

syncPendingOptionsRef = () => syncPendingOptions()

/** 加载任务 options 到面板时抑制写回，避免 watch 循环 */
let suppressCropComposeWriteback = false

function loadCropComposeFromTask(opts?: CompressOptions | null): void {
  suppressCropComposeWriteback = true
  try {
    const crop = opts?.crop || opts?.image?.crop
    if (crop && crop.w > 0 && crop.h > 0) {
      cropX.value = crop.x ?? 0
      cropY.value = crop.y ?? 0
      cropW.value = crop.w
      cropH.value = crop.h
    } else {
      cropX.value = 0
      cropY.value = 0
      cropW.value = 0
      cropH.value = 0
    }

    const c = opts?.compose
    composeIntroPath.value = c?.intro?.imagePath || ''
    composeIntroDuration.value =
      typeof c?.intro?.durationSec === 'number' && c.intro.durationSec > 0
        ? c.intro.durationSec
        : 3
    composeOutroPath.value = c?.outro?.imagePath || ''
    composeOutroDuration.value =
      typeof c?.outro?.durationSec === 'number' && c.outro.durationSec > 0
        ? c.outro.durationSec
        : 3
    composeOverlayPath.value = c?.overlay?.imagePath || ''
    composeOverlayPosition.value =
      (c?.overlay?.position as WatermarkPosition) || 'br'
    composeOverlayOpacity.value =
      typeof c?.overlay?.opacity === 'number' && Number.isFinite(c.overlay.opacity)
        ? c.overlay.opacity
        : 0.8
    composeOverlayScalePercent.value =
      typeof c?.overlay?.scalePercent === 'number' &&
      Number.isFinite(c.overlay.scalePercent)
        ? c.overlay.scalePercent
        : 15
    composeOverlayMargin.value =
      typeof c?.overlay?.marginX === 'number' && Number.isFinite(c.overlay.marginX)
        ? c.overlay.marginX
        : 16
    composeOverlayStartSec.value =
      typeof c?.overlay?.startSec === 'number' && c.overlay.startSec > 0
        ? c.overlay.startSec
        : 0
    composeOverlayEndSec.value =
      typeof c?.overlay?.endSec === 'number' && c.overlay.endSec > 0
        ? c.overlay.endSec
        : 0
    composeFitIntroOutro.value = c?.fitIntroOutro !== false
  } finally {
    // nextTick 更稳，但同步标志在同一 tick 内写回由 suppress 挡住即可
    suppressCropComposeWriteback = false
  }
}

function buildCropComposePatch(): {
  crop?: CompressOptions['crop']
  compose?: MediaComposeOptions
  imageCrop?: CompressOptions['crop']
} {
  const draft = buildOptions()
  return {
    crop: draft.crop,
    compose: draft.compose,
    imageCrop: draft.image?.crop || draft.crop
  }
}

/** 将当前面板 crop/compose 写回选中的 pending/failed 任务 */
function writeCropComposeToSelectedTask(): void {
  if (suppressCropComposeWriteback) return
  const t = selectedTask.value
  if (!t || (t.status !== 'pending' && t.status !== 'failed')) return

  const patch = buildCropComposePatch()
  const prev = t.options || ({} as CompressOptions)
  const next: CompressOptions = { ...prev }

  if (patch.crop) {
    next.crop = patch.crop
  } else {
    delete next.crop
  }

  if (patch.compose && Object.keys(patch.compose).length > 0) {
    next.compose = patch.compose
  } else {
    delete next.compose
  }

  if (prev.image || patch.imageCrop) {
    const img = { ...(prev.image || {}) }
    if (patch.imageCrop) {
      img.crop = patch.imageCrop
    } else {
      delete img.crop
    }
    next.image = img
  }

  updateTask(t.id, { options: next, outputPath: '' })
}

watch(selectedTask, (t) => {
  if (!t || (t.status !== 'pending' && t.status !== 'failed')) return
  loadCropComposeFromTask(t.options)
})

/** 是否显示「裁切/混剪将应用于全部待处理」危险提示 */
const showCropComposeGlobalWarning = computed(() => {
  if (pendingCount.value <= 1) return false
  // 选中可编辑任务时为任务级编辑，不提示
  const t = selectedTask.value
  if (t && (t.status === 'pending' || t.status === 'failed')) return false

  const cropActive = cropW.value > 0 && cropH.value > 0
  const composeActive =
    !!composeIntroPath.value.trim() ||
    !!composeOutroPath.value.trim() ||
    !!composeOverlayPath.value.trim()
  return cropActive || composeActive
})

const cropComposeWarningText = computed(
  () => `当前裁切/混剪参数将应用于全部 ${pendingCount.value} 个待处理任务`
)

/** 打码规则仅属于 video-mosaic 模式下的当前任务，不参与全局选项同步。 */
const mosaicDialogOpen = ref(false)

/** 视频/图片拼接顺序弹窗 */
const stitchOrderOpen = ref(false)
const stitchOrderTaskId = ref<string | null>(null)
const stitchOrderTask = computed(() => {
  const id = stitchOrderTaskId.value
  if (!id) return null
  return tasks.value.find((t) => t.id === id) || null
})
const stitchOrderMode = computed<'image-stitch' | 'video-concat'>(() => {
  const m = stitchOrderTask.value?.options?.mode
  return m === 'image-stitch' ? 'image-stitch' : 'video-concat'
})
const stitchOrderPaths = computed(() => {
  const t = stitchOrderTask.value
  if (!t) return [] as string[]
  const multi = (t.inputPaths || [])
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean)
  if (multi.length > 0) return multi
  const single = typeof t.inputPath === 'string' ? t.inputPath.trim() : ''
  return single ? [single] : []
})
const stitchOrderEditable = computed(() => {
  const t = stitchOrderTask.value
  return !!(
    t &&
    (t.options?.mode === 'image-stitch' || t.options?.mode === 'video-concat') &&
    (t.status === 'pending' || t.status === 'failed')
  )
})

function openStitchOrder(task: CompressTask): void {
  stitchOrderTaskId.value = task.id
  stitchOrderOpen.value = true
}

function onStitchOrderConfirm(payload: StitchOrderConfirmPayload): void {
  const id = stitchOrderTaskId.value
  if (!id) return
  applyStitchOrder(id, payload)
}

async function onStitchOrderAppend(): Promise<void> {
  const id = stitchOrderTaskId.value
  if (!id) return
  await appendStitchInputs(id)
}

/** 打码单页：当前唯一任务（无列表时仍复用 useTasks 选中项） */
const mosaicTask = computed(() => {
  if (!isVideoMosaicMode.value) return null
  return selectedTask.value || tasks.value[0] || null
})

const mosaicEditable = computed(() => {
  if (taskMode.value !== 'video-mosaic') return false
  const task = mosaicTask.value
  // 运行中 / 排队中不可改区域；其余状态均可编辑
  return !!(
    task &&
    task.inputPath &&
    task.status !== 'running' &&
    task.status !== 'queued'
  )
})
const mosaicVideoPath = computed(() =>
  mosaicEditable.value ? mosaicTask.value?.inputPath || '' : ''
)
const mosaicRegions = computed<MosaicRegion[]>(() =>
  mosaicTask.value?.options?.mosaics || []
)
const mosaicRegionCount = computed(() => mosaicRegions.value.length)

function openMosaicEditor(): void {
  if (taskMode.value !== 'video-mosaic') {
    ElMessage.warning('请先切换到「视频打码」模式')
    return
  }
  if (!mosaicEditable.value) {
    ElMessage.warning(
      mosaicTask.value
        ? '处理进行中，请先取消后再编辑区域'
        : '请先添加视频'
    )
    return
  }
  mosaicDialogOpen.value = true
}

function onMosaicConfirm(regions: MosaicRegion[]): void {
  const task = mosaicTask.value
  if (!task || !mosaicEditable.value) return
  // 已完成任务改区域后回到待处理，便于重新导出
  if (task.status === 'completed') {
    updateTask(task.id, {
      options: { ...task.options, mosaics: regions },
      outputPath: '',
      status: 'pending',
      progress: 0,
      error: undefined,
      outputSize: undefined
    })
    return
  }
  updateTask(task.id, {
    options: { ...task.options, mosaics: regions },
    outputPath: ''
  })
}

/** 清除 / 换视频：运行中先取消再移除；顺带清掉残留任务 */
function onMosaicClear(): void {
  const ids = tasks.value.map((t) => t.id)
  for (const id of ids) {
    removeOne(id)
  }
}

/** 可视化裁切预览：优先选中任务，否则第一个 pending/failed */
const cropPreviewPath = computed(() => {
  const mode = taskMode.value
  if (mode !== 'image-crop' && mode !== 'compress') return ''
  const preferImage = mode === 'image-crop'
  const imageExts = new Set(
    (IMAGE_EXTENSIONS as string[]).map((e) => e.toLowerCase())
  )

  const tryPath = (p: string): string => {
    const path = (p || '').trim()
    if (!path) return ''
    const ext = path.includes('.')
      ? path.slice(path.lastIndexOf('.')).toLowerCase()
      : ''
    if (preferImage) {
      return imageExts.has(ext) ? path : ''
    }
    return path
  }

  const sel = selectedTask.value
  if (sel) {
    const fromSel = tryPath(sel.inputPath || '')
    if (fromSel) return fromSel
  }

  const candidates = tasks.value.filter(
    (t) => t.status === 'pending' || t.status === 'failed'
  )
  for (const t of candidates) {
    const p = tryPath(t.inputPath || '')
    if (p) return p
  }
  // image-crop 时若无 pending 图，再扫全部任务
  if (preferImage) {
    for (const t of tasks.value) {
      const p = tryPath(t.inputPath || '')
      if (p) return p
    }
  }
  return candidates[0]?.inputPath?.trim() || ''
})

function afterCropComposeEdit(): void {
  writeCropComposeToSelectedTask()
}

function onCropXChangeUi(v: number): void {
  onCropXChange(v)
  afterCropComposeEdit()
}
function onCropYChangeUi(v: number): void {
  onCropYChange(v)
  afterCropComposeEdit()
}
function onCropWChangeUi(v: number): void {
  onCropWChange(v)
  afterCropComposeEdit()
}
function onCropHChangeUi(v: number): void {
  onCropHChange(v)
  afterCropComposeEdit()
}
function onComposeIntroPathChangeUi(v: string): void {
  onComposeIntroPathChange(v)
  afterCropComposeEdit()
}
function onComposeIntroDurationChangeUi(v: number): void {
  onComposeIntroDurationChange(v)
  afterCropComposeEdit()
}
function onComposeOutroPathChangeUi(v: string): void {
  onComposeOutroPathChange(v)
  afterCropComposeEdit()
}
function onComposeOutroDurationChangeUi(v: number): void {
  onComposeOutroDurationChange(v)
  afterCropComposeEdit()
}
function onComposeOverlayPathChangeUi(v: string): void {
  onComposeOverlayPathChange(v)
  afterCropComposeEdit()
}
function onComposeOverlayPositionChangeUi(v: WatermarkPosition): void {
  onComposeOverlayPositionChange(v)
  afterCropComposeEdit()
}
function onComposeOverlayOpacityChangeUi(v: number): void {
  onComposeOverlayOpacityChange(v)
  afterCropComposeEdit()
}
function onComposeOverlayScalePercentChangeUi(v: number): void {
  onComposeOverlayScalePercentChange(v)
  afterCropComposeEdit()
}
function onComposeOverlayMarginChangeUi(v: number): void {
  onComposeOverlayMarginChange(v)
  afterCropComposeEdit()
}
function onComposeOverlayStartSecChangeUi(v: number): void {
  onComposeOverlayStartSecChange(v)
  afterCropComposeEdit()
}
function onComposeOverlayEndSecChangeUi(v: number): void {
  onComposeOverlayEndSecChange(v)
  afterCropComposeEdit()
}
function onComposeFitIntroOutroChangeUi(v: boolean): void {
  onComposeFitIntroOutroChange(v)
  afterCropComposeEdit()
}

async function onSelectComposeIntroImageUi(): Promise<void> {
  await onSelectComposeIntroImage()
  afterCropComposeEdit()
}
async function onSelectComposeOutroImageUi(): Promise<void> {
  await onSelectComposeOutroImage()
  afterCropComposeEdit()
}
async function onSelectComposeOverlayImageUi(): Promise<void> {
  await onSelectComposeOverlayImage()
  afterCropComposeEdit()
}

function taskModeLabel(mode: TaskMode): string {
  return TASK_MODE_OPTIONS.find((o) => o.value === mode)?.label || mode
}

function queueMediaKindLabel(mode: TaskMode): string {
  if (
    mode === 'image' ||
    mode === 'image-crop' ||
    mode === 'image-stitch'
  ) {
    return '图片文件'
  }
  return '视频文件'
}

/** 模式切换守卫：进行中拦截、类型不符、兼容确认、打码单任务 */
async function handleTaskModeChange(mode: TaskMode): Promise<void> {
  if (mode === taskMode.value) return

  if (hasActive.value) {
    ElMessage.warning('仍有任务处理中，请等待完成或取消后再切换模式。')
    return
  }

  const fromMode = taskMode.value
  const toLabel = taskModeLabel(mode)
  const pendingOrFailed = tasks.value.filter(
    (t) => t.status === 'pending' || t.status === 'failed'
  )

  // 离开打码且仍有未导出区域
  if (
    fromMode === 'video-mosaic' &&
    mode !== 'video-mosaic' &&
    mosaicRegionCount.value > 0 &&
    mosaicTask.value &&
    (mosaicTask.value.status === 'pending' ||
      mosaicTask.value.status === 'failed')
  ) {
    try {
      await ElMessageBox.confirm(
        '打码区域尚未导出，离开将丢弃当前编辑。',
        '离开打码工作台',
        {
          type: 'warning',
          confirmButtonText: '离开并丢弃',
          cancelButtonText: '取消',
          confirmButtonClass: 'el-button--danger is-plain'
        }
      )
    } catch {
      return
    }
  }

  const mismatched = getMismatchedPendingCount(mode)
  if (mismatched > 0) {
    try {
      await ElMessageBox.confirm(
        `当前队列为${queueMediaKindLabel(fromMode)}，无法在「${toLabel}」中处理。是否移除不符项后继续？`,
        '切换任务模式',
        {
          type: 'warning',
          confirmButtonText: '移除并切换',
          cancelButtonText: '取消'
        }
      )
    } catch {
      return
    }
    removeMismatchedPending(mode)
  } else if (pendingOrFailed.length > 0 && mode !== 'video-mosaic') {
    // 类型兼容：保留任务，参数绑定随模式重置
    try {
      await ElMessageBox.confirm(
        '切换后将清空当前队列参数绑定，任务保留为待处理。继续？',
        '切换任务模式',
        {
          type: 'info',
          confirmButtonText: '继续切换',
          cancelButtonText: '取消'
        }
      )
    } catch {
      return
    }
  }

  if (mode === 'video-mosaic') {
    const keep = tasks.value.filter(
      (t) => t.status === 'pending' || t.status === 'failed'
    )
    if (keep.length > 1) {
      try {
        await ElMessageBox.confirm(
          '打码为单任务工作台，将只带入选中的 1 个文件。是否继续？',
          '切换任务模式',
          {
            type: 'warning',
            confirmButtonText: '只带入 1 个并切换',
            cancelButtonText: '取消'
          }
        )
      } catch {
        return
      }
      const preferred =
        (selectedTaskId.value &&
          keep.find((t) => t.id === selectedTaskId.value)) ||
        keep[0]
      tasks.value = [preferred]
      selectedTaskId.value = preferred.id
    } else if (keep.length === 1) {
      tasks.value = [keep[0]]
      selectedTaskId.value = keep[0].id
    } else {
      tasks.value = []
      selectedTaskId.value = null
    }
  }

  onTaskModeChange(mode)
}

const {
  appVersion,
  isPackaged,
  updateDialogVisible,
  updateChecking,
  updateDownloading,
  updateInfo,
  loadVersion,
  onCheckUpdate,
  onDownloadUpdate,
  onCancelDownload,
  onInstallUpdate,
  previewUpdateState,
  subscribe: subscribeUpdater
} = useUpdater()

const {
  dragging,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onDrop,
  subscribe: subscribeDragDrop
} = useDragDrop({
  addFiles,
  lastDropOkAt
})

const {
  isDark,
  start: startTheme,
  stop: stopTheme,
  toggleLightDark
} = useTheme({
  theme,
  setTheme: onThemeChange
})

const appInfo = ref<AppInfo | null>(null)
const imageStatus = ref<ImageEngineStatus | null>(null)
const lanStatus = ref<LanStatus | null>(null)
const lanSaving = ref(false)
const shortcutHelpVisible = ref(false)
const settingsVisible = ref(false)
const closeConfirmVisible = ref(false)

async function refreshLanStatus(): Promise<void> {
  try {
    lanStatus.value = await window.electronAPI.getLanStatus()
  } catch {
    lanStatus.value = null
  }
}

async function onSaveLanConfig(config: {
  enabled?: boolean
  port?: number
  bindHost?: '0.0.0.0' | '127.0.0.1'
  username?: string
  password?: string
}): Promise<void> {
  lanSaving.value = true
  try {
    const res = await window.electronAPI.setLanRemoteConfig(config)
    lanStatus.value = res.status
    if (res.ok) {
      if (config.password) {
        ElMessage.success('远程设置已保存（密码已更新，旧会话已失效）')
      } else if (res.status.running) {
        ElMessage.success('远程访问已开启')
      } else if (config.enabled === false) {
        ElMessage.success('远程访问已关闭')
      } else {
        ElMessage.success('远程设置已保存')
      }
    } else {
      ElMessage.error(res.error || res.status.error || '保存远程设置失败')
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    ElMessage.error(message || '保存远程设置失败')
  } finally {
    lanSaving.value = false
  }
}

async function loadImageStatus(): Promise<void> {
  try {
    imageStatus.value = await window.electronAPI.getImageEngineStatus()
  } catch {
    imageStatus.value = null
  }
}

let cleanupTasks: (() => void) | undefined
let cleanupUpdater: (() => void) | undefined
let cleanupDrag: (() => void) | undefined
let cleanupHotkeys: (() => void) | undefined
let cleanupCloseAsk: (() => void) | undefined
let cleanupTray: (() => void) | undefined

onMounted(async () => {
  // 1) 恢复持久化设置
  await loadSettings()

  // 1.1) 应用主题（依赖已加载的 theme）
  startTheme()

  // 1.2) 应用信息（设置抽屉「关于」展示）
  window.electronAPI
      .getAppInfo()
      .then((i) => {
        appInfo.value = i
      })
      .catch(() => {
        // 忽略失败，抽屉中显示占位
      })

  // 2) 将并发同步到主进程任务队列
  try {
    const res = await window.electronAPI.setConcurrency(concurrency.value)
    concurrency.value = res.concurrency
  } catch {
    // ignore
  }

  // 3) 恢复任务列表（依赖 settings.persistTasks）
  await loadTasks()

  // 4) FFmpeg 状态 + 编码器探测
  await loadStatus()

  // 4.1) 图片引擎状态
  await loadImageStatus()

  // 4.2) 局域网远程状态
  await refreshLanStatus()

  // 5) 版本信息
  await loadVersion()

  // 6) 自定义参数监听（持久化 + 同步 pending）
  startWatchers()

  // 7) 订阅事件
  cleanupTasks = subscribeTasks()
  cleanupUpdater = subscribeUpdater()
  cleanupDrag = subscribeDragDrop()
  cleanupHotkeys = subscribeHotkeys({
    startAll,
    cancelAll,
    onSelectFiles,
    onSelectOutput,
    clearFinished,
    toggleTheme: toggleLightDark,
    showHelp: () => {
      shortcutHelpVisible.value = true
    }
  })
  cleanupCloseAsk = window.electronAPI.onWindowCloseAsk(() => {
    closeConfirmVisible.value = true
  })
  cleanupTray = window.electronAPI.onTrayCommand((cmd) => {
    if (cmd === 'check-update') {
      void onCheckUpdate()
    } else if (cmd === 'open-settings') {
      settingsVisible.value = true
    }
  })
})

onUnmounted(() => {
  stopWatchers()
  stopTheme()
  cleanupTasks?.()
  cleanupUpdater?.()
  cleanupDrag?.()
  cleanupHotkeys?.()
  cleanupCloseAsk?.()
  cleanupTray?.()
})

async function onCloseDecide(
    action: 'tray' | 'quit',
    remember: boolean
): Promise<void> {
  if (remember) {
    onCloseActionChange(action)
  }
  try {
    await window.electronAPI.windowCloseDecision(action, remember)
  } catch {
    // ignore
  }
}

function onCloseCancel(): void {
  void window.electronAPI.windowCloseCancel()
}

/** 浏览并设置自定义 ffmpeg bin 目录 */
async function onBrowseFfmpegDir(): Promise<void> {
  const res = await window.electronAPI.selectDirectory(ffmpegBinDir.value || undefined)
  if (!res.path) return
  const r = await onSetFfmpegBinDir(res.path)
  if (r.ok) {
    ElMessage.success('已设置自定义 ffmpeg 目录')
    await loadStatus()
  } else {
    ElMessage.error(r.error || '设置 ffmpeg 目录失败')
  }
}

/** 清除自定义 bin 目录覆盖（回退自动探测） */
async function onClearFfmpegBinDir(): Promise<void> {
  const r = await onSetFfmpegBinDir('')
  if (r.ok) {
    ElMessage.success('已恢复自动探测 ffmpeg')
    await loadStatus()
  } else {
    ElMessage.error(r.error || '清除 ffmpeg 目录失败')
  }
}

async function onBrowseMagickPath(): Promise<void> {
  const res = await window.electronAPI.selectDirectory(imagemagickPath.value || undefined)
  if (!res.path) return
  const r = await onSetMagickPath(res.path)
  if (r.ok) {
    ElMessage.success('已设置 ImageMagick 路径')
    await loadImageStatus()
  } else {
    ElMessage.error(r.error || '设置 ImageMagick 路径失败')
  }
}

async function onClearMagickPath(): Promise<void> {
  const r = await onSetMagickPath('')
  if (r.ok) {
    ElMessage.success('已清除 ImageMagick 路径覆盖')
    await loadImageStatus()
  } else {
    ElMessage.error(r.error || '清除失败')
  }
}

async function onImageEngineSelect(v: typeof imageEngine.value): Promise<void> {
  onImageEngineChange(v)
  await loadImageStatus()
}

/** 选一张图输出到临时目录，验证当前图片引擎 */
async function onTestImageEngine(): Promise<void> {
  try {
    const pick = await window.electronAPI.selectImage()
    if (!pick.path) return
    const inputPath = pick.path
    const stamp = Date.now()
    const base =
        inputPath.replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '') || 'test'
    const outDir =
        (typeof window !== 'undefined' &&
            (appInfo.value?.userDataPath
                ? `${appInfo.value.userDataPath}\\image-test`
                : '')) ||
        ''
    // 输出路径由主进程确保目录；userData 不可用时用输入同目录
    const outputPath = outDir
        ? `${outDir}\\${base}_${stamp}.jpg`
        : inputPath.replace(/(\.[^.]+)?$/, `_${stamp}.jpg`)
    const result = await window.electronAPI.processImage({
      inputPath,
      outputPath,
      maxEdge: 1280,
      format: 'jpeg',
      quality: 80,
      strip: true
    })
    if (result.ok && result.outputPath) {
      ElMessage.success(
          `引擎测试成功（${result.engine || imageEngine.value}）→ ${result.width || '?'}×${result.height || '?'}`
      )
      await window.electronAPI.showItemInFolder(result.outputPath)
      await loadImageStatus()
    } else {
      ElMessage.error(result.error || '图片引擎测试失败')
      await loadImageStatus()
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    ElMessage.error(message || '图片引擎测试失败')
  }
}

/** 打开用户数据目录 */
async function onOpenAppData(): Promise<void> {
  const p = appInfo.value?.userDataPath
  if (!p) {
    ElMessage.error('数据目录不可用')
    return
  }
  const res = await window.electronAPI.openPath(p)
  if (!res.ok) {
    ElMessage.error(res.error || '打开数据目录失败')
  }
}

/** 修改用户数据目录（需重启生效） */
async function onChangeDataDir(): Promise<void> {
  const res = await window.electronAPI.selectDirectory(
      appInfo.value?.userDataPath || undefined
  )
  if (!res.path) return
  try {
    const r = await window.electronAPI.setDataDir(res.path)
    if (!r.ok) {
      ElMessage.error(r.error || '修改数据目录失败')
      return
    }
    if (r.restart === false) {
      ElMessage.info('已是当前数据目录')
      return
    }
    if (appInfo.value) {
      appInfo.value = {...appInfo.value, userDataPath: res.path}
    }
    const migrated = r.migrated?.length ?? 0
    const migrateErr = r.migrateErrors?.length ?? 0
    const tip =
        migrated > 0
            ? `已迁移 ${migrated} 项到新目录（缓存类目录已跳过）`
            : '数据目录已更新（无可迁移文件或目标已存在同名文件）'
    if (migrateErr > 0) {
      ElMessage.warning(`${tip}；${migrateErr} 项迁移失败`)
    } else {
      ElMessage.success(`${tip}，重启后完全生效`)
    }
    try {
      await ElMessageBox.confirm(
          '数据目录已切换，设置与任务列表会尽量迁移到新目录（不覆盖已有文件；Chromium 缓存不迁移）。是否立即重启？',
          '重启应用',
          {
            type: 'info',
            confirmButtonText: '立即重启',
            cancelButtonText: '稍后'
          }
      )
      await window.electronAPI.relaunchApp()
    } catch {
      // 用户取消重启
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    ElMessage.error(message || '修改数据目录失败')
  }
}

/** 清空已持久化任务（磁盘 + 当前列表） */
async function onClearStoredTasks(): Promise<void> {
  const res = await window.electronAPI.clearStoredTasks()
  if (!res.ok) {
    ElMessage.error(res.error || '清空持久化任务失败')
    return
  }
  clearAll()
  ElMessage.success('已清空持久化任务')
}

/** 重置全部设置：覆盖 ref → 应用主题 → 重新探测 ffmpeg */
async function onResetSettings(): Promise<void> {
  try {
    const prevPersistTasks = persistTasks.value
    const s = await window.electronAPI.resetSettings()
    applyLoadedSettings(s)
    // 重置后并发回到默认，需同步主进程队列
    try {
      const res = await window.electronAPI.setConcurrency(concurrency.value)
      concurrency.value = res.concurrency
    } catch {
      // ignore
    }
    startTheme()
    await loadStatus()
    await loadImageStatus()
    await refreshLanStatus()
    if (persistTasks.value !== prevPersistTasks) {
      await loadTasks()
    }
    ElMessage.success('设置已重置')
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    ElMessage.error(message || '重置设置失败')
  }
}
</script>

<template>
  <div
      class="page"
      :class="{ 'page-dragging': dragging }"
      @dragenter="onDragEnter"
      @dragleave="onDragLeave"
      @dragover="onDragOver"
      @drop="onDrop"
  >
    <TitleBar
        :app-version="appVersion"
        :ffmpeg-status="ffmpegStatus"
        :is-dark="isDark"
        :theme="theme"
        :update-available="
          updateInfo.state === 'available' || updateInfo.state === 'downloading'
        "
        :update-downloaded="
          updateInfo.state === 'downloaded' || updateInfo.state === 'installing'
        "
        :update-version="updateInfo.version"
        @open-settings="settingsVisible = true"
        @show-shortcuts="shortcutHelpVisible = true"
        @open-update="updateDialogVisible = true"
        @toggle-theme="toggleLightDark"
    />

    <SettingsDrawer
        v-model:visible="settingsVisible"
        :app-info="appInfo"
        :app-version="appVersion"
        :close-action="closeAction"
        :concurrency="concurrency"
        :ffmpeg-bin-dir="ffmpegBinDir"
        :ffmpeg-status="ffmpegStatus"
        :image-engine="imageEngine"
        :imagemagick-path="imagemagickPath"
        :image-status="imageStatus"
        :is-packaged="isPackaged"
        :lan-saving="lanSaving"
        :lan-status="lanStatus"
        :notify-on-complete="notifyOnComplete"
        :open-at-login="openAtLogin"
        :persist-tasks="persistTasks"
        :start-minimized-to-tray="startMinimizedToTray"
        :theme="theme"
        :update-checking="updateChecking"
        @browse-ffmpeg-dir="onBrowseFfmpegDir"
        @browse-magick-path="onBrowseMagickPath"
        @change-data-dir="onChangeDataDir"
        @check-update="onCheckUpdate"
        @clear-ffmpeg-bin-dir="onClearFfmpegBinDir"
        @clear-magick-path="onClearMagickPath"
        @clear-stored-tasks="onClearStoredTasks"
        @close-action-change="onCloseActionChange"
        @concurrency-change="onConcurrencyChange"
        @image-engine-change="onImageEngineSelect"
        @notify-on-complete-change="onNotifyOnCompleteChange"
        @open-app-data="onOpenAppData"
        @open-at-login-change="onOpenAtLoginChange"
        @persist-tasks-change="onPersistTasksChange"
        @start-minimized-to-tray-change="onStartMinimizedToTrayChange"
        @re-detect-ffmpeg="loadStatus"
        @re-detect-image="loadImageStatus"
        @refresh-lan-status="refreshLanStatus"
        @reset-settings="onResetSettings"
        @save-lan-config="onSaveLanConfig"
        @test-image-engine="onTestImageEngine"
        @theme-change="onThemeChange"
    />

    <UpdateDialog
        v-model="updateDialogVisible"
        :app-version="appVersion"
        :is-packaged="isPackaged"
        :update-checking="updateChecking"
        :update-downloading="updateDownloading"
        :update-info="updateInfo"
        @check-update="onCheckUpdate"
        @download-update="onDownloadUpdate"
        @cancel-download="onCancelDownload"
        @install-update="onInstallUpdate"
        @preview-state="previewUpdateState"
    />

    <ShortcutHelpDialog v-model="shortcutHelpVisible"/>

    <CloseConfirmDialog
        v-model="closeConfirmVisible"
        @cancel="onCloseCancel"
        @decide="onCloseDecide"
    />

    <div class="shell">
      <ModeSidebar
          :app-version="appVersion"
          :concurrency="concurrency"
          :task-mode="taskMode"
          @task-mode-change="handleTaskModeChange"
      />

      <div class="shell-main">
        <CompressOptionsPanel
            :aspect-ratio="aspectRatio"
            :audio-bitrate="audioBitrate"
            :audio-format="audioFormat"
            :compat-profile="compatProfile"
            :compose-fit-intro-outro="composeFitIntroOutro"
            :compose-intro-duration="composeIntroDuration"
            :compose-intro-path="composeIntroPath"
            :compose-outro-duration="composeOutroDuration"
            :compose-outro-path="composeOutroPath"
            :compose-overlay-end-sec="composeOverlayEndSec"
            :compose-overlay-margin="composeOverlayMargin"
            :compose-overlay-opacity="composeOverlayOpacity"
            :compose-overlay-path="composeOverlayPath"
            :compose-overlay-position="composeOverlayPosition"
            :compose-overlay-scale-percent="composeOverlayScalePercent"
            :compose-overlay-start-sec="composeOverlayStartSec"
            :concat-prefer-copy="concatPreferCopy"
            :concurrency="concurrency"
            :crop-compose-warning-text="cropComposeWarningText"
            :crop-h="cropH"
            :crop-preview-path="cropPreviewPath"
            :crop-w="cropW"
            :crop-x="cropX"
            :crop-y="cropY"
            :custom="custom"
            :encode-preset="encodePreset"
            :encoder="encoder"
            :encoder-info="encoderInfo"
            :fps="fps"
            :has-active="hasActive"
            :has-pending="hasPending"
            :image-background="imageBackground"
            :image-format="imageFormat"
            :image-gap="imageGap"
            :image-grid-cols="imageGridCols"
            :image-layout="imageLayout"
            :image-max-edge="imageMaxEdge"
            :image-quality="imageQuality"
            :image-strip="imageStrip"
            :is-audio-mode="isAudioMode"
            :is-custom="isCustom"
            :is-image-mode="isImageMode"
            :is-media-compose-mode="isMediaComposeMode"
            :is-video-compress-mode="isVideoCompressMode"
            :is-video-concat-mode="isVideoConcatMode"
            :is-video-mosaic-mode="isVideoMosaicMode"
            :is-webm="isWebm"
            :mosaic-frame-by-frame="mosaicFrameByFrame"
            :mute-audio="muteAudio"
            :name-template="nameTemplate"
            :name-template-custom="nameTemplateCustom"
            :out-height="outHeight"
            :out-width="outWidth"
            :output-dir="outputDir"
            :output-dir-mode="outputDirMode"
            :preset-description="currentPreset.description"
            :preset-id="presetId"
            :rotate90="rotate90"
            :scale-mode="scaleMode"
            :scale-pad="scalePad"
            :show-crop-compose-warning="showCropComposeGlobalWarning"
            :target-size-mb="targetSizeMb"
            :task-mode="taskMode"
            :trim-end="trimEnd"
            :trim-start="trimStart"
            :two-pass="twoPass"
            :video-audio-bitrate="videoAudioBitrate"
            :watermark-font-size="watermarkFontSize"
            :watermark-image-path="watermarkImagePath"
            :watermark-margin="watermarkMargin"
            :watermark-mode="watermarkMode"
            :watermark-opacity="watermarkOpacity"
            :watermark-position="watermarkPosition"
            :watermark-scale-percent="watermarkScalePercent"
            :watermark-text="watermarkText"
            @apply-to-pending="applyOptionsToPending"
            @start-all="startAll"
            @audio-bitrate-change="onAudioBitrateChange"
            @audio-format-change="onAudioFormatChange"
            @compat-profile-change="onCompatProfileChange"
            @concurrency-change="onConcurrencyChange"
            @custom-name-template-input="onCustomNameTemplateInput"
            @encode-preset-change="onEncodePresetChange"
            @encoder-change="onEncoderChange"
            @fps-change="onFpsChange"
            @mute-audio-change="onMuteAudioChange"
            @name-template-change="onNameTemplateChange"
            @output-dir-mode-change="onOutputDirModeChange"
            @preset-change="onPresetChange"
            @rotate90-change="onRotate90Change"
            @select-output="onSelectOutput"
            @select-watermark-image="onSelectWatermarkImage"
            @target-size-mb-change="onTargetSizeMbChange"
            @trim-end-change="onTrimEndChange"
            @trim-start-change="onTrimStartChange"
            @two-pass-change="onTwoPassChange"
            @video-audio-bitrate-change="onVideoAudioBitrateChange"
            @watermark-mode-change="onWatermarkModeChange"
            @watermark-image-path-change="onWatermarkImagePathChange"
            @watermark-text-change="onWatermarkTextChange"
            @watermark-position-change="onWatermarkPositionChange"
            @watermark-opacity-change="onWatermarkOpacityChange"
            @watermark-scale-percent-change="onWatermarkScalePercentChange"
            @watermark-font-size-change="onWatermarkFontSizeChange"
            @watermark-margin-change="onWatermarkMarginChange"
            @image-format-change="onImageFormatChange"
            @image-quality-change="onImageQualityChange"
            @image-max-edge-change="onImageMaxEdgeChange"
            @image-strip-change="onImageStripChange"
            @image-layout-change="onImageLayoutChange"
            @image-grid-cols-change="onImageGridColsChange"
            @image-gap-change="onImageGapChange"
            @image-background-change="onImageBackgroundChange"
            @crop-x-change="onCropXChangeUi"
            @crop-y-change="onCropYChangeUi"
            @crop-w-change="onCropWChangeUi"
            @crop-h-change="onCropHChangeUi"
            @concat-prefer-copy-change="onConcatPreferCopyChange"
            @mosaic-frame-by-frame-change="onMosaicFrameByFrameChange"
            @compose-intro-path-change="onComposeIntroPathChangeUi"
            @compose-intro-duration-change="onComposeIntroDurationChangeUi"
            @compose-outro-path-change="onComposeOutroPathChangeUi"
            @compose-outro-duration-change="onComposeOutroDurationChangeUi"
            @compose-overlay-path-change="onComposeOverlayPathChangeUi"
            @compose-overlay-position-change="onComposeOverlayPositionChangeUi"
            @compose-overlay-opacity-change="onComposeOverlayOpacityChangeUi"
            @compose-overlay-scale-percent-change="onComposeOverlayScalePercentChangeUi"
            @compose-overlay-margin-change="onComposeOverlayMarginChangeUi"
            @compose-overlay-start-sec-change="onComposeOverlayStartSecChangeUi"
            @compose-overlay-end-sec-change="onComposeOverlayEndSecChangeUi"
            @compose-fit-intro-outro-change="onComposeFitIntroOutroChangeUi"
            @select-compose-intro-image="onSelectComposeIntroImageUi"
            @select-compose-outro-image="onSelectComposeOutroImageUi"
            @select-compose-overlay-image="onSelectComposeOverlayImageUi"
            @scale-mode-change="onScaleModeChange"
            @out-width-change="onOutWidthChange"
            @out-height-change="onOutHeightChange"
            @aspect-ratio-change="onAspectRatioChange"
            @scale-pad-change="onScalePadChange"
        />

        <VideoMosaicDialog
            v-model="mosaicDialogOpen"
            :regions="mosaicRegions"
            :video-path="mosaicVideoPath"
            @confirm="onMosaicConfirm"
        />

        <StitchOrderDialog
            v-model="stitchOrderOpen"
            :background="stitchOrderTask?.options?.image?.background || imageBackground"
            :editable="stitchOrderEditable"
            :gap="stitchOrderTask?.options?.image?.gap ?? imageGap"
            :grid-cols="stitchOrderTask?.options?.image?.gridCols ?? imageGridCols"
            :layout="stitchOrderTask?.options?.image?.layout || imageLayout"
            :mode="stitchOrderMode"
            :paths="stitchOrderPaths"
            @append="onStitchOrderAppend"
            @confirm="onStitchOrderConfirm"
        />

        <div class="workspace">
          <!-- 打码：无任务列表的单页工作台 -->
          <MosaicWorkbench
              v-if="isVideoMosaicMode"
              :dragging="dragging"
              :mosaic-editable="mosaicEditable"
              :mosaic-region-count="mosaicRegionCount"
              :task="mosaicTask"
              @add="onSelectFiles"
              @cancel="cancelOne"
              @clear="onMosaicClear"
              @open="openOutput"
              @start="startOne"
              @edit-mosaics="openMosaicEditor"
              @show-in-folder="showInFolder"
          />

          <template v-else>
            <DropZone
                :compact="tasks.length > 0"
                :dragging="dragging"
                :show-task-edit-hint="pendingCount > 1"
                :task-mode="taskMode"
                @click="onSelectFiles"
            />

            <SizeSummaryBar
                :count="sizeSummary.count"
                :ratio="sizeSummary.ratio"
                :total-in="sizeSummary.totalIn"
                :total-out="sizeSummary.totalOut"
            />

            <TaskTable
                :has-active="hasActive"
                :selected-task-id="selectedTaskId"
                :tasks="tasks"
                @cancel-all="cancelAll"
                @cancel-one="cancelOne"
                @clear-all="clearAll"
                @clear-finished="clearFinished"
                @open-output="openOutput"
                @remove-one="removeOne"
                @select-task="selectTask"
                @show-in-folder="showInFolder"
                @start-one="startOne"
                @open-stitch-order="openStitchOrder"
            />
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
