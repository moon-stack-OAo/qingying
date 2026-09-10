import { describe, expect, it } from 'vitest'
import { isAllowedExternalUrl } from '../shared/urlAllowlist'

describe('isAllowedExternalUrl', () => {
  it('允许 http / https', () => {
    expect(isAllowedExternalUrl('http://example.com')).toBe(true)
    expect(isAllowedExternalUrl('https://example.com/path?q=1')).toBe(true)
    expect(isAllowedExternalUrl('HTTPS://Example.COM')).toBe(true)
  })

  it('拒绝 file / javascript / 自定义协议', () => {
    expect(isAllowedExternalUrl('file:///C:/Windows/System32/cmd.exe')).toBe(false)
    expect(isAllowedExternalUrl('javascript:alert(1)')).toBe(false)
    expect(isAllowedExternalUrl('qingying://open')).toBe(false)
    expect(isAllowedExternalUrl('ms-settings:privacy')).toBe(false)
    expect(isAllowedExternalUrl('data:text/html,hi')).toBe(false)
  })

  it('拒绝非法 URL 与空值', () => {
    expect(isAllowedExternalUrl('')).toBe(false)
    expect(isAllowedExternalUrl('   ')).toBe(false)
    expect(isAllowedExternalUrl('not a url')).toBe(false)
    expect(isAllowedExternalUrl('/relative/path')).toBe(false)
  })
})
