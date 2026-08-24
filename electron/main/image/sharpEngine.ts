import fs from 'fs'
import path from 'path'
import type { ImageProcessOptions, ImageProcessResult } from '../../../shared/types'
import {
  normalizeCrop,
  normalizeImageQuality,
  normalizeMaxEdge,
  planImageStitch
} from '../../../shared/imageLogic'
import { checkSharpReady } from './bin'
import {
  ImageCancelledError,
  awaitWithCancel,
  isCancelled,
  isImageCancelledError,
  removeIncompleteOutput,
  type TaskCancelSignal
} from './cancel'

type SharpFn = {
  (input?: string | Buffer, options?: unknown): SharpInstance
  (
    options: {
      create: {
        width: number
        height: number
        channels: 3 | 4
        background: string | { r: number; g: number; b: number; alpha?: number }
      }
    }
  ): SharpInstance
}

interface SharpMetadata {
  width?: number
  height?: number
  channels?: number
  hasAlpha?: boolean
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
    withoutEnlargement?: boolean
  }) => SharpInstance
  withMetadata: (options?: unknown) => SharpInstance
  jpeg: (options?: { quality?: number; mozjpeg?: boolean }) => SharpInstance
  png: (options?: { compressionLevel?: number }) => SharpInstance
  webp: (options?: { quality?: number }) => SharpInstance
  composite: (
    images: Array<{
      input: string | Buffer
      left?: number
      top?: number
    }>
  ) => SharpInstance
  metadata: () => Promise<SharpMetadata>
  toBuffer: () => Promise<Buffer>
  toFile: (path: string) => Promise<{
    width: number
    height: number
    size: number
  }>
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

/** 解析背景色；transparent 用透明通道 */
function parseBackground(raw?: string): {
  background: string | { r: number; g: number; b: number; alpha?: number }
  channels: 3 | 4
} {
  const s = (raw || '').trim()
  if (!s || s.toLowerCase() === 'transparent') {
    return {
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      channels: 4
    }
  }
  const hex = s.replace(/^#/, '')
  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    return {
      background: {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        alpha: 1
      },
      channels: 3
    }
  }
  if (/^[0-9a-fA-F]{8}$/.test(hex)) {
    return {
      background: {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        alpha: parseInt(hex.slice(6, 8), 16) / 255
      },
      channels: 4
    }
  }
  // sharp 也接受部分 CSS 色名；默认 3 通道
  return { background: s, channels: 3 }
}

function applyFormat(
  pipeline: SharpInstance,
  resolvedFormat: 'jpeg' | 'png' | 'webp',
  quality: number
): SharpInstance {
  if (resolvedFormat === 'jpeg') {
    return pipeline.jpeg({ quality, mozjpeg: true })
  }
  if (resolvedFormat === 'png') {
    return pipeline.png({ compressionLevel: 9 })
  }
  return pipeline.webp({ quality })
}

function resolveFormat(
  format: ImageProcessOptions['format'],
  outputPath: string,
  inputPath: string
): 'jpeg' | 'png' | 'webp' {
  if (format && format !== 'keep') return format
  return (
    guessFormatFromPath(outputPath) ||
    guessFormatFromPath(inputPath) ||
    'jpeg'
  )
}

function throwIfCancelled(signal?: TaskCancelSignal): void {
  if (isCancelled(signal)) {
    throw new ImageCancelledError()
  }
}

function cancelledResult(outputPath?: string): ImageProcessResult {
  if (outputPath) removeIncompleteOutput(outputPath)
  return { ok: false, engine: 'sharp', error: '已取消', cancelled: true }
}

async function processStitch(
  sharp: SharpFn,
  options: ImageProcessOptions,
  inputs: string[],
  outputPath: string,
  signal?: TaskCancelSignal
): Promise<ImageProcessResult> {
  for (const p of inputs) {
    if (!fs.existsSync(p)) {
      return { ok: false, engine: 'sharp', error: `输入文件不存在: ${p}` }
    }
  }

  throwIfCancelled(signal)

  const sizes: Array<{ width: number; height: number }> = []
  for (const p of inputs) {
    throwIfCancelled(signal)
    const meta = await awaitWithCancel(sharp(p).rotate().metadata(), signal)
    const w = meta.width || 0
    const h = meta.height || 0
    if (w <= 0 || h <= 0) {
      return {
        ok: false,
        engine: 'sharp',
        error: `无法读取图片尺寸: ${path.basename(p)}`
      }
    }
    sizes.push({ width: w, height: h })
  }

  throwIfCancelled(signal)

  const plan = planImageStitch(inputs, sizes, {
    layout: options.layout,
    gridCols: options.gridCols,
    gap: options.gap,
    background: options.background
  })

  if (
    plan.items.length === 0 ||
    plan.canvasWidth <= 0 ||
    plan.canvasHeight <= 0
  ) {
    return { ok: false, engine: 'sharp', error: '拼接规划失败：无有效图片' }
  }

  const { background, channels } = parseBackground(plan.background)
  const composites: Array<{ input: Buffer; left: number; top: number }> = []

  for (const item of plan.items) {
    throwIfCancelled(signal)
    const buf = await awaitWithCancel(
      sharp(item.path)
        .rotate()
        .resize({
          width: item.width,
          height: item.height,
          fit: 'fill'
        })
        .toBuffer(),
      signal
    )
    composites.push({
      input: buf,
      left: item.left,
      top: item.top
    })
  }

  throwIfCancelled(signal)

  let pipeline = sharp({
    create: {
      width: plan.canvasWidth,
      height: plan.canvasHeight,
      channels,
      background
    }
  }).composite(composites)

  const maxEdge = normalizeMaxEdge(options.maxEdge)
  if (maxEdge > 0) {
    pipeline = pipeline.resize({
      width: maxEdge,
      height: maxEdge,
      fit: 'inside',
      withoutEnlargement: true
    })
  }

  const strip = options.strip !== false
  if (!strip) {
    pipeline = pipeline.withMetadata()
  }

  const quality = normalizeImageQuality(options.quality, 80)
  const resolvedFormat = resolveFormat(
    options.format,
    outputPath,
    inputs[0] || options.inputPath
  )
  pipeline = applyFormat(pipeline, resolvedFormat, quality)

  const info = await awaitWithCancel(pipeline.toFile(outputPath), signal, () =>
    removeIncompleteOutput(outputPath)
  )
  throwIfCancelled(signal)

  let size: number | undefined
  try {
    size = fs.statSync(outputPath).size
  } catch {
    size = info.size
  }

  return {
    ok: true,
    engine: 'sharp',
    outputPath,
    width: info.width,
    height: info.height,
    size
  }
}

export async function processWithSharp(
  options: ImageProcessOptions,
  signal?: TaskCancelSignal
): Promise<ImageProcessResult> {
  if (!checkSharpReady()) {
    return { ok: false, engine: 'sharp', error: 'sharp 不可用' }
  }

  const outputPath = (options.outputPath || '').trim()
  if (!outputPath) {
    return { ok: false, engine: 'sharp', error: '输入或输出路径为空' }
  }

  const stitchInputs = (options.inputs || [])
    .map((p) => (p || '').trim())
    .filter(Boolean)

  try {
    if (isCancelled(signal)) {
      return cancelledResult()
    }

    const outDir = path.dirname(outputPath)
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true })
    }

    const sharp = loadSharp()

    if (stitchInputs.length >= 2) {
      return await processStitch(
        sharp,
        options,
        stitchInputs,
        outputPath,
        signal
      )
    }

    const inputPath = (options.inputPath || stitchInputs[0] || '').trim()
    if (!inputPath) {
      return { ok: false, engine: 'sharp', error: '输入或输出路径为空' }
    }
    if (!fs.existsSync(inputPath)) {
      return { ok: false, engine: 'sharp', error: '输入文件不存在' }
    }

    throwIfCancelled(signal)

    const maxEdge = normalizeMaxEdge(options.maxEdge)
    const quality = normalizeImageQuality(options.quality, 80)
    const strip = options.strip !== false
    const crop = normalizeCrop(options.crop)

    // rotate() 无参：按 EXIF 自动方向
    let pipeline = sharp(inputPath).rotate()

    if (crop) {
      pipeline = pipeline.extract({
        left: crop.x,
        top: crop.y,
        width: crop.w,
        height: crop.h
      })
    }

    if (maxEdge > 0) {
      pipeline = pipeline.resize({
        width: maxEdge,
        height: maxEdge,
        fit: 'inside',
        withoutEnlargement: true
      })
    }

    // sharp 默认剥离大部分元数据；仅在 strip=false 时保留
    if (!strip) {
      pipeline = pipeline.withMetadata()
    }

    const resolvedFormat = resolveFormat(options.format, outputPath, inputPath)
    pipeline = applyFormat(pipeline, resolvedFormat, quality)

    const info = await awaitWithCancel(pipeline.toFile(outputPath), signal, () =>
      removeIncompleteOutput(outputPath)
    )
    throwIfCancelled(signal)

    let size: number | undefined
    try {
      size = fs.statSync(outputPath).size
    } catch {
      size = info.size
    }

    return {
      ok: true,
      engine: 'sharp',
      outputPath,
      width: info.width,
      height: info.height,
      size
    }
  } catch (err) {
    if (isImageCancelledError(err) || isCancelled(signal)) {
      return cancelledResult(outputPath)
    }
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, engine: 'sharp', error: message || 'sharp 处理失败' }
  }
}

function guessFormatFromPath(
  p: string
): 'jpeg' | 'png' | 'webp' | null {
  const ext = path.extname(p).toLowerCase()
  if (ext === '.jpg' || ext === '.jpeg') return 'jpeg'
  if (ext === '.png') return 'png'
  if (ext === '.webp') return 'webp'
  return null
}
