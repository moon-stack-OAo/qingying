import { describe, expect, it } from 'vitest'
import { stripSettingsForRenderer } from '../shared/settingsPublic'
import type { AppSettings } from '../shared/types'

function sampleSettings(hash: string): AppSettings {
  return {
    outputDir: 'D:\\out',
    presetId: 'standard',
    encoder: 'auto',
    concurrency: 2,
    customCrf: 23,
    customMaxEdge: 0,
    customFormat: 'mp4',
    nameTemplate: '{name}_compressed',
    outputDirMode: 'fixed',
    targetSizeMb: 0,
    twoPass: true,
    taskMode: 'compress',
    audioFormat: 'm4a',
    audioBitrate: '192k',
    notifyOnComplete: true,
    persistTasks: true,
    theme: 'system',
    ffmpegBinDir: '',
    closeAction: 'ask',
    openAtLogin: false,
    startMinimizedToTray: false,
    imageEngine: 'sharp',
    imagemagickPath: '',
    imageFormat: 'jpeg',
    imageQuality: 80,
    imageMaxEdge: 1920,
    imageStrip: true,
    imageLayout: 'horizontal',
    imageGridCols: 2,
    imageGap: 0,
    imageBackground: '#000000',
    concatPreferCopy: true,
    mosaicFrameByFrame: false,
    lanRemoteEnabled: true,
    lanPort: 17890,
    lanBindHost: '0.0.0.0',
    lanUsername: 'admin',
    lanPasswordHash: hash
  }
}

describe('stripSettingsForRenderer', () => {
  it('省略 lanPasswordHash，保留其它字段', () => {
    const src = sampleSettings('scrypt$salt$hash')
    const pub = stripSettingsForRenderer(src)
    expect(pub).not.toHaveProperty('lanPasswordHash')
    expect(pub.lanUsername).toBe('admin')
    expect(pub.lanRemoteEnabled).toBe(true)
    expect(pub.outputDir).toBe('D:\\out')
    // 源对象未被改写
    expect(src.lanPasswordHash).toBe('scrypt$salt$hash')
  })

  it('空哈希同样不出现在副本中', () => {
    const pub = stripSettingsForRenderer(sampleSettings(''))
    expect('lanPasswordHash' in pub).toBe(false)
  })

  it('结果可 structuredClone', () => {
    const pub = stripSettingsForRenderer(sampleSettings('x'))
    expect(() => structuredClone(pub)).not.toThrow()
  })
})
