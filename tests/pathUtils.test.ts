import { describe, expect, it } from 'vitest'
import { fileUrlToPath, isUncPath, pathBasename } from '../shared/pathUtils'

describe('pathUtils', () => {
  it('pathBasename 兼容 Windows / Unix / UNC', () => {
    expect(pathBasename('D:\\v\\a.mp4')).toBe('a.mp4')
    expect(pathBasename('/home/u/clip.mkv')).toBe('clip.mkv')
    expect(pathBasename('\\\\NAS\\share\\clip.mp4')).toBe('clip.mp4')
  })

  it('isUncPath 识别 UNC', () => {
    expect(isUncPath('\\\\NAS\\share\\a.mp4')).toBe(true)
    expect(isUncPath('//NAS/share/a.mp4')).toBe(true)
    expect(isUncPath('D:\\v\\a.mp4')).toBe(false)
    expect(isUncPath('')).toBe(false)
  })

  it('fileUrlToPath 解析 Windows file URL', () => {
    expect(fileUrlToPath('file:///D:/Moon/clip.mp4')).toBe('D:\\Moon\\clip.mp4')
    expect(fileUrlToPath('file:///C%3A/Users/a%20b/x.mp4')).toBe(
      'C:\\Users\\a b\\x.mp4'
    )
    expect(fileUrlToPath('https://example.com/a.mp4')).toBe('')
    expect(fileUrlToPath('')).toBe('')
  })
})
