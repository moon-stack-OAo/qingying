import { describe, expect, it } from 'vitest'
import {
  LoginRateLimiter,
  SlidingWindowRateLimiter
} from '../electron/main/lanServer/rateLimit'

describe('LoginRateLimiter', () => {
  it('未达上限时不拦截，失败累计后 isBlocked', () => {
    const lim = new LoginRateLimiter(60_000, 3)
    const ip = '10.0.0.1'
    expect(lim.isBlocked(ip)).toBe(false)
    lim.recordFail(ip)
    lim.recordFail(ip)
    expect(lim.isBlocked(ip)).toBe(false)
    expect(lim.remaining(ip)).toBe(1)
    lim.recordFail(ip)
    expect(lim.isBlocked(ip)).toBe(true)
    expect(lim.remaining(ip)).toBe(0)
  })

  it('reset 后可再试', () => {
    const lim = new LoginRateLimiter(60_000, 2)
    lim.recordFail('a')
    lim.recordFail('a')
    expect(lim.isBlocked('a')).toBe(true)
    lim.reset('a')
    expect(lim.isBlocked('a')).toBe(false)
  })
})

describe('SlidingWindowRateLimiter', () => {
  it('tryTake 在窗口内累计至上限后返回 false', () => {
    const lim = new SlidingWindowRateLimiter(60_000, 3)
    const key = '192.168.1.2'
    expect(lim.tryTake(key)).toBe(true)
    expect(lim.tryTake(key)).toBe(true)
    expect(lim.tryTake(key)).toBe(true)
    expect(lim.tryTake(key)).toBe(false)
    expect(lim.isLimited(key)).toBe(true)
    expect(lim.remaining(key)).toBe(0)
    expect(lim.used(key)).toBe(3)
  })

  it('不同 key 互不影响', () => {
    const lim = new SlidingWindowRateLimiter(60_000, 1)
    expect(lim.tryTake('ip-a')).toBe(true)
    expect(lim.tryTake('ip-a')).toBe(false)
    expect(lim.tryTake('ip-b')).toBe(true)
  })

  it('窗口过期后配额恢复', () => {
    const lim = new SlidingWindowRateLimiter(100, 2)
    const key = 'session-1'
    const t0 = 1_000_000
    expect(lim.tryTake(key, t0)).toBe(true)
    expect(lim.tryTake(key, t0 + 10)).toBe(true)
    expect(lim.tryTake(key, t0 + 20)).toBe(false)
    // 窗口外：旧命中被 prune
    expect(lim.tryTake(key, t0 + 150)).toBe(true)
    expect(lim.used(key, t0 + 150)).toBe(1)
  })

  it('clearAll / reset 清空状态', () => {
    const lim = new SlidingWindowRateLimiter(60_000, 1)
    expect(lim.tryTake('x')).toBe(true)
    lim.reset('x')
    expect(lim.tryTake('x')).toBe(true)
    lim.clearAll()
    expect(lim.isLimited('x')).toBe(false)
  })
})
