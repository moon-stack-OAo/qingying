import fs from 'fs'
import path from 'path'

/** 用户通过「设置」指定的自定义 bin 目录（含 ffmpeg 与 ffprobe），空串=自动探测 */
let overrideDir = ''

function binaryName(base: 'ffmpeg' | 'ffprobe'): string {
  return process.platform === 'win32' ? `${base}.exe` : base
}

/**
 * 设置自定义 ffmpeg bin 目录覆盖
 * - 空串 → 清除覆盖，改用 ffmpeg-static 自动探测
 * - 目录需同时存在 ffmpeg(.exe) 与 ffprobe(.exe)
 */
export function setBinaryOverride(dir: string): {
  accepted: boolean
  error?: string
} {
  const target = (dir || '').trim()
  if (!target) {
    overrideDir = ''
    return { accepted: true }
  }
  try {
    if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
      return { accepted: false, error: '目录不存在' }
    }
  } catch {
    return { accepted: false, error: '目录不存在' }
  }
  const ffmpegFile = path.join(target, binaryName('ffmpeg'))
  const ffprobeFile = path.join(target, binaryName('ffprobe'))
  if (!fs.existsSync(ffmpegFile) || !fs.existsSync(ffprobeFile)) {
    return { accepted: false, error: '目录中未找到 ffmpeg 或 ffprobe' }
  }
  overrideDir = target
  return { accepted: true }
}

/**
 * 规范化二进制路径：asar → unpacked、去掉 file://
 */
function normalizeBinaryPath(binPath: string): string {
  let p = binPath || ''
  if (!p) return ''

  // 打包后 asar 内路径需替换为 unpacked
  if (p.includes('app.asar') && !p.includes('app.asar.unpacked')) {
    p = p.replace('app.asar', 'app.asar.unpacked')
  }

  // 某些环境下路径可能带 file:// 前缀
  if (p.startsWith('file://')) {
    p = p.replace(/^file:\/\//, '')
    if (process.platform === 'win32' && p.startsWith('/')) {
      p = p.slice(1)
    }
  }

  return p
}

/** 解析 ffmpeg-static 在开发与打包后的路径 */
function resolveFfmpegStaticPath(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return normalizeBinaryPath(require('ffmpeg-static') as string)
  } catch {
    return ''
  }
}

/**
 * 解析 @ffprobe-installer/ffprobe 路径（约 5.x+/2023 essentials，远新于旧 ffprobe-static 4.0.2）
 */
function resolveFfprobeInstallerPath(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@ffprobe-installer/ffprobe') as { path: string }
    return normalizeBinaryPath(mod?.path || '')
  } catch {
    return ''
  }
}

export function getFfmpegPath(): string {
  if (overrideDir) {
    return path.join(overrideDir, binaryName('ffmpeg'))
  }
  return resolveFfmpegStaticPath()
}

export function getFfprobePath(): string {
  if (overrideDir) {
    return path.join(overrideDir, binaryName('ffprobe'))
  }
  return resolveFfprobeInstallerPath()
}

export function checkFfmpegAvailable(): {
  ready: boolean
  ffmpegPath?: string
  ffprobePath?: string
  error?: string
} {
  const ffmpegPath = getFfmpegPath()
  const ffprobePath = getFfprobePath()

  if (!ffmpegPath || !fs.existsSync(ffmpegPath)) {
    return {
      ready: false,
      ffmpegPath,
      ffprobePath,
      error: '未找到 ffmpeg 二进制，请确认已安装 ffmpeg-static'
    }
  }

  if (!ffprobePath || !fs.existsSync(ffprobePath)) {
    return {
      ready: false,
      ffmpegPath,
      ffprobePath,
      error: '未找到 ffprobe 二进制，请确认已安装 @ffprobe-installer/ffprobe'
    }
  }

  return { ready: true, ffmpegPath, ffprobePath }
}
