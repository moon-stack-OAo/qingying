import fs from 'fs'
import path from 'path'
import {app} from 'electron'
import type {
  AudioFormat,
  CompressOptions,
  CompressTask,
  ImagePresetId,
  LanTaskView,
  OutputFormat,
  PresetId,
  ProgressPayload,
  TaskEndPayload,
  TaskMode
} from '../../../shared/types'
import {
  DEFAULT_AUDIO_BITRATE,
  DEFAULT_IMAGE_PRESETS,
  DEFAULT_PRESETS,
  IMAGE_EXTENSIONS,
  VIDEO_EXTENSIONS
} from '../../../shared/types'
import {isPathInsideAnyRoot} from '../pathAllowlist'
import {getSettings} from '../settings'
import {taskQueue} from '../taskQueue'
import {LAN_NAME_TEMPLATE, lanCtx} from './context'
import {cleanupLanUploadSource, lanMediaAllowedRoots} from './paths'

type ImageOutputFormat = 'jpeg' | 'png' | 'webp' | 'keep'

/** 允许的扩展名：视频 + 常见音频源 + 图片 */
const ALLOWED_EXTENSIONS = new Set<string>([
  ...(VIDEO_EXTENSIONS as string[]),
  '.mp3',
  '.m4a',
  '.aac',
  '.wav',
  '.flac',
  '.ogg',
  '.opus',
  '.wma',
  ...(IMAGE_EXTENSIONS as string[])
])

const IMAGE_EXT_SET = new Set(
  (IMAGE_EXTENSIONS as string[]).map((e) => e.toLowerCase())
)
const VIDEO_EXT_SET = new Set(
  (VIDEO_EXTENSIONS as string[]).map((e) => e.toLowerCase())
)

export function isImageExt(fileName: string): boolean {
  return IMAGE_EXT_SET.has(path.extname(fileName).toLowerCase())
}

export function isVideoExt(fileName: string): boolean {
  return VIDEO_EXT_SET.has(path.extname(fileName).toLowerCase())
}

export function isAllowedExt(fileName: string): boolean {
  const ext = path.extname(fileName).toLowerCase()
  return ALLOWED_EXTENSIONS.has(ext)
}

export function taskHasThumbnail(task: CompressTask): boolean {
  if (task.options?.mode === 'audio') return false
  const p =
    (typeof task.inputPath === 'string' && task.inputPath.trim()) ||
    (Array.isArray(task.inputPaths) &&
      task.inputPaths.find((x) => typeof x === 'string' && x.trim())) ||
    ''
  const name = p || task.fileName || ''
  return isImageExt(name) || isVideoExt(name)
}

export function resolveThumbSourcePath(task: CompressTask): string | null {
  // 源可能在任务结束后已从 lan-uploads 清理，完成后优先用输出
  // 与下载一致：仅允许落在 lan-uploads / lan-outputs / 当前 outputDir
  const allowedRoots = lanMediaAllowedRoots(true)
  const candidates = [
    ...(Array.isArray(task.inputPaths) ? task.inputPaths : []),
    task.inputPath,
    task.status === 'completed' ? task.outputPath : ''
  ]
  for (const raw of candidates) {
    const p = typeof raw === 'string' ? raw.trim() : ''
    if (!p) continue
    const resolved = path.resolve(p)
    if (!isPathInsideAnyRoot(allowedRoots, resolved)) continue
    if (!fs.existsSync(resolved)) continue
    try {
      if (!fs.statSync(resolved).isFile()) continue
    } catch {
      continue
    }
    if (isImageExt(resolved) || isVideoExt(resolved)) return resolved
  }
  return null
}

export function parseImagePresetId(raw: unknown): ImagePresetId | undefined {
  if (
    raw === 'optimize' ||
    raw === 'standard' ||
    raw === 'social' ||
    raw === 'thumb' ||
    raw === 'custom'
  ) {
    return raw
  }
  return undefined
}

export function parseImageFormat(raw: unknown): ImageOutputFormat | undefined {
  if (raw === 'jpeg' || raw === 'png' || raw === 'webp' || raw === 'keep') {
    return raw
  }
  return undefined
}

export function toLanView(task: CompressTask): LanTaskView {
  const downloadable =
    task.status === 'completed' &&
    Boolean(task.outputPath) &&
    fs.existsSync(task.outputPath)
  return {
    id: task.id,
    fileName: task.fileName,
    status: task.status,
    progress: task.progress ?? 0,
    inputSize: task.inputSize,
    outputSize: task.outputSize,
    error: task.error,
    time: task.time,
    speed: task.speed,
    etaSec: task.etaSec,
    mode: task.options?.mode,
    downloadable,
    hasThumbnail: taskHasThumbnail(task)
  }
}

export function genTaskId(): string {
  return `lan-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function resolvePreset(presetId: PresetId): {
  crf: number
  maxEdge: number
  format: OutputFormat
} {
  const p = DEFAULT_PRESETS.find((x) => x.id === presetId)
  if (p && presetId !== 'custom') {
    return {crf: p.crf, maxEdge: p.maxEdge, format: p.format}
  }
  const s = getSettings()
  return {
    crf: s.customCrf,
    maxEdge: s.customMaxEdge,
    format: s.customFormat
  }
}

export function resolveOutputDir(
  settings: ReturnType<typeof getSettings>
): string {
  const outputDir =
    settings.outputDir && settings.outputDir.trim()
      ? settings.outputDir.trim()
      : path.join(app.getPath('userData'), 'lan-outputs')

  if (!fs.existsSync(outputDir)) {
    try {
      fs.mkdirSync(outputDir, {recursive: true})
    } catch {
      // 后续 enqueue 再报错
    }
  }
  return outputDir
}

function buildLanImageOptions(params: {
  imagePresetId?: ImagePresetId
  imageFormat?: ImageOutputFormat
  imageQuality?: number
  imageMaxEdge?: number
  imageStrip?: boolean
}): CompressOptions {
  const settings = getSettings()
  const imagePresetId: ImagePresetId = params.imagePresetId || 'standard'

  let format: ImageOutputFormat = settings.imageFormat || 'jpeg'
  let quality =
    typeof settings.imageQuality === 'number' &&
    Number.isFinite(settings.imageQuality)
      ? Math.max(1, Math.min(100, Math.round(settings.imageQuality)))
      : 80
  let maxEdge =
    typeof settings.imageMaxEdge === 'number' &&
    Number.isFinite(settings.imageMaxEdge)
      ? Math.max(0, Math.floor(settings.imageMaxEdge))
      : 1920
  let strip =
    typeof settings.imageStrip === 'boolean' ? settings.imageStrip : true

  if (imagePresetId !== 'custom') {
    const preset = DEFAULT_IMAGE_PRESETS[imagePresetId]
    format = preset.format
    quality = preset.quality
    maxEdge = preset.maxEdge
  } else {
    if (params.imageFormat) format = params.imageFormat
    if (
      typeof params.imageQuality === 'number' &&
      Number.isFinite(params.imageQuality)
    ) {
      quality = Math.max(1, Math.min(100, Math.round(params.imageQuality)))
    }
    if (
      typeof params.imageMaxEdge === 'number' &&
      Number.isFinite(params.imageMaxEdge)
    ) {
      maxEdge = Math.max(0, Math.floor(params.imageMaxEdge))
    }
    if (typeof params.imageStrip === 'boolean') {
      strip = params.imageStrip
    }
  }

  // 视频必填字段：图片任务仅作占位，执行走 image 分支
  const videoBase = resolvePreset(settings.presetId || 'standard')

  return {
    presetId: settings.presetId || 'standard',
    crf: videoBase.crf,
    maxEdge: videoBase.maxEdge,
    format: videoBase.format,
    outputDir: resolveOutputDir(settings),
    encoder: settings.encoder || 'auto',
    nameTemplate: LAN_NAME_TEMPLATE,
    outputDirMode: settings.outputDirMode || 'fixed',
    mode: 'image',
    fallbackToSoftware: true,
    image: {
      format,
      quality,
      maxEdge,
      strip
    }
  }
}

export function buildLanOptions(params: {
  mode?: TaskMode
  presetId?: PresetId
  format?: OutputFormat
  maxEdge?: number
  /** 自定义预设时可覆盖 CRF */
  crf?: number
  /** 可选目标体积 MB（>0 生效） */
  targetSizeMb?: number
  audioFormat?: AudioFormat
  audioBitrate?: string
  imagePresetId?: ImagePresetId
  imageFormat?: ImageOutputFormat
  imageQuality?: number
  imageMaxEdge?: number
  imageStrip?: boolean
}): CompressOptions {
  if (params.mode === 'image') {
    return buildLanImageOptions(params)
  }

  const settings = getSettings()
  const mode: TaskMode = params.mode === 'audio' ? 'audio' : 'compress'
  const presetId: PresetId =
    params.presetId === 'archive' ||
    params.presetId === 'standard' ||
    params.presetId === 'social' ||
    params.presetId === 'custom'
      ? params.presetId
      : settings.presetId || 'standard'

  const base = resolvePreset(presetId)
  let format: OutputFormat = base.format
  if (
    params.format === 'mp4' ||
    params.format === 'webm' ||
    params.format === 'mkv' ||
    params.format === 'mov'
  ) {
    format = params.format
  }

  let maxEdge = base.maxEdge
  if (typeof params.maxEdge === 'number' && Number.isFinite(params.maxEdge)) {
    maxEdge = Math.max(0, Math.floor(params.maxEdge))
  }

  // 自定义预设允许远程覆盖 CRF；其它预设用预设固定值
  let crf = base.crf
  if (
    presetId === 'custom' &&
    typeof params.crf === 'number' &&
    Number.isFinite(params.crf)
  ) {
    crf = Math.max(0, Math.min(51, Math.round(params.crf)))
  }

  let targetSizeMb =
    settings.targetSizeMb > 0 ? settings.targetSizeMb : undefined
  if (
    typeof params.targetSizeMb === 'number' &&
    Number.isFinite(params.targetSizeMb) &&
    params.targetSizeMb > 0
  ) {
    targetSizeMb = Math.min(10240, Math.max(1, params.targetSizeMb))
  }

  const audioFormat: AudioFormat =
    params.audioFormat === 'mp3' ||
    params.audioFormat === 'opus' ||
    params.audioFormat === 'm4a'
      ? params.audioFormat
      : settings.audioFormat || 'm4a'

  const audioBitrate =
    typeof params.audioBitrate === 'string' && params.audioBitrate.trim()
      ? params.audioBitrate.trim()
      : settings.audioBitrate || DEFAULT_AUDIO_BITRATE

  return {
    presetId,
    crf,
    maxEdge,
    format,
    outputDir: resolveOutputDir(settings),
    encoder: settings.encoder || 'auto',
    nameTemplate: LAN_NAME_TEMPLATE,
    outputDirMode: settings.outputDirMode || 'fixed',
    targetSizeMb,
    twoPass: settings.twoPass,
    mode,
    audioFormat,
    audioBitrate,
    // 水印等高级项不暴露远程，使用本机默认（无）
    fallbackToSoftware: true
  }
}

function updateLanTaskFromProgress(p: ProgressPayload): void {
  const rec = lanCtx.lanTasks.get(p.taskId)
  if (!rec) return
  rec.task = {
    ...rec.task,
    status: 'running',
    progress: p.percent,
    time: p.time,
    speed: p.speed,
    etaSec: p.etaSec
  }
}

function updateLanTaskFromEnd(p: TaskEndPayload): void {
  const rec = lanCtx.lanTasks.get(p.taskId)
  if (!rec) return
  rec.task = {
    ...rec.task,
    status: p.status,
    progress: p.status === 'completed' ? 100 : rec.task.progress,
    error: p.error,
    outputPath: p.outputPath || rec.task.outputPath,
    inputSize: p.inputSize ?? rec.task.inputSize,
    outputSize: p.outputSize,
    resolvedEncoder: p.resolvedEncoder,
    commandLine: p.commandLine,
    etaSec: p.status === 'completed' ? 0 : rec.task.etaSec
  }
  // 局域网任务结束（完成/失败/取消）后删除上传源，释放磁盘；仅限 lan-uploads
  if (
    rec.fromLan &&
    (p.status === 'completed' ||
      p.status === 'failed' ||
      p.status === 'cancelled')
  ) {
    cleanupLanUploadSource(rec.task)
  }
}

export function attachQueueListener(): void {
  if (lanCtx.removeQueueListener) return
  lanCtx.removeQueueListener = taskQueue.addListener({
    onProgress: updateLanTaskFromProgress,
    onEnd: updateLanTaskFromEnd,
    onQueued: (taskId, task) => {
      const rec = lanCtx.lanTasks.get(taskId)
      if (rec) {
        rec.task = {...task, status: 'queued'}
      }
    }
  })
}

export function detachQueueListener(): void {
  lanCtx.removeQueueListener?.()
  lanCtx.removeQueueListener = null
}
