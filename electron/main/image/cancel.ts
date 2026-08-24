import { spawn, type ChildProcess } from 'child_process'
import fs from 'fs'

/** 与 taskQueue / ffmpeg runner 统一的取消信号 */
export type TaskCancelSignal = { cancelled: boolean }

export function isCancelled(signal?: TaskCancelSignal): boolean {
  return !!signal?.cancelled
}

/** 删除可能不完整的输出文件 */
export function removeIncompleteOutput(outputPath: string): void {
  const p = (outputPath || '').trim()
  if (!p) return
  try {
    if (fs.existsSync(p)) {
      fs.unlinkSync(p)
    }
  } catch {
    // ignore
  }
}

/** 强制结束子进程（Windows 用 taskkill 杀进程树） */
export function killChildProcess(proc: ChildProcess): void {
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

/** 图片处理被用户取消 */
export class ImageCancelledError extends Error {
  readonly cancelled = true as const

  constructor(message = '已取消') {
    super(message)
    this.name = 'ImageCancelledError'
  }
}

export function isImageCancelledError(err: unknown): boolean {
  return (
    err instanceof ImageCancelledError ||
    (!!err &&
      typeof err === 'object' &&
      (err as { cancelled?: unknown }).cancelled === true)
  )
}

/**
 * 在等待 Promise 期间轮询取消信号。
 * 取消后立即抛出 ImageCancelledError，并在后台 work 结束后执行 cleanup
 *（Sharp 等无法硬杀的场景：尽快响应取消，并尽量清掉迟到写出的文件）。
 */
export function awaitWithCancel<T>(
  work: Promise<T>,
  signal: TaskCancelSignal | undefined,
  cleanup?: () => void
): Promise<T> {
  if (!signal) return work

  return new Promise<T>((resolve, reject) => {
    let settled = false
    const finish = (fn: () => void): void => {
      if (settled) return
      settled = true
      clearInterval(timer)
      fn()
    }

    const timer = setInterval(() => {
      if (!signal.cancelled) return
      finish(() => {
        void work
          .then(() => cleanup?.())
          .catch(() => cleanup?.())
        reject(new ImageCancelledError())
      })
    }, 200)

    void work.then(
      (value) => {
        finish(() => {
          if (signal.cancelled) {
            cleanup?.()
            reject(new ImageCancelledError())
            return
          }
          resolve(value)
        })
      },
      (err) => {
        finish(() => {
          if (signal.cancelled) {
            cleanup?.()
            reject(new ImageCancelledError())
            return
          }
          reject(err)
        })
      }
    )
  })
}
