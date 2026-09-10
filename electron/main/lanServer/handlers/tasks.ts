import fs from 'fs'
import path from 'path'
import type {IncomingMessage, ServerResponse} from 'http'
import type {
  AudioFormat,
  CompressTask,
  OutputFormat,
  PresetId,
  TaskMode
} from '../../../../shared/types'
import {checkFfmpegAvailable} from '../../ffmpeg'
import {getImageEngineStatus} from '../../image'
import {taskQueue} from '../../taskQueue'
import {
  lanCtx,
  MAX_CONCURRENT_UPLOADS
} from '../context'
import {json, requireAuth} from '../httpUtil'
import {MAX_UPLOAD_BYTES, parseMultipart, sanitizeFileName} from '../multipart'
import {ensureUploadsDir, uploadsDir} from '../paths'
import {
  buildLanOptions,
  genTaskId,
  isAllowedExt,
  isImageExt,
  parseImageFormat,
  parseImagePresetId,
  toLanView
} from '../taskUtil'

export function handleListTasks(
  req: IncomingMessage,
  res: ServerResponse
): void {
  if (!requireAuth(req, res)) return
  const list = Array.from(lanCtx.lanTasks.values())
    .map((r) => toLanView(r.task))
    .sort((a, b) => {
      // 新任务 id 含时间戳，倒序
      return b.id.localeCompare(a.id)
    })
  json(res, 200, {ok: true, tasks: list})
}

export async function handleCreateTask(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  if (!requireAuth(req, res)) return

  if (lanCtx.activeUploads >= MAX_CONCURRENT_UPLOADS) {
    // 丢弃未读 body，避免连接挂起
    req.resume()
    json(res, 429, {
      ok: false,
      error: `当前上传过多，最多同时 ${MAX_CONCURRENT_UPLOADS} 个，请稍后再试`
    })
    return
  }

  ensureUploadsDir()
  lanCtx.activeUploads += 1
  let parsed
  try {
    parsed = await parseMultipart(req, uploadsDir(), MAX_UPLOAD_BYTES)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    json(res, 400, {ok: false, error: msg})
    return
  } finally {
    lanCtx.activeUploads = Math.max(0, lanCtx.activeUploads - 1)
  }

  const file =
    parsed.files.find((f) => f.fieldName === 'file') || parsed.files[0]
  if (!file) {
    json(res, 400, {ok: false, error: '请上传文件（字段名 file）'})
    return
  }

  if (!isAllowedExt(file.fileName)) {
    try {
      fs.unlinkSync(file.tempPath)
    } catch {
      // ignore
    }
    json(res, 400, {
      ok: false,
      error: `不支持的文件类型：${path.extname(file.fileName) || '未知'}`
    })
    return
  }

  // options 可来自字段 options（JSON 字符串）或独立字段
  let optRaw: Record<string, unknown> = {}
  if (parsed.fields.options) {
    try {
      const o = JSON.parse(parsed.fields.options) as unknown
      if (o && typeof o === 'object') optRaw = o as Record<string, unknown>
    } catch {
      json(res, 400, {ok: false, error: 'options JSON 无效'})
      return
    }
  } else {
    optRaw = {...parsed.fields}
  }

  // 模式：显式 image/audio；上传图片扩展名时自动走图片压缩
  let mode: TaskMode =
    optRaw.mode === 'audio'
      ? 'audio'
      : optRaw.mode === 'image'
        ? 'image'
        : 'compress'
  if (isImageExt(file.fileName)) {
    if (mode === 'audio') {
      try {
        fs.unlinkSync(file.tempPath)
      } catch {
        // ignore
      }
      json(res, 400, {
        ok: false,
        error: '图片无法用于音频抽取，请选择「图片压缩」'
      })
      return
    }
    mode = 'image'
  } else if (mode === 'image') {
    try {
      fs.unlinkSync(file.tempPath)
    } catch {
      // ignore
    }
    json(res, 400, {ok: false, error: '图片压缩仅支持图片文件'})
    return
  }

  if (mode === 'image') {
    const imageEngine = getImageEngineStatus()
    if (imageEngine.error) {
      try {
        fs.unlinkSync(file.tempPath)
      } catch {
        // ignore
      }
      json(res, 503, {
        ok: false,
        error: imageEngine.error || '图片引擎未就绪'
      })
      return
    }
  } else {
    const status = checkFfmpegAvailable()
    if (!status.ready) {
      try {
        fs.unlinkSync(file.tempPath)
      } catch {
        // ignore
      }
      json(res, 503, {ok: false, error: status.error || 'ffmpeg 未就绪'})
      return
    }
  }

  const presetId = (optRaw.presetId as PresetId) || undefined
  const format = optRaw.format as OutputFormat | undefined
  const maxEdge =
    typeof optRaw.maxEdge === 'number'
      ? optRaw.maxEdge
      : optRaw.maxEdge != null
        ? Number(optRaw.maxEdge)
        : undefined
  const crf =
    typeof optRaw.crf === 'number'
      ? optRaw.crf
      : optRaw.crf != null
        ? Number(optRaw.crf)
        : undefined
  const targetSizeMb =
    typeof optRaw.targetSizeMb === 'number'
      ? optRaw.targetSizeMb
      : optRaw.targetSizeMb != null
        ? Number(optRaw.targetSizeMb)
        : undefined
  const audioFormat = optRaw.audioFormat as AudioFormat | undefined
  const audioBitrate =
    typeof optRaw.audioBitrate === 'string' ? optRaw.audioBitrate : undefined

  const imageObj =
    optRaw.image && typeof optRaw.image === 'object'
      ? (optRaw.image as Record<string, unknown>)
      : null
  const imagePresetId =
    parseImagePresetId(optRaw.imagePresetId) ||
    parseImagePresetId(optRaw.presetId)
  const imageFormat =
    parseImageFormat(imageObj?.format) ||
    parseImageFormat(optRaw.imageFormat) ||
    parseImageFormat(optRaw.format)
  const imageQualityRaw =
    imageObj?.quality != null
      ? imageObj.quality
      : optRaw.imageQuality != null
        ? optRaw.imageQuality
        : optRaw.quality
  const imageQuality =
    typeof imageQualityRaw === 'number'
      ? imageQualityRaw
      : imageQualityRaw != null
        ? Number(imageQualityRaw)
        : undefined
  const imageMaxEdgeRaw =
    imageObj?.maxEdge != null
      ? imageObj.maxEdge
      : optRaw.imageMaxEdge != null
        ? optRaw.imageMaxEdge
        : mode === 'image'
          ? optRaw.maxEdge
          : undefined
  const imageMaxEdge =
    typeof imageMaxEdgeRaw === 'number'
      ? imageMaxEdgeRaw
      : imageMaxEdgeRaw != null
        ? Number(imageMaxEdgeRaw)
        : undefined
  const imageStripRaw =
    imageObj?.strip != null ? imageObj.strip : optRaw.imageStrip
  const imageStrip =
    typeof imageStripRaw === 'boolean'
      ? imageStripRaw
      : imageStripRaw === 'true' || imageStripRaw === '1'
        ? true
        : imageStripRaw === 'false' || imageStripRaw === '0'
          ? false
          : undefined

  const options = buildLanOptions({
    mode,
    presetId,
    format,
    maxEdge,
    crf,
    targetSizeMb,
    audioFormat,
    audioBitrate,
    imagePresetId,
    imageFormat,
    imageQuality,
    imageMaxEdge,
    imageStrip
  })

  // 固定文件名到上传目录（已是 sanitize 后）
  const finalName = sanitizeFileName(file.fileName)
  const finalPath = path.join(uploadsDir(), `${genTaskId()}-${finalName}`)
  try {
    fs.renameSync(file.tempPath, finalPath)
  } catch {
    try {
      fs.copyFileSync(file.tempPath, finalPath)
      fs.unlinkSync(file.tempPath)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      json(res, 500, {ok: false, error: `保存上传失败: ${msg}`})
      return
    }
  }

  const taskId = genTaskId()
  const task: CompressTask = {
    id: taskId,
    inputPath: finalPath,
    fileName: finalName,
    outputPath: '',
    status: 'queued',
    progress: 0,
    options,
    inputSize: file.size
  }

  lanCtx.lanTasks.set(taskId, {task, fromLan: true})
  taskQueue.enqueueLan(task)

  json(res, 200, {ok: true, task: toLanView(lanCtx.lanTasks.get(taskId)!.task)})
}
