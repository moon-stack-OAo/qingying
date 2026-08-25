import { type ChildProcess, spawn } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import type {
  CompressOptions,
  MosaicRegion,
  ProgressPayload
} from '../../../shared/types'
import {
  estimateEtaSec,
  formatSec,
  isMosaicRegionActiveAt,
  normalizeMosaicRegions,
  parseProgressLine
} from '../../../shared/ffmpegLogic'
import { mapFfmpegError } from '../../../shared/errorMap'
import { getFfmpegPath, getFfprobePath } from './bin'
import { checkSharpReady } from '../image/bin'
import {
  probeDuration,
  probeHasAudioStream,
  probeVideoSize
} from './probe'
import { getFileSizeAsync, pathExistsAsync } from './paths'
import type { RunCompressResult } from './runner'

export interface RunMosaicFrameByFrameParams {
  taskId: string
  inputPath: string
  outputPath: string
  options: CompressOptions
  onProgress: (payload: ProgressPayload) => void
  signal?: { cancelled: boolean }
}

type SharpFn = {
  (input?: string | Buffer, options?: unknown): SharpInstance
}

interface SharpInstance {
  rotate: (angle?: number) => SharpInstance
  extract: (region: {
    left: number
    top: number
    width: number
    height: number
  }) => SharpInstance
  resize: (options: {
    width?: number
    height?: number
    fit?: string
    kernel?: string
  }) => SharpInstance
  blur: (sigma?: number) => SharpInstance
  composite: (
    images: Array<{
      input: Buffer
      left?: number
      top?: number
    }>
  ) => SharpInstance
  jpeg: (options?: { quality?: number; mozjpeg?: boolean }) => SharpInstance
  metadata: () => Promise<{ width?: number; height?: number }>
  toBuffer: () => Promise<Buffer>
  toFile: (filePath: string) => Promise<unknown>
}

function loadSharp(): SharpFn {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod: unknown = require('sharp')
  if (typeof mod === 'function') return mod as SharpFn
  if (
    mod &&
    typeof mod === 'object' &&
    typeof (mod as { default?: unknown }).default === 'function'
  ) {
    return (mod as { default: SharpFn }).default
  }
  throw new Error('sharp 模块格式异常')
}

function removeDirRecursive(dir: string): void {
  try {
    if (!fs.existsSync(dir)) return
    fs.rmSync(dir, { recursive: true, force: true })
  } catch {
    // ignore
  }
}

function removeFile(p: string): void {
  try {
    if (fs.existsSync(p)) fs.unlinkSync(p)
  } catch {
    // ignore
  }
}

function killProcess(proc: ChildProcess): void {
  try {
    proc.kill('SIGTERM')
    if (process.platform === 'win32' && proc.pid) {
      spawn('taskkill', ['/pid', String(proc.pid), '/f', '/t'], {
        windowsHide: true,
        stdio: 'ignore'
      })
    }
  } catch {
    // ignore
  }
}

function quoteArg(s: string): string {
  if (!/[\s"]/.test(s)) return s
  return `"${s.replace(/"/g, '\\"')}"`
}

function formatCommandLine(ffmpeg: string, args: string[]): string {
  return [quoteArg(ffmpeg), ...args.map(quoteArg)].join(' ')
}

function clampJpegQuality(raw: unknown): number {
  const n = typeof raw === 'number' && Number.isFinite(raw) ? Math.round(raw) : 92
  return Math.max(1, Math.min(100, n))
}

function parseFps(rate: string | undefined): number {
  if (!rate) return 0
  const m = String(rate).match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/)
  if (m) {
    const a = parseFloat(m[1])
    const b = parseFloat(m[2])
    if (b > 0 && Number.isFinite(a)) return a / b
  }
  const n = parseFloat(String(rate))
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** 探测帧率；失败返回 25 */
function probeFps(inputPath: string): Promise<number> {
  const ffprobe = getFfprobePath()
  if (!ffprobe) return Promise.resolve(25)

  return new Promise((resolve) => {
    const proc = spawn(
      ffprobe,
      [
        '-v',
        'error',
        '-select_streams',
        'v:0',
        '-show_entries',
        'stream=avg_frame_rate,r_frame_rate',
        '-of',
        'json',
        inputPath
      ],
      { windowsHide: true }
    )
    let out = ''
    proc.stdout?.on('data', (d: Buffer) => {
      out += d.toString()
    })
    proc.on('error', () => resolve(25))
    proc.on('close', () => {
      try {
        const parsed = JSON.parse(out) as {
          streams?: Array<{
            avg_frame_rate?: string
            r_frame_rate?: string
          }>
        }
        const s = parsed.streams?.[0]
        const fps =
          parseFps(s?.avg_frame_rate) || parseFps(s?.r_frame_rate) || 25
        resolve(Math.max(1, Math.min(120, Math.round(fps * 1000) / 1000)))
      } catch {
        resolve(25)
      }
    })
  })
}

/**
 * 批量抽帧到目录（JPEG），进度映射到 rangeStart–rangeEnd
 */
function extractAllFrames(params: {
  ffmpeg: string
  inputPath: string
  framesDir: string
  fps: number
  jpegQuality: number
  duration: number
  taskId: string
  onProgress?: (p: ProgressPayload) => void
  signal?: { cancelled: boolean }
  rangeStart: number
  rangeEnd: number
}): Promise<{ ok: boolean; error?: string; commandLine: string }> {
  const {
    ffmpeg,
    inputPath,
    framesDir,
    fps,
    jpegQuality,
    duration,
    taskId,
    onProgress,
    signal,
    rangeStart,
    rangeEnd
  } = params

  // Windows 路径下 % 需转义；统一用正斜杠避免 image2 解析问题
  const pattern = path.join(framesDir, 'frame_%08d.jpg').replace(/\\/g, '/')
  const qscale = Math.max(
    2,
    Math.min(31, Math.round((100 - jpegQuality) * 0.28 + 2))
  )
  const args = [
    '-hide_banner',
    '-y',
    '-i',
    inputPath,
    // 固定帧率抽帧，与封装阶段 framerate 对齐，避免时长漂移
    '-vf',
    `fps=${fps}`,
    '-q:v',
    String(qscale),
    pattern
  ]
  const commandLine = formatCommandLine(ffmpeg, args)

  return new Promise((resolve) => {
    if (signal?.cancelled) {
      resolve({ ok: false, error: '已取消', commandLine })
      return
    }

    const proc = spawn(ffmpeg, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let stderrBuf = ''
    let lastPercent = -1
    const startedAt = Date.now()
    const span = Math.max(0, rangeEnd - rangeStart)

    const mapPct = (local: number): number =>
      Math.round((rangeStart + (local / 100) * span) * 10) / 10

    proc.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      stderrBuf += text
      const lines = text.split(/\r?\n/)
      for (const line of lines) {
        const p = parseProgressLine(line, duration)
        if (p && typeof p.percent === 'number') {
          if (p.percent - lastPercent >= 0.5) {
            lastPercent = p.percent
            const elapsedSec = (Date.now() - startedAt) / 1000
            const etaSec = estimateEtaSec({
              percent: p.percent,
              elapsedSec,
              speed: p.speed,
              durationSec: duration > 0 ? duration : undefined
            })
            onProgress?.({
              taskId,
              percent: mapPct(p.percent),
              time: p.time,
              speed: p.speed,
              etaSec
            })
          }
        }
      }
    })

    const cancelChecker = setInterval(() => {
      if (signal?.cancelled && proc && !proc.killed) {
        killProcess(proc)
      }
    }, 300)

    proc.on('error', (err) => {
      clearInterval(cancelChecker)
      resolve({
        ok: false,
        error: mapFfmpegError(err.message, {
          resolvedEncoder: 'libx264',
          inputPath,
          outputPath: framesDir
        }),
        commandLine
      })
    })

    proc.on('close', (code) => {
      clearInterval(cancelChecker)
      if (signal?.cancelled) {
        resolve({ ok: false, error: '已取消', commandLine })
        return
      }
      if (code !== 0) {
        resolve({
          ok: false,
          error: mapFfmpegError(stderrBuf || `抽帧失败 (code ${code})`, {
            resolvedEncoder: 'libx264',
            inputPath,
            outputPath: framesDir
          }),
          commandLine
        })
        return
      }
      resolve({ ok: true, commandLine })
    })
  })
}

/** 对单帧 Buffer 应用命中时间的打码区域 */
async function applyMosaicsToFrame(
  sharp: SharpFn,
  framePath: string,
  regions: MosaicRegion[],
  timeSec: number,
  jpegQuality: number,
  outPath: string
): Promise<void> {
  const active = regions.filter((r) => isMosaicRegionActiveAt(r, timeSec))
  if (active.length === 0) {
    // 无命中：硬链/复制到输出名（保持序号连续）
    await fs.promises.copyFile(framePath, outPath)
    return
  }

  const img = sharp(framePath).rotate()
  const meta = await img.metadata()
  const fw = meta.width || 0
  const fh = meta.height || 0
  if (!(fw > 0 && fh > 0)) {
    await fs.promises.copyFile(framePath, outPath)
    return
  }

  const overlays: Array<{ input: Buffer; left: number; top: number }> = []
  for (const region of active) {
    let left = Math.max(0, Math.min(fw - 1, Math.round(region.x)))
    let top = Math.max(0, Math.min(fh - 1, Math.round(region.y)))
    let width = Math.max(2, Math.round(region.w))
    let height = Math.max(2, Math.round(region.h))
    if (left + width > fw) width = Math.max(2, fw - left)
    if (top + height > fh) height = Math.max(2, fh - top)
    if (width < 2 || height < 2) continue

    let roi = sharp(framePath).rotate().extract({ left, top, width, height })
    if (region.mode === 'blur') {
      const sigma = Math.max(0.3, Math.min(1000, region.strength))
      roi = roi.blur(sigma)
    } else {
      const block = Math.max(2, region.strength)
      const sw = Math.max(1, Math.ceil(width / block))
      const sh = Math.max(1, Math.ceil(height / block))
      roi = roi
        .resize({ width: sw, height: sh, kernel: 'nearest' })
        .resize({ width, height, kernel: 'nearest' })
    }
    const buf = await roi.toBuffer()
    overlays.push({ input: buf, left, top })
  }

  let pipeline = sharp(framePath).rotate()
  if (overlays.length > 0) {
    pipeline = pipeline.composite(overlays)
  }
  await pipeline.jpeg({ quality: jpegQuality, mozjpeg: true }).toFile(outPath)
}

function listFrameFiles(framesDir: string): string[] {
  const names = fs.readdirSync(framesDir).filter((n) => /^frame_\d+\.jpg$/i.test(n))
  names.sort()
  return names.map((n) => path.join(framesDir, n))
}

/**
 * 图序列 + 原音轨封装为 MP4
 */
function encodeFromFrames(params: {
  ffmpeg: string
  framesDir: string
  inputPath: string
  outputPath: string
  fps: number
  hasAudio: boolean
  muteAudio: boolean
  crf: number
  duration: number
  taskId: string
  onProgress?: (p: ProgressPayload) => void
  signal?: { cancelled: boolean }
  rangeStart: number
  rangeEnd: number
}): Promise<RunCompressResult> {
  const {
    ffmpeg,
    framesDir,
    inputPath,
    outputPath,
    fps,
    hasAudio,
    muteAudio,
    crf,
    duration,
    taskId,
    onProgress,
    signal,
    rangeStart,
    rangeEnd
  } = params

  const pattern = path.join(framesDir, 'out_%08d.jpg').replace(/\\/g, '/')
  const args = [
    '-hide_banner',
    '-y',
    '-framerate',
    String(fps),
    '-i',
    pattern,
    '-i',
    inputPath,
    '-map',
    '0:v:0',
    ...(hasAudio && !muteAudio
      ? ['-map', '1:a?', '-c:a', 'aac', '-b:a', '192k']
      : ['-an']),
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    String(Math.max(0, Math.min(51, Math.round(crf)))),
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    '-shortest',
    outputPath
  ]
  const commandLine = formatCommandLine(ffmpeg, args)

  return new Promise((resolve) => {
    if (signal?.cancelled) {
      resolve({ code: -1, error: '已取消', commandLine })
      return
    }

    const proc = spawn(ffmpeg, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let stderrBuf = ''
    let lastPercent = -1
    const startedAt = Date.now()
    const span = Math.max(0, rangeEnd - rangeStart)
    const mapPct = (local: number): number =>
      Math.round((rangeStart + (local / 100) * span) * 10) / 10

    proc.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      stderrBuf += text
      for (const line of text.split(/\r?\n/)) {
        const p = parseProgressLine(line, duration)
        if (p && typeof p.percent === 'number' && p.percent - lastPercent >= 0.5) {
          lastPercent = p.percent
          const elapsedSec = (Date.now() - startedAt) / 1000
          const etaSec = estimateEtaSec({
            percent: p.percent,
            elapsedSec,
            speed: p.speed,
            durationSec: duration > 0 ? duration : undefined
          })
          onProgress?.({
            taskId,
            percent: mapPct(p.percent),
            time: p.time,
            speed: p.speed,
            etaSec
          })
        }
      }
    })

    const cancelChecker = setInterval(() => {
      if (signal?.cancelled && proc && !proc.killed) {
        killProcess(proc)
      }
    }, 300)

    proc.on('error', (err) => {
      clearInterval(cancelChecker)
      resolve({
        code: 1,
        error: mapFfmpegError(err.message, {
          resolvedEncoder: 'libx264',
          inputPath,
          outputPath
        }),
        process: proc,
        resolvedEncoder: 'libx264',
        commandLine
      })
    })

    proc.on('close', async (code) => {
      clearInterval(cancelChecker)
      if (signal?.cancelled) {
        removeFile(outputPath)
        resolve({ code: -1, error: '已取消', commandLine, resolvedEncoder: 'libx264' })
        return
      }
      if (code !== 0) {
        removeFile(outputPath)
        resolve({
          code: code ?? 1,
          error: mapFfmpegError(stderrBuf || `封装失败 (code ${code})`, {
            resolvedEncoder: 'libx264',
            inputPath,
            outputPath
          }),
          resolvedEncoder: 'libx264',
          commandLine
        })
        return
      }
      void getFileSizeAsync(outputPath).then((outputSize) => {
        resolve({
          code: 0,
          resolvedEncoder: 'libx264',
          outputSize,
          commandLine
        })
      })
    })
  })
}

/**
 * 逐帧打码流水线：
 * 1) 抽全帧 JPEG（0–40%）
 * 2) Sharp 按区域打码（40–75%）
 * 3) 封装 + 原音轨（75–100%）
 */
export async function runMosaicFrameByFrame(
  params: RunMosaicFrameByFrameParams
): Promise<RunCompressResult> {
  const { taskId, inputPath, outputPath, options, onProgress, signal } = params
  const regions = normalizeMosaicRegions(options.mosaics)
  if (regions.length < 1) {
    return { code: 1, error: '请先编辑并设置至少一个打码区域' }
  }

  const ffmpeg = getFfmpegPath()
  if (!ffmpeg) {
    return { code: 1, error: 'ffmpeg 不可用' }
  }
  if (!checkSharpReady()) {
    return { code: 1, error: 'Sharp 不可用（逐帧打码需要 Sharp）' }
  }

  const exists = await pathExistsAsync(inputPath)
  if (!exists) {
    return { code: 1, error: '源文件不存在或无法访问（网络盘超时）' }
  }

  const jpegQuality = clampJpegQuality(options.mosaicPipeline?.jpegQuality)
  const inputSize = await getFileSizeAsync(inputPath)
  const meta = await probeVideoSize(inputPath)
  const duration =
    meta && meta.duration > 0
      ? meta.duration
      : await probeDuration(inputPath, signal)
  const fps = await probeFps(inputPath)
  const hasAudio = await probeHasAudioStream(inputPath)
  const muteAudio = Boolean(options.muteAudio)
  const crf =
    typeof options.crf === 'number' && Number.isFinite(options.crf)
      ? options.crf
      : 18

  if (signal?.cancelled) {
    return { code: -1, error: '已取消', inputSize }
  }

  const tmpRoot = path.join(os.tmpdir(), `ffmpeg-mosaic-fbf-${taskId}`)
  const framesDir = path.join(tmpRoot, 'frames')
  removeDirRecursive(tmpRoot)
  fs.mkdirSync(framesDir, { recursive: true })

  let commandLine = ''
  try {
    onProgress({ taskId, percent: 0, time: formatSec(0) })

    const extract = await extractAllFrames({
      ffmpeg,
      inputPath,
      framesDir,
      fps,
      jpegQuality,
      duration,
      taskId,
      onProgress,
      signal,
      rangeStart: 0,
      rangeEnd: 40
    })
    commandLine = extract.commandLine
    if (!extract.ok) {
      return {
        code: extract.error === '已取消' ? -1 : 1,
        error: extract.error || '抽帧失败',
        inputSize,
        commandLine
      }
    }

    if (signal?.cancelled) {
      return { code: -1, error: '已取消', inputSize, commandLine }
    }

    const frameFiles = listFrameFiles(framesDir)
    if (frameFiles.length < 1) {
      return { code: 1, error: '抽帧结果为空', inputSize, commandLine }
    }

    const sharp = loadSharp()
    const total = frameFiles.length
    const startedAt = Date.now()
    for (let i = 0; i < total; i++) {
      if (signal?.cancelled) {
        return { code: -1, error: '已取消', inputSize, commandLine }
      }
      const src = frameFiles[i]
      const outName = `out_${String(i + 1).padStart(8, '0')}.jpg`
      const outPath = path.join(framesDir, outName)
      const timeSec = fps > 0 ? i / fps : 0
      await applyMosaicsToFrame(
        sharp,
        src,
        regions,
        timeSec,
        jpegQuality,
        outPath
      )
      // 释放原帧磁盘
      removeFile(src)

      if (i === 0 || i === total - 1 || i % 5 === 0) {
        const local = ((i + 1) / total) * 100
        const percent = Math.round((40 + (local / 100) * 35) * 10) / 10
        const elapsedSec = (Date.now() - startedAt) / 1000
        const etaSec = estimateEtaSec({
          percent: local,
          elapsedSec,
          durationSec: undefined
        })
        onProgress({
          taskId,
          percent,
          time: formatSec(timeSec),
          etaSec
        })
      }
    }

    if (signal?.cancelled) {
      return { code: -1, error: '已取消', inputSize, commandLine }
    }

    removeFile(outputPath)
    const enc = await encodeFromFrames({
      ffmpeg,
      framesDir,
      inputPath,
      outputPath,
      fps,
      hasAudio,
      muteAudio,
      crf,
      duration,
      taskId,
      onProgress,
      signal,
      rangeStart: 75,
      rangeEnd: 100
    })
    commandLine = enc.commandLine || commandLine

    if (enc.code !== 0) {
      return { ...enc, inputSize, commandLine }
    }

    onProgress({ taskId, percent: 100, time: formatSec(duration) })
    return {
      code: 0,
      resolvedEncoder: 'libx264',
      inputSize,
      outputSize: enc.outputSize,
      commandLine
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    removeFile(outputPath)
    return {
      code: 1,
      error: msg || '逐帧打码失败',
      inputSize,
      commandLine
    }
  } finally {
    removeDirRecursive(tmpRoot)
  }
}
