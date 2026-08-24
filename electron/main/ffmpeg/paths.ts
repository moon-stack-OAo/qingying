import fs from 'fs'
import path from 'path'
import {
  buildOutputPath,
  suggestUniqueOutputPath
} from '../../../shared/ffmpegLogic'

export { buildOutputPath }

const FS_PROBE_TIMEOUT_MS = 4_000

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    let done = false
    const timer = setTimeout(() => {
      if (done) return
      done = true
      resolve(fallback)
    }, ms)
    p.then(
      (v) => {
        if (done) return
        done = true
        clearTimeout(timer)
        resolve(v)
      },
      () => {
        if (done) return
        done = true
        clearTimeout(timer)
        resolve(fallback)
      }
    )
  })
}

/** 异步判断路径是否存在；超时视为不存在（避免 UNC 卡死） */
export async function pathExistsAsync(
  filePath: string,
  timeoutMs = FS_PROBE_TIMEOUT_MS
): Promise<boolean> {
  return withTimeout(
    fs.promises.access(filePath).then(() => true),
    timeoutMs,
    false
  )
}

/**
 * 若输出已存在则追加序号；探测超时则直接加时间戳后缀，避免局域网盘阻塞。
 */
export async function uniqueOutputPathAsync(
  outputPath: string,
  timeoutMs = FS_PROBE_TIMEOUT_MS
): Promise<string> {
  const existsTimed = async (p: string): Promise<boolean> =>
    pathExistsAsync(p, timeoutMs)

  try {
    const first = await existsTimed(outputPath)
    if (!first) return outputPath

    // 已存在：尝试序号；任一步超时则退回时间戳
    const dir = path.dirname(outputPath)
    const ext = path.extname(outputPath)
    const name = path.basename(outputPath, ext)
    for (let i = 1; i <= 20; i += 1) {
      const candidate = path.join(dir, `${name}_${i}${ext}`)
      const hit = await existsTimed(candidate)
      if (!hit) return candidate
    }
  } catch {
    // fall through
  }

  const dir = path.dirname(outputPath)
  const ext = path.extname(outputPath)
  const name = path.basename(outputPath, ext)
  return path.join(dir, `${name}_${Date.now().toString(36)}${ext}`)
}

/** 同步去重（仅本地盘可信场景）；优先用 uniqueOutputPathAsync */
export function uniqueOutputPath(outputPath: string): string {
  return suggestUniqueOutputPath(outputPath, (p) => {
    try {
      return fs.existsSync(p)
    } catch {
      return false
    }
  })
}

/** 获取文件大小（字节），失败返回 undefined；勿在 IPC 热路径对 UNC 调用 */
export function getFileSize(filePath: string): number | undefined {
  try {
    return fs.statSync(filePath).size
  } catch {
    return undefined
  }
}

/** 异步取大小；超时返回 undefined */
export async function getFileSizeAsync(
  filePath: string,
  timeoutMs = FS_PROBE_TIMEOUT_MS
): Promise<number | undefined> {
  return withTimeout(
    fs.promises.stat(filePath).then((s) => s.size),
    timeoutMs,
    undefined
  )
}
