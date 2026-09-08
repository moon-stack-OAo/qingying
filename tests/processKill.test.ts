import { EventEmitter } from 'events'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('child_process', async () => {
  const actual = await vi.importActual<typeof import('child_process')>('child_process')
  return {
    ...actual,
    spawn: vi.fn()
  }
})

import { spawn } from 'child_process'
import { killChildProcess } from '../electron/main/processKill'

describe('killChildProcess', () => {
  afterEach(() => {
    vi.mocked(spawn).mockReset()
    vi.unstubAllGlobals()
  })

  it('调用 SIGTERM；Windows 再 taskkill /T /F', () => {
    vi.stubGlobal('process', { ...process, platform: 'win32' })
    const kill = vi.fn()
    const proc = Object.assign(new EventEmitter(), {
      pid: 4242,
      kill
    }) as unknown as import('child_process').ChildProcess

    killChildProcess(proc)

    expect(kill).toHaveBeenCalledWith('SIGTERM')
    expect(spawn).toHaveBeenCalledWith(
      'taskkill',
      ['/pid', '4242', '/f', '/t'],
      { windowsHide: true, stdio: 'ignore' }
    )
  })

  it('非 Windows 仅 SIGTERM，不调 taskkill', () => {
    vi.stubGlobal('process', { ...process, platform: 'linux' })
    const kill = vi.fn()
    const proc = Object.assign(new EventEmitter(), {
      pid: 100,
      kill
    }) as unknown as import('child_process').ChildProcess

    killChildProcess(proc)

    expect(kill).toHaveBeenCalledWith('SIGTERM')
    expect(spawn).not.toHaveBeenCalled()
  })
})
