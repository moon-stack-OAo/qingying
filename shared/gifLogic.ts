import type {
  CompressOptions,
  GifDither,
  GifOptions,
  GifOutputKind
} from './types'
import {
  DEFAULT_GIF_COLORS,
  DEFAULT_GIF_FPS,
  DEFAULT_GIF_LOOP,
  DEFAULT_GIF_MAX_EDGE,
  DEFAULT_GIF_OPTIMIZE_FPS,
  DEFAULT_GIF_WEBP_QUALITY,
  DEFAULT_IMAGES_TO_GIF_FPS,
  DEFAULT_IMAGES_TO_GIF_FRAME_DELAY_MS
} from './types'
import { buildScaleFilter, buildSeekArgs, normalizeTrimSec } from './ffmpegLogic'

const GIF_DITHER_SET = new Set<GifDither>([
  'none',
  'bayer',
  'heckbert',
  'floyd_steinberg',
  'sierra2',
  'sierra2_4a'
])

/** 规范化 GIF fps：非法回退默认；范围约 1–50 */
export function normalizeGifFps(v: unknown, fallback = DEFAULT_GIF_FPS): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.max(1, Math.min(50, Math.round(n * 10) / 10))
}

/** 规范化帧间隔 ms：非法回退；范围 20–10000 */
export function normalizeGifFrameDelayMs(
  v: unknown,
  fallback = DEFAULT_IMAGES_TO_GIF_FRAME_DELAY_MS
): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.max(20, Math.min(10000, Math.round(n)))
}

/** 由帧间隔推 fps（保留 1 位小数） */
export function fpsFromFrameDelayMs(delayMs: number): number {
  const d = normalizeGifFrameDelayMs(delayMs)
  return normalizeGifFps(1000 / d)
}

/** 由 fps 推帧间隔 ms */
export function frameDelayMsFromFps(fps: number): number {
  const f = normalizeGifFps(fps)
  return normalizeGifFrameDelayMs(Math.round(1000 / f))
}

/** 规范化最长边：非法/负 → 默认；0 表示不缩放 */
export function normalizeGifMaxEdge(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n) || n < 0) return DEFAULT_GIF_MAX_EDGE
  return Math.round(n)
}

/**
 * 规范化 loop：0=无限；-1=不循环；>0=额外循环次数
 * 非法回退默认
 */
export function normalizeGifLoop(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return DEFAULT_GIF_LOOP
  const i = Math.round(n)
  if (i < -1) return DEFAULT_GIF_LOOP
  return i
}

/** 规范化颜色数 2–256 */
export function normalizeGifColors(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n) || n < 2) return DEFAULT_GIF_COLORS
  return Math.max(2, Math.min(256, Math.round(n)))
}

export function normalizeGifDither(v: unknown): GifDither {
  if (typeof v === 'string' && GIF_DITHER_SET.has(v as GifDither)) {
    return v as GifDither
  }
  return 'bayer'
}

/** 规范化输出格式：仅 gif | webp，默认 gif */
export function normalizeGifOutputKind(v: unknown): GifOutputKind {
  return v === 'webp' ? 'webp' : 'gif'
}

/** 规范化动图 WebP 质量 0–100 */
export function normalizeGifWebpQuality(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return DEFAULT_GIF_WEBP_QUALITY
  return Math.max(0, Math.min(100, Math.round(n)))
}

export function isGifTaskMode(mode?: string | null): boolean {
  return (
    mode === 'video-to-gif' ||
    mode === 'images-to-gif' ||
    mode === 'gif-optimize'
  )
}

/** 动图优化输入是否为 .gif / .webp（按扩展名） */
export function isGifOptimizeInputPath(filePath?: string | null): boolean {
  if (!filePath || typeof filePath !== 'string') return false
  const lower = filePath.toLowerCase()
  const idx = lower.lastIndexOf('.')
  if (idx < 0) return false
  const ext = lower.slice(idx)
  return ext === '.gif' || ext === '.webp'
}

/**
 * 解析 fps / frameDelayMs：
 * - 若提供合法 frameDelayMs → 以其为准并反推 fps
 * - 否则用 fps（images-to-gif / gif-optimize 默认 10，其余默认 12）并反推 delay
 */
export function resolveGifTiming(
  gif?: GifOptions | null,
  mode?: string | null
): { fps: number; frameDelayMs: number } {
  const defaultFps =
    mode === 'images-to-gif' || mode === 'gif-optimize'
      ? mode === 'gif-optimize'
        ? DEFAULT_GIF_OPTIMIZE_FPS
        : DEFAULT_IMAGES_TO_GIF_FPS
      : DEFAULT_GIF_FPS
  const rawDelay = gif?.frameDelayMs
  const hasDelay =
    typeof rawDelay === 'number'
      ? Number.isFinite(rawDelay) && rawDelay > 0
      : typeof rawDelay === 'string' &&
        Number.isFinite(Number(rawDelay)) &&
        Number(rawDelay) > 0

  if (hasDelay) {
    const frameDelayMs = normalizeGifFrameDelayMs(rawDelay)
    return { fps: fpsFromFrameDelayMs(frameDelayMs), frameDelayMs }
  }

  const fps = normalizeGifFps(gif?.fps, defaultFps)
  return { fps, frameDelayMs: frameDelayMsFromFps(fps) }
}

/** 规范化 gif 选项并补默认值 */
export function normalizeGifOptions(
  gif?: GifOptions | null,
  maxEdgeFallback?: number,
  mode?: string | null
): Required<
  Pick<
    GifOptions,
    'fps' | 'frameDelayMs' | 'loop' | 'colors' | 'dither' | 'outputKind' | 'quality'
  >
> & {
  maxEdge: number
} {
  const maxEdge =
    typeof maxEdgeFallback === 'number' && Number.isFinite(maxEdgeFallback)
      ? normalizeGifMaxEdge(maxEdgeFallback)
      : normalizeGifMaxEdge(undefined)
  const timing = resolveGifTiming(gif, mode)
  return {
    outputKind: normalizeGifOutputKind(gif?.outputKind),
    fps: timing.fps,
    frameDelayMs: timing.frameDelayMs,
    loop: normalizeGifLoop(gif?.loop),
    colors: normalizeGifColors(gif?.colors),
    dither: normalizeGifDither(gif?.dither),
    quality: normalizeGifWebpQuality(gif?.quality),
    maxEdge
  }
}

/** 校验 GIF / 动图 WebP 任务选项；通过返回 null */
export function validateGifOptions(options: CompressOptions): string | null {
  if (!isGifTaskMode(options.mode)) return null
  const g = normalizeGifOptions(options.gif, options.maxEdge, options.mode)
  if (!(g.fps > 0)) return '动图帧率须大于 0'
  if (!(g.frameDelayMs > 0)) return '动图帧间隔须大于 0'
  if (g.outputKind === 'gif' && (g.colors < 2 || g.colors > 256)) {
    return 'GIF 颜色数须在 2–256'
  }
  if (g.outputKind === 'webp' && (g.quality < 0 || g.quality > 100)) {
    return '动图 WebP 质量须在 0–100'
  }
  if (options.mode === 'video-to-gif') {
    const start = normalizeTrimSec(options.trimStart)
    const end = normalizeTrimSec(options.trimEnd)
    if (start != null && end != null && end <= start) {
      return '裁剪结束时间须大于开始时间'
    }
  }
  return null
}

/**
 * 构建缩放 + fps 滤镜链（palette / webp 共用）
 * 例：fps=12,scale=480:-1:flags=lanczos
 */
export function buildGifVfChain(opts: {
  fps: number
  maxEdge: number
}): string {
  const parts: string[] = [`fps=${opts.fps}`]
  const scale = buildScaleFilter(opts.maxEdge)
  if (scale) {
    parts.push(scale)
  }
  return parts.join(',')
}

/**
 * 多图 concat demuxer 列表内容（含每帧 duration；末帧重复以满足 demuxer）
 */
export function buildImagesToGifConcatList(
  inputPaths: string[],
  frameDelaySec: number
): string {
  const paths = (inputPaths || [])
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean)
  const delay =
    Number.isFinite(frameDelaySec) && frameDelaySec > 0
      ? Math.round(frameDelaySec * 10000) / 10000
      : DEFAULT_IMAGES_TO_GIF_FRAME_DELAY_MS / 1000
  const lines: string[] = ['ffconcat version 1.0']
  for (const p of paths) {
    const escaped = String(p).replace(/'/g, "'\\''")
    lines.push(`file '${escaped}'`)
    lines.push(`duration ${delay}`)
  }
  if (paths.length > 0) {
    const last = String(paths[paths.length - 1]).replace(/'/g, "'\\''")
    lines.push(`file '${last}'`)
  }
  return lines.join('\n')
}

export interface BuildVideoToGifArgsParams {
  inputPath: string
  outputPath: string
  /** GIF 两遍编码用；webp 可传空串 */
  palettePath: string
  options: CompressOptions
  /** pass1=仅生成调色板；pass2=用调色板输出 GIF；webp 忽略 pass，单遍编码 */
  pass: 1 | 2
}

/**
 * 视频转动图参数
 * - gif：两遍 palettegen / paletteuse
 * - webp：单遍 libwebp（-c:v libwebp、-loop、-quality）
 */
export function buildVideoToGifArgs(
  params: BuildVideoToGifArgsParams
): string[] {
  const { inputPath, outputPath, palettePath, options, pass } = params
  const g = normalizeGifOptions(options.gif, options.maxEdge, 'video-to-gif')
  const vf = buildGifVfChain({ fps: g.fps, maxEdge: g.maxEdge })
  const seek = buildSeekArgs(options)

  if (g.outputKind === 'webp') {
    // WebP 容器 -loop：0=无限；正数=循环次数；不循环用 1（播一次）
    const webpLoop = g.loop < 0 ? 1 : g.loop
    return [
      '-y',
      '-hide_banner',
      ...seek.beforeInput,
      '-i',
      inputPath,
      ...seek.afterInput,
      '-vf',
      vf,
      '-an',
      '-c:v',
      'libwebp',
      '-loop',
      String(webpLoop),
      '-quality',
      String(g.quality),
      '-compression_level',
      '4',
      outputPath
    ]
  }

  if (pass === 1) {
    return [
      '-y',
      '-hide_banner',
      ...seek.beforeInput,
      '-i',
      inputPath,
      ...seek.afterInput,
      '-vf',
      `${vf},palettegen=max_colors=${g.colors}:stats_mode=diff`,
      palettePath
    ]
  }

  const dither =
    g.dither === 'none'
      ? 'none'
      : g.dither === 'bayer'
        ? 'bayer:bayer_scale=5'
        : g.dither

  return [
    '-y',
    '-hide_banner',
    ...seek.beforeInput,
    '-i',
    inputPath,
    '-i',
    palettePath,
    ...seek.afterInput,
    '-lavfi',
    `${vf}[x];[x][1:v]paletteuse=dither=${dither}`,
    '-loop',
    String(g.loop),
    outputPath
  ]
}

export interface BuildImagesToGifArgsParams {
  /** concat demuxer 列表文件路径 */
  concatListPath: string
  outputPath: string
  palettePath: string
  options: CompressOptions
  pass: 1 | 2
}

/**
 * 多图合成动图参数（concat demuxer 输入）
 * - gif：两遍 palettegen / paletteuse
 * - webp：单遍 libwebp
 */
export function buildImagesToGifArgs(
  params: BuildImagesToGifArgsParams
): string[] {
  const { concatListPath, outputPath, palettePath, options, pass } = params
  const g = normalizeGifOptions(options.gif, options.maxEdge, 'images-to-gif')
  // 多图已按 duration 控速；vf 仅缩放（避免再 fps 滤镜打乱时长）
  const scale = buildScaleFilter(g.maxEdge)
  const vfScale = scale || 'null'

  if (g.outputKind === 'webp') {
    const webpLoop = g.loop < 0 ? 1 : g.loop
    return [
      '-y',
      '-hide_banner',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      concatListPath,
      '-vf',
      vfScale,
      '-an',
      '-c:v',
      'libwebp',
      '-loop',
      String(webpLoop),
      '-quality',
      String(g.quality),
      '-compression_level',
      '4',
      outputPath
    ]
  }

  if (pass === 1) {
    return [
      '-y',
      '-hide_banner',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      concatListPath,
      '-vf',
      `${vfScale},palettegen=max_colors=${g.colors}:stats_mode=diff`,
      palettePath
    ]
  }

  const dither =
    g.dither === 'none'
      ? 'none'
      : g.dither === 'bayer'
        ? 'bayer:bayer_scale=5'
        : g.dither

  return [
    '-y',
    '-hide_banner',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    concatListPath,
    '-i',
    palettePath,
    '-lavfi',
    `${vfScale}[x];[x][1:v]paletteuse=dither=${dither}`,
    '-loop',
    String(g.loop),
    outputPath
  ]
}

export interface BuildGifOptimizeArgsParams {
  inputPath: string
  outputPath: string
  /** GIF 两遍编码用；webp 可传空串 */
  palettePath: string
  options: CompressOptions
  /** pass1=仅生成调色板；pass2=用调色板输出 GIF；webp 忽略 pass，单遍编码 */
  pass: 1 | 2
}

/**
 * 已有 GIF / 动图 WebP 重编码优化
 * - gif：两遍 palettegen / paletteuse（降分辨率/帧率/颜色）
 * - webp：单遍 libwebp
 * 不裁剪时段；输入按扩展名应为 .gif / .webp
 */
export function buildGifOptimizeArgs(
  params: BuildGifOptimizeArgsParams
): string[] {
  const { inputPath, outputPath, palettePath, options, pass } = params
  const g = normalizeGifOptions(options.gif, options.maxEdge, 'gif-optimize')
  const vf = buildGifVfChain({ fps: g.fps, maxEdge: g.maxEdge })

  if (g.outputKind === 'webp') {
    const webpLoop = g.loop < 0 ? 1 : g.loop
    return [
      '-y',
      '-hide_banner',
      '-i',
      inputPath,
      '-vf',
      vf,
      '-an',
      '-c:v',
      'libwebp',
      '-loop',
      String(webpLoop),
      '-quality',
      String(g.quality),
      '-compression_level',
      '4',
      outputPath
    ]
  }

  if (pass === 1) {
    return [
      '-y',
      '-hide_banner',
      '-i',
      inputPath,
      '-vf',
      `${vf},palettegen=max_colors=${g.colors}:stats_mode=diff`,
      palettePath
    ]
  }

  const dither =
    g.dither === 'none'
      ? 'none'
      : g.dither === 'bayer'
        ? 'bayer:bayer_scale=5'
        : g.dither

  return [
    '-y',
    '-hide_banner',
    '-i',
    inputPath,
    '-i',
    palettePath,
    '-lavfi',
    `${vf}[x];[x][1:v]paletteuse=dither=${dither}`,
    '-loop',
    String(g.loop),
    outputPath
  ]
}
