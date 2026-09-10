import { basename } from 'path'
import type { ImageProcessOptions } from '../../../shared/types'
import { IpcChannels } from '../../../shared/types'
import {
  checkFfmpegAvailable,
  detectHardwareEncoders,
  extractVideoFrame
} from '../ffmpeg'
import {
  getImageDataUrl,
  getImageEngineStatus,
  getImageInfo,
  processImage
} from '../image'
import {
  ensureOutputPathAllowed,
  isPathAllowed,
  pathNotAllowedError
} from '../pathAllowlist'
import { handleFromMainWindow } from '../ipcGuard'

/** ffmpeg / 图片引擎探测与处理相关 IPC */
export function registerMediaIpc(): void {
  handleFromMainWindow(IpcChannels.GET_FFMPEG_STATUS, async () => {
    return checkFfmpegAvailable()
  })

  handleFromMainWindow(IpcChannels.DETECT_ENCODERS, async () => {
    try {
      return await detectHardwareEncoders(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return {
        nvenc: false,
        qsv: false,
        amf: false,
        videotoolbox: false,
        preferred: 'libx264' as const,
        error: msg
      }
    }
  })

  handleFromMainWindow(IpcChannels.IMAGE_STATUS, async () => {
    return getImageEngineStatus()
  })

  handleFromMainWindow(
    IpcChannels.IMAGE_PROCESS,
    async (_e, options: ImageProcessOptions) => {
      const opts = options || ({} as ImageProcessOptions)
      const inputPath =
        typeof opts.inputPath === 'string' ? opts.inputPath.trim() : ''
      const outputPath =
        typeof opts.outputPath === 'string' ? opts.outputPath.trim() : ''
      const stitchInputs = (opts.inputs || [])
        .map((p) => (typeof p === 'string' ? p.trim() : ''))
        .filter(Boolean)

      if (inputPath && !isPathAllowed(inputPath)) {
        return { ok: false, error: pathNotAllowedError('输入路径') }
      }
      for (const p of stitchInputs) {
        if (!isPathAllowed(p)) {
          return { ok: false, error: pathNotAllowedError(`输入路径 ${basename(p)}`) }
        }
      }
      if (outputPath) {
        const inputs = [
          ...(inputPath ? [inputPath] : []),
          ...stitchInputs
        ]
        // outputDir 已 allowDir → 直接 OK；否则仅允许与已允许输入同父目录的精确旁路输出
        if (!ensureOutputPathAllowed(outputPath, inputs)) {
          return { ok: false, error: pathNotAllowedError('输出路径') }
        }
      }
      return processImage(opts)
    }
  )

  handleFromMainWindow(IpcChannels.IMAGE_GET_INFO, async (_e, filePath: string) => {
    const p = typeof filePath === 'string' ? filePath : ''
    if (p && !isPathAllowed(p)) {
      return { ok: false, error: pathNotAllowedError('输入路径') }
    }
    return getImageInfo(p)
  })

  handleFromMainWindow(
    IpcChannels.IMAGE_GET_DATA_URL,
    async (_e, filePath: string, maxEdge?: number) => {
      const p = typeof filePath === 'string' ? filePath : ''
      if (p && !isPathAllowed(p)) {
        return { ok: false, error: pathNotAllowedError('输入路径') }
      }
      return getImageDataUrl(
        p,
        typeof maxEdge === 'number' ? maxEdge : undefined
      )
    }
  )

  handleFromMainWindow(
    IpcChannels.VIDEO_EXTRACT_FRAME,
    async (
      _e,
      opts: { path?: string; timeSec?: number; maxEdge?: number }
    ) => {
      const p = typeof opts?.path === 'string' ? opts.path : ''
      if (p && !isPathAllowed(p)) {
        return { ok: false, error: pathNotAllowedError('输入路径') }
      }
      return extractVideoFrame({
        path: p,
        timeSec:
          typeof opts?.timeSec === 'number' ? opts.timeSec : undefined,
        maxEdge:
          typeof opts?.maxEdge === 'number' ? opts.maxEdge : undefined
      })
    }
  )
}
