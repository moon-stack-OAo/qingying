import { describe, expect, it } from 'vitest'
import {
  hashPassword,
  isAllowedScryptParams,
  verifyPassword
} from '../electron/main/lanServer/password'

describe('lanServer/password', () => {
  it('hash + verify 正常密码通过', () => {
    const stored = hashPassword('secret-pass-99')
    expect(verifyPassword('secret-pass-99', stored)).toBe(true)
    expect(verifyPassword('wrong-password', stored)).toBe(false)
  })

  it('isAllowedScryptParams 仅接受固定 N/r/p', () => {
    expect(isAllowedScryptParams(16384, 8, 1)).toBe(true)
    expect(isAllowedScryptParams(1 << 20, 8, 1)).toBe(false)
    expect(isAllowedScryptParams(16384, 16, 1)).toBe(false)
    expect(isAllowedScryptParams(16384, 8, 2)).toBe(false)
  })

  it('verifyPassword 拒绝存储中被篡改的超大 scrypt 参数', () => {
    const salt = Buffer.alloc(16, 1).toString('base64')
    const hash = Buffer.alloc(32, 2).toString('base64')
    const malicious = ['scrypt', String(1 << 20), '8', '1', salt, hash].join('$')
    expect(verifyPassword('any-password', malicious)).toBe(false)
  })

  it('verifyPassword 拒绝非法格式', () => {
    expect(verifyPassword('x', '')).toBe(false)
    expect(verifyPassword('x', 'not-scrypt')).toBe(false)
    expect(verifyPassword('x', 'bcrypt$1$2$3$4$5')).toBe(false)
  })
})
