import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ImageCancelledError,
  awaitWithCancel,
  isCancelled,
  isImageCancelledError,
  removeIncompleteOutput
} from '../electron/main/image/cancel'

describe('image cancel helpers', () => {
  const tmpFiles: string[] = []

  afterEach(() => {
    for (const f of tmpFiles.splice(0, tmpFiles.length)) {
      try {
        if (fs.existsSync(f)) fs.unlinkSync(f)
      } catch {
        // ignore
      }
    }
  })

  it('isCancelled / isImageCancelledError', () => {
    expect(isCancelled(undefined)).toBe(false)
    expect(isCancelled({ cancelled: false })).toBe(false)
    expect(isCancelled({ cancelled: true })).toBe(true)
    expect(isImageCancelledError(new ImageCancelledError())).toBe(true)
    expect(isImageCancelledError(new Error('x'))).toBe(false)
    expect(isImageCancelledError({ cancelled: true })).toBe(true)
  })

  it('removeIncompleteOutput 删除已有文件', () => {
    const p = path.join(os.tmpdir(), `qy-img-cancel-${Date.now()}.tmp`)
    fs.writeFileSync(p, 'partial')
    tmpFiles.push(p)
    removeIncompleteOutput(p)
    expect(fs.existsSync(p)).toBe(false)
  })

  it('awaitWithCancel：未取消时返回结果', async () => {
    const signal = { cancelled: false }
    const value = await awaitWithCancel(Promise.resolve(42), signal)
    expect(value).toBe(42)
  })

  it('awaitWithCancel：等待中取消则抛 ImageCancelledError', async () => {
    vi.useFakeTimers()
    try {
      const signal = { cancelled: false }
      let resolveWork!: (v: number) => void
      const work = new Promise<number>((resolve) => {
        resolveWork = resolve
      })
      const pending = awaitWithCancel(work, signal)
      // 先挂上 rejection 监听，避免假时钟推进时出现 unhandled rejection
      const assertion = expect(pending).rejects.toBeInstanceOf(ImageCancelledError)
      signal.cancelled = true
      await vi.advanceTimersByTimeAsync(250)
      await assertion
      resolveWork(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('awaitWithCancel：取消后执行 cleanup', async () => {
    vi.useFakeTimers()
    try {
      const signal = { cancelled: false }
      const cleanup = vi.fn()
      let resolveWork!: () => void
      const work = new Promise<void>((resolve) => {
        resolveWork = resolve
      })
      const pending = awaitWithCancel(work, signal, cleanup)
      const assertion = expect(pending).rejects.toBeInstanceOf(ImageCancelledError)
      signal.cancelled = true
      await vi.advanceTimersByTimeAsync(250)
      await assertion
      resolveWork()
      await Promise.resolve()
      await Promise.resolve()
      expect(cleanup).toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })
})
