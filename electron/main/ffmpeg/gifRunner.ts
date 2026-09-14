import { type ChildProcess, spawn } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import type { CompressOptions, ProgressPayload } from '../../../shared/types'
import {
  buildGifOptimizeArgs,
  buildImagesToGifArgs,
  buildImagesToGifConcatList,
  buildVideoToGifArgs,
  isGifOptimizeInputPath,
  normalizeGifOptions,
  validateGifOptions
} from '../../../shared/gifLogic'
import {
  effectiveDuration,
  estimateEtaSec,
  formatSec,
  parseProgressLine
} from '../../../shared/ffmpegLogic'
import { mapFfmpegError } from '../../../shared/errorMap'
import { killChildProcess } from '../processKill'
import { getFfmpegPath } from './bin'
import { probeDuration } from './probe'
import { getFileSize } from './paths'
import type { RunCompressResult } from './runner'

export interface RunVideoToGifParams {
  taskId: string
  inputPath: string
  outputPath: string
  options: CompressOptions
  onProgress?: (p: ProgressPayload) => void
  signal?: { cancelled: boolean }
}

function quoteArg(s: string): string {
  if (!s) return '""'
  if (/[\s"]/.test(s)) return `"${s.replace(/"/g, '\\"')}"`
  return s
}

function formatCommandLine(ffmpeg: string, args: string[]): string {
  return [quoteArg(ffmpeg), ...args.map(quoteArg)].join(' ')
}

function removeFile(p: string): void {
  try {
    if (p && fs.existsSync(p)) fs.unlinkSync(p)
  } catch {
    // ignore
  }
}

function removeIncompleteOutput(outputPath: string): void {
  removeFile(outputPath)
}

function spawnFfmpegPass(params: {
  ffmpeg: string
  args: string[]
  taskId: string
  inputPath: string
  outputPath: string
  duration: number
  /** 本遍进度映射到总进度区间 [progressBase, progressBase+progressSpan] */
  progressBase: number
  progressSpan: number
  onProgress?: (p: ProgressPayload) => void
  signal?: { cancelled: boolean }
}): Promise<RunCompressResult> {
  const {
    ffmpeg,
    args,
    taskId,
    inputPath,
    outputPath,
    duration,
    progressBase,
    progressSpan,
    onProgress,
    signal
  } = params
  const commandLine = formatCommandLine(ffmpeg, args)

  return new Promise((resolve) => {
    let proc: ChildProcess
    try {
      proc = spawn(ffmpeg, args, {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      resolve({
        code: 1,
        error: mapFfmpegError(`启动 ffmpeg 失败: ${msg}`, {
          inputPath,
          outputPath
        }),
        commandLine
      })
      return
    }

    let stderrBuf = ''
    let lastPercent = progressBase
    const startedAt = Date.now()
    let progressLines = ''

    const mapPercent = (local: number): number =>
      Math.min(
        progressBase + progressSpan,
        Math.max(progressBase, progressBase + (local / 100) * progressSpan)
      )

    proc.stdout?.on('data', (chunk: Buffer) => {
      if (signal?.cancelled) return
      progressLines += chunk.toString()
      const parts = progressLines.split(/\r?\n/)
      progressLines = parts.pop() || ''

      let outTimeMs = 0
      let speed = ''
      for (const line of parts) {
        if (line.startsWith('out_time_ms=')) {
          outTimeMs = parseInt(line.split('=')[1], 10) || 0
        } else if (line.startsWith('speed=')) {
          speed = line.split('=')[1]?.trim() || ''
        } else if (line.startsWith('progress=end')) {
          onProgress?.({
            taskId,
            percent: Math.round(mapPercent(100) * 10) / 10,
            speed,
            time: formatSec(duration),
            etaSec: 0
          })
        }
      }

      if (outTimeMs > 0 && duration > 0) {
        const currentSec = outTimeMs / 1_000_000
        const local = Math.min(99.9, Math.max(0, (currentSec / duration) * 100))
        const percent = mapPercent(local)
        if (percent - lastPercent >= 0.3 || local >= 99) {
          lastPercent = percent
          const elapsedSec = (Date.now() - startedAt) / 1000
          const etaSec = estimateEtaSec({
            percent: local,
            elapsedSec,
            speed,
            durationSec: duration,
            currentMediaSec: currentSec
          })
          onProgress?.({
            taskId,
            percent: Math.round(percent * 10) / 10,
            time: formatSec(currentSec),
            speed,
            etaSec
          })
        }
      }
    })

    proc.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      stderrBuf += text
      const lines = text.split(/\r?\n/)
      for (const line of lines) {
        const p = parseProgressLine(line, duration)
        if (p && typeof p.percent === 'number') {
          const percent = mapPercent(p.percent)
          if (percent - lastPercent >= 0.5) {
            lastPercent = percent
            const elapsedSec = (Date.now() - startedAt) / 1000
            let currentMediaSec: number | undefined
            if (p.time) {
              const tm = p.time.match(/(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/)
              if (tm) {
                currentMediaSec =
                  parseInt(tm[1], 10) * 3600 +
                  parseInt(tm[2], 10) * 60 +
                  parseFloat(tm[3])
              }
            }
            const etaSec = estimateEtaSec({
              percent: p.percent,
              elapsedSec,
              speed: p.speed,
              durationSec: duration > 0 ? duration : undefined,
              currentMediaSec
            })
            onProgress?.({
              taskId,
              percent: Math.round(percent * 10) / 10,
              time: p.time,
              speed: p.speed,
              fps: p.fps,
              etaSec
            })
          }
        }
      }
    })

    const onCancelCheck = setInterval(() => {
      if (signal?.cancelled) {
        clearInterval(onCancelCheck)
        killChildProcess(proc)
      }
    }, 200)

    proc.on('error', (err) => {
      clearInterval(onCancelCheck)
      resolve({
        code: 1,
        error: mapFfmpegError(err.message || String(err), {
          inputPath,
          outputPath
        }),
        commandLine
      })
    })

    proc.on('close', (code) => {
      clearInterval(onCancelCheck)
      if (signal?.cancelled) {
        removeIncompleteOutput(outputPath)
        resolve({
          code: -1,
          error: '已取消',
          commandLine
        })
        return
      }
      if (code === 0) {
        resolve({ code: 0, commandLine })
        return
      }
      removeIncompleteOutput(outputPath)
      resolve({
        code: code ?? 1,
        error: mapFfmpegError(stderrBuf || `ffmpeg 退出码 ${code}`, {
          inputPath,
          outputPath
        }),
        commandLine
      })
    })
  })
}

/**
 * 视频转 GIF / 动图 WebP
 * - gif：palettegen + paletteuse 两遍
 * - webp：libwebp 单遍（无需调色板临时文件）
 */
export async function runVideoToGif(
  params: RunVideoToGifParams
): Promise<RunCompressResult> {
  const { taskId, inputPath, outputPath, options, onProgress, signal } = params

  const ffmpeg = getFfmpegPath()
  if (!ffmpeg) {
    return {
      code: 1,
      error: '未找到 ffmpeg，请检查安装或自定义 bin 目录'
    }
  }

  if (!fs.existsSync(inputPath)) {
    return {
      code: 1,
      error: mapFfmpegError('输入文件不存在', { inputPath, outputPath })
    }
  }

  const validation = validateGifOptions({ ...options, mode: 'video-to-gif' })
  if (validation) {
    return { code: 1, error: validation }
  }

  const g = normalizeGifOptions(options.gif, options.maxEdge, 'video-to-gif')
  const opts: CompressOptions = {
    ...options,
    mode: 'video-to-gif',
    maxEdge: g.maxEdge,
    gif: {
      outputKind: g.outputKind,
      fps: g.fps,
      frameDelayMs: g.frameDelayMs,
      loop: g.loop,
      colors: g.colors,
      dither: g.dither,
      quality: g.quality
    }
  }

  let sourceDuration = 0
  try {
    sourceDuration = await probeDuration(inputPath)
  } catch {
    sourceDuration = 0
  }
  const duration = effectiveDuration(opts, sourceDuration)

  const palettePath =
    g.outputKind === 'gif'
      ? path.join(os.tmpdir(), `qingying-gif-palette-${taskId}.png`)
      : ''
  if (palettePath) removeFile(palettePath)
  removeIncompleteOutput(outputPath)

  let lastCommandLine: string | undefined
  let inputSize: number | undefined
  try {
    inputSize = getFileSize(inputPath)
  } catch {
    inputSize = undefined
  }

  const finishCancel = (): RunCompressResult => {
    if (palettePath) removeFile(palettePath)
    removeIncompleteOutput(outputPath)
    return { code: -1, error: '已取消', inputSize, commandLine: lastCommandLine }
  }

  if (signal?.cancelled) return finishCancel()

  onProgress?.({
    taskId,
    percent: 0,
    time: '00:00:00',
    speed: ''
  })

  const failLabel =
    g.outputKind === 'webp' ? '视频转动图 WebP 失败' : '视频转 GIF 失败'

  // 动图 WebP：单遍 libwebp
  if (g.outputKind === 'webp') {
    const webpArgs = buildVideoToGifArgs({
      inputPath,
      outputPath,
      palettePath: '',
      options: opts,
      pass: 2
    })
    const webpWithProgress = [
      ...webpArgs.slice(0, -1),
      '-progress',
      'pipe:1',
      '-nostats',
      webpArgs[webpArgs.length - 1]
    ]
    lastCommandLine = formatCommandLine(ffmpeg, webpWithProgress)

    const webpPass = await spawnFfmpegPass({
      ffmpeg,
      args: webpWithProgress,
      taskId,
      inputPath,
      outputPath,
      duration,
      progressBase: 0,
      progressSpan: 100,
      onProgress,
      signal
    })
    lastCommandLine = webpPass.commandLine || lastCommandLine

    if (webpPass.code !== 0) {
      removeIncompleteOutput(outputPath)
      return {
        ...webpPass,
        inputSize,
        error:
          webpPass.code === -1 ? webpPass.error : webpPass.error || failLabel
      }
    }

    let outputSize: number | undefined
    try {
      outputSize = getFileSize(outputPath)
    } catch {
      outputSize = undefined
    }

    onProgress?.({
      taskId,
      percent: 100,
      time: formatSec(duration),
      speed: '',
      etaSec: 0
    })

    return {
      code: 0,
      inputSize,
      outputSize,
      commandLine: lastCommandLine,
      resolvedEncoder: 'libwebp'
    }
  }

  // pass1：生成调色板（约 0–35%）
  const pass1Args = buildVideoToGifArgs({
    inputPath,
    outputPath: palettePath,
    palettePath,
    options: opts,
    pass: 1
  })
  const pass1WithProgress = [
    ...pass1Args.slice(0, -1),
    '-progress',
    'pipe:1',
    '-nostats',
    pass1Args[pass1Args.length - 1]
  ]
  lastCommandLine = formatCommandLine(ffmpeg, pass1WithProgress)

  const pass1 = await spawnFfmpegPass({
    ffmpeg,
    args: pass1WithProgress,
    taskId,
    inputPath,
    outputPath: palettePath,
    duration,
    progressBase: 0,
    progressSpan: 35,
    onProgress,
    signal
  })
  lastCommandLine = pass1.commandLine || lastCommandLine
  if (pass1.code !== 0) {
    removeFile(palettePath)
    return {
      ...pass1,
      inputSize,
      error:
        pass1.code === -1
          ? pass1.error
          : pass1.error || '生成 GIF 调色板失败'
    }
  }
  if (signal?.cancelled) return finishCancel()
  if (!fs.existsSync(palettePath)) {
    return {
      code: 1,
      error: '生成 GIF 调色板失败：未产出调色板文件',
      inputSize,
      commandLine: lastCommandLine
    }
  }

  // pass2：paletteuse 输出 GIF（约 35–100%）
  const pass2Args = buildVideoToGifArgs({
    inputPath,
    outputPath,
    palettePath,
    options: opts,
    pass: 2
  })
  const pass2WithProgress = [
    ...pass2Args.slice(0, -1),
    '-progress',
    'pipe:1',
    '-nostats',
    pass2Args[pass2Args.length - 1]
  ]
  lastCommandLine = formatCommandLine(ffmpeg, pass2WithProgress)

  const pass2 = await spawnFfmpegPass({
    ffmpeg,
    args: pass2WithProgress,
    taskId,
    inputPath,
    outputPath,
    duration,
    progressBase: 35,
    progressSpan: 65,
    onProgress,
    signal
  })
  lastCommandLine = pass2.commandLine || lastCommandLine
  removeFile(palettePath)

  if (pass2.code !== 0) {
    removeIncompleteOutput(outputPath)
    return {
      ...pass2,
      inputSize,
      error: pass2.code === -1 ? pass2.error : pass2.error || failLabel
    }
  }

  let outputSize: number | undefined
  try {
    outputSize = getFileSize(outputPath)
  } catch {
    outputSize = undefined
  }

  onProgress?.({
    taskId,
    percent: 100,
    time: formatSec(duration),
    speed: '',
    etaSec: 0
  })

  return {
    code: 0,
    inputSize,
    outputSize,
    commandLine: lastCommandLine,
    resolvedEncoder: 'gif'
  }
}

export interface RunImagesToGifParams {
  taskId: string
  inputPaths: string[]
  outputPath: string
  options: CompressOptions
  onProgress?: (p: ProgressPayload) => void
  signal?: { cancelled: boolean }
}

/**
 * 多图合成 GIF / 动图 WebP
 * - 写临时 concat 列表（含 duration）
 * - gif：palettegen + paletteuse；webp：libwebp 单遍
 * - 取消时清理列表与调色板
 */
export async function runImagesToGif(
  params: RunImagesToGifParams
): Promise<RunCompressResult> {
  const { taskId, inputPaths, outputPath, options, onProgress, signal } = params

  const ffmpeg = getFfmpegPath()
  if (!ffmpeg) {
    return {
      code: 1,
      error: '未找到 ffmpeg，请检查安装或自定义 bin 目录'
    }
  }

  const paths = (inputPaths || [])
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean)
  if (paths.length < 2) {
    return { code: 1, error: '多图转动图至少需要 2 张图片' }
  }
  for (const p of paths) {
    if (!fs.existsSync(p)) {
      return {
        code: 1,
        error: mapFfmpegError(`输入文件不存在: ${path.basename(p)}`, {
          inputPath: p,
          outputPath
        })
      }
    }
  }

  const validation = validateGifOptions({
    ...options,
    mode: 'images-to-gif'
  })
  if (validation) {
    return { code: 1, error: validation }
  }

  const g = normalizeGifOptions(options.gif, options.maxEdge, 'images-to-gif')
  const opts: CompressOptions = {
    ...options,
    mode: 'images-to-gif',
    maxEdge: g.maxEdge,
    gif: {
      outputKind: g.outputKind,
      fps: g.fps,
      frameDelayMs: g.frameDelayMs,
      loop: g.loop,
      colors: g.colors,
      dither: g.dither,
      quality: g.quality
    }
  }

  const frameCount = paths.length
  const duration = (frameCount * g.frameDelayMs) / 1000
  const primary = paths[0]

  const concatListPath = path.join(
    os.tmpdir(),
    `qingying-images-gif-list-${taskId}.ffconcat`
  )
  const palettePath =
    g.outputKind === 'gif'
      ? path.join(os.tmpdir(), `qingying-images-gif-palette-${taskId}.png`)
      : ''

  const cleanupTemps = (): void => {
    removeFile(concatListPath)
    if (palettePath) removeFile(palettePath)
  }

  removeFile(concatListPath)
  if (palettePath) removeFile(palettePath)
  removeIncompleteOutput(outputPath)

  let lastCommandLine: string | undefined
  let inputSize: number | undefined
  try {
    let total = 0
    let any = false
    for (const p of paths) {
      try {
        const s = getFileSize(p)
        if (typeof s === 'number') {
          total += s
          any = true
        }
      } catch {
        // ignore
      }
    }
    inputSize = any ? total : undefined
  } catch {
    inputSize = undefined
  }

  const finishCancel = (): RunCompressResult => {
    cleanupTemps()
    removeIncompleteOutput(outputPath)
    return { code: -1, error: '已取消', inputSize, commandLine: lastCommandLine }
  }

  if (signal?.cancelled) return finishCancel()

  try {
    const listBody = buildImagesToGifConcatList(
      paths,
      g.frameDelayMs / 1000
    )
    fs.writeFileSync(concatListPath, listBody, 'utf8')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    cleanupTemps()
    return {
      code: 1,
      error: `无法写入多图序列列表: ${msg}`,
      inputSize
    }
  }

  onProgress?.({
    taskId,
    percent: 0,
    time: '00:00:00',
    speed: ''
  })

  const failLabel =
    g.outputKind === 'webp' ? '多图转动图 WebP 失败' : '多图转 GIF 失败'

  if (g.outputKind === 'webp') {
    const webpArgs = buildImagesToGifArgs({
      concatListPath,
      outputPath,
      palettePath: '',
      options: opts,
      pass: 2
    })
    const webpWithProgress = [
      ...webpArgs.slice(0, -1),
      '-progress',
      'pipe:1',
      '-nostats',
      webpArgs[webpArgs.length - 1]
    ]
    lastCommandLine = formatCommandLine(ffmpeg, webpWithProgress)

    const webpPass = await spawnFfmpegPass({
      ffmpeg,
      args: webpWithProgress,
      taskId,
      inputPath: primary,
      outputPath,
      duration,
      progressBase: 0,
      progressSpan: 100,
      onProgress,
      signal
    })
    lastCommandLine = webpPass.commandLine || lastCommandLine
    cleanupTemps()

    if (webpPass.code !== 0) {
      removeIncompleteOutput(outputPath)
      return {
        ...webpPass,
        inputSize,
        error:
          webpPass.code === -1 ? webpPass.error : webpPass.error || failLabel
      }
    }

    let outputSize: number | undefined
    try {
      outputSize = getFileSize(outputPath)
    } catch {
      outputSize = undefined
    }

    onProgress?.({
      taskId,
      percent: 100,
      time: formatSec(duration),
      speed: '',
      etaSec: 0
    })

    return {
      code: 0,
      inputSize,
      outputSize,
      commandLine: lastCommandLine,
      resolvedEncoder: 'libwebp'
    }
  }

  const pass1Args = buildImagesToGifArgs({
    concatListPath,
    outputPath: palettePath,
    palettePath,
    options: opts,
    pass: 1
  })
  const pass1WithProgress = [
    ...pass1Args.slice(0, -1),
    '-progress',
    'pipe:1',
    '-nostats',
    pass1Args[pass1Args.length - 1]
  ]
  lastCommandLine = formatCommandLine(ffmpeg, pass1WithProgress)

  const pass1 = await spawnFfmpegPass({
    ffmpeg,
    args: pass1WithProgress,
    taskId,
    inputPath: primary,
    outputPath: palettePath,
    duration,
    progressBase: 0,
    progressSpan: 35,
    onProgress,
    signal
  })
  lastCommandLine = pass1.commandLine || lastCommandLine
  if (pass1.code !== 0) {
    cleanupTemps()
    return {
      ...pass1,
      inputSize,
      error:
        pass1.code === -1
          ? pass1.error
          : pass1.error || '生成 GIF 调色板失败'
    }
  }
  if (signal?.cancelled) return finishCancel()
  if (!fs.existsSync(palettePath)) {
    cleanupTemps()
    return {
      code: 1,
      error: '生成 GIF 调色板失败：未产出调色板文件',
      inputSize,
      commandLine: lastCommandLine
    }
  }

  const pass2Args = buildImagesToGifArgs({
    concatListPath,
    outputPath,
    palettePath,
    options: opts,
    pass: 2
  })
  const pass2WithProgress = [
    ...pass2Args.slice(0, -1),
    '-progress',
    'pipe:1',
    '-nostats',
    pass2Args[pass2Args.length - 1]
  ]
  lastCommandLine = formatCommandLine(ffmpeg, pass2WithProgress)

  const pass2 = await spawnFfmpegPass({
    ffmpeg,
    args: pass2WithProgress,
    taskId,
    inputPath: primary,
    outputPath,
    duration,
    progressBase: 35,
    progressSpan: 65,
    onProgress,
    signal
  })
  lastCommandLine = pass2.commandLine || lastCommandLine
  cleanupTemps()

  if (pass2.code !== 0) {
    removeIncompleteOutput(outputPath)
    return {
      ...pass2,
      inputSize,
      error: pass2.code === -1 ? pass2.error : pass2.error || failLabel
    }
  }

  let outputSize: number | undefined
  try {
    outputSize = getFileSize(outputPath)
  } catch {
    outputSize = undefined
  }

  onProgress?.({
    taskId,
    percent: 100,
    time: formatSec(duration),
    speed: '',
    etaSec: 0
  })

  return {
    code: 0,
    inputSize,
    outputSize,
    commandLine: lastCommandLine,
    resolvedEncoder: 'gif'
  }
}

export interface RunGifOptimizeParams {
  taskId: string
  inputPath: string
  outputPath: string
  options: CompressOptions
  onProgress?: (p: ProgressPayload) => void
  signal?: { cancelled: boolean }
}

/**
 * 已有 GIF / 动图 WebP 优化重编码
 * - gif：palettegen + paletteuse 两遍
 * - webp：libwebp 单遍
 * 取消时清理调色板与未完成输出
 */
export async function runGifOptimize(
  params: RunGifOptimizeParams
): Promise<RunCompressResult> {
  const { taskId, inputPath, outputPath, options, onProgress, signal } = params

  const ffmpeg = getFfmpegPath()
  if (!ffmpeg) {
    return {
      code: 1,
      error: '未找到 ffmpeg，请检查安装或自定义 bin 目录'
    }
  }

  if (!fs.existsSync(inputPath)) {
    return {
      code: 1,
      error: mapFfmpegError('输入文件不存在', { inputPath, outputPath })
    }
  }

  if (!isGifOptimizeInputPath(inputPath)) {
    return {
      code: 1,
      error: '动图优化仅支持 .gif 或动图 .webp 输入'
    }
  }

  const validation = validateGifOptions({ ...options, mode: 'gif-optimize' })
  if (validation) {
    return { code: 1, error: validation }
  }

  const g = normalizeGifOptions(options.gif, options.maxEdge, 'gif-optimize')
  const opts: CompressOptions = {
    ...options,
    mode: 'gif-optimize',
    maxEdge: g.maxEdge,
    gif: {
      outputKind: g.outputKind,
      fps: g.fps,
      frameDelayMs: g.frameDelayMs,
      loop: g.loop,
      colors: g.colors,
      dither: g.dither,
      quality: g.quality
    }
  }

  let sourceDuration = 0
  try {
    sourceDuration = await probeDuration(inputPath)
  } catch {
    sourceDuration = 0
  }
  const duration = sourceDuration > 0 ? sourceDuration : 0

  const palettePath =
    g.outputKind === 'gif'
      ? path.join(os.tmpdir(), `qingying-gif-opt-palette-${taskId}.png`)
      : ''
  if (palettePath) removeFile(palettePath)
  removeIncompleteOutput(outputPath)

  let lastCommandLine: string | undefined
  let inputSize: number | undefined
  try {
    inputSize = getFileSize(inputPath)
  } catch {
    inputSize = undefined
  }

  const finishCancel = (): RunCompressResult => {
    if (palettePath) removeFile(palettePath)
    removeIncompleteOutput(outputPath)
    return { code: -1, error: '已取消', inputSize, commandLine: lastCommandLine }
  }

  if (signal?.cancelled) return finishCancel()

  onProgress?.({
    taskId,
    percent: 0,
    time: '00:00:00',
    speed: ''
  })

  const failLabel =
    g.outputKind === 'webp' ? '动图优化（WebP）失败' : '动图优化（GIF）失败'

  if (g.outputKind === 'webp') {
    const webpArgs = buildGifOptimizeArgs({
      inputPath,
      outputPath,
      palettePath: '',
      options: opts,
      pass: 2
    })
    const webpWithProgress = [
      ...webpArgs.slice(0, -1),
      '-progress',
      'pipe:1',
      '-nostats',
      webpArgs[webpArgs.length - 1]
    ]
    lastCommandLine = formatCommandLine(ffmpeg, webpWithProgress)

    const webpPass = await spawnFfmpegPass({
      ffmpeg,
      args: webpWithProgress,
      taskId,
      inputPath,
      outputPath,
      duration,
      progressBase: 0,
      progressSpan: 100,
      onProgress,
      signal
    })
    lastCommandLine = webpPass.commandLine || lastCommandLine

    if (webpPass.code !== 0) {
      removeIncompleteOutput(outputPath)
      return {
        ...webpPass,
        inputSize,
        error:
          webpPass.code === -1 ? webpPass.error : webpPass.error || failLabel
      }
    }

    let outputSize: number | undefined
    try {
      outputSize = getFileSize(outputPath)
    } catch {
      outputSize = undefined
    }

    onProgress?.({
      taskId,
      percent: 100,
      time: formatSec(duration),
      speed: '',
      etaSec: 0
    })

    return {
      code: 0,
      inputSize,
      outputSize,
      commandLine: lastCommandLine,
      resolvedEncoder: 'libwebp'
    }
  }

  const pass1Args = buildGifOptimizeArgs({
    inputPath,
    outputPath: palettePath,
    palettePath,
    options: opts,
    pass: 1
  })
  const pass1WithProgress = [
    ...pass1Args.slice(0, -1),
    '-progress',
    'pipe:1',
    '-nostats',
    pass1Args[pass1Args.length - 1]
  ]
  lastCommandLine = formatCommandLine(ffmpeg, pass1WithProgress)

  const pass1 = await spawnFfmpegPass({
    ffmpeg,
    args: pass1WithProgress,
    taskId,
    inputPath,
    outputPath: palettePath,
    duration,
    progressBase: 0,
    progressSpan: 35,
    onProgress,
    signal
  })
  lastCommandLine = pass1.commandLine || lastCommandLine
  if (pass1.code !== 0) {
    removeFile(palettePath)
    return {
      ...pass1,
      inputSize,
      error:
        pass1.code === -1
          ? pass1.error
          : pass1.error || '生成 GIF 调色板失败'
    }
  }
  if (signal?.cancelled) return finishCancel()
  if (!fs.existsSync(palettePath)) {
    return {
      code: 1,
      error: '生成 GIF 调色板失败：未产出调色板文件',
      inputSize,
      commandLine: lastCommandLine
    }
  }

  const pass2Args = buildGifOptimizeArgs({
    inputPath,
    outputPath,
    palettePath,
    options: opts,
    pass: 2
  })
  const pass2WithProgress = [
    ...pass2Args.slice(0, -1),
    '-progress',
    'pipe:1',
    '-nostats',
    pass2Args[pass2Args.length - 1]
  ]
  lastCommandLine = formatCommandLine(ffmpeg, pass2WithProgress)

  const pass2Opt = await spawnFfmpegPass({
    ffmpeg,
    args: pass2WithProgress,
    taskId,
    inputPath,
    outputPath,
    duration,
    progressBase: 35,
    progressSpan: 65,
    onProgress,
    signal
  })
  lastCommandLine = pass2Opt.commandLine || lastCommandLine
  removeFile(palettePath)

  if (pass2Opt.code !== 0) {
    removeIncompleteOutput(outputPath)
    return {
      ...pass2Opt,
      inputSize,
      error:
        pass2Opt.code === -1 ? pass2Opt.error : pass2Opt.error || failLabel
    }
  }

  let outputSize: number | undefined
  try {
    outputSize = getFileSize(outputPath)
  } catch {
    outputSize = undefined
  }

  onProgress?.({
    taskId,
    percent: 100,
    time: formatSec(duration),
    speed: '',
    etaSec: 0
  })

  return {
    code: 0,
    inputSize,
    outputSize,
    commandLine: lastCommandLine,
    resolvedEncoder: 'gif'
  }
}
