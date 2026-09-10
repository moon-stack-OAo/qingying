/**
 * 简易登录限流：按 IP 滑动窗口
 * 默认 15 分钟内最多 10 次失败
 */
export class LoginRateLimiter {
  private fails = new Map<string, number[]>()
  private readonly windowMs: number
  private readonly maxFails: number

  constructor(windowMs = 15 * 60 * 1000, maxFails = 10) {
    this.windowMs = windowMs
    this.maxFails = maxFails
  }

  private prune(ip: string, now: number): number[] {
    const list = (this.fails.get(ip) || []).filter((t) => now - t < this.windowMs)
    if (list.length === 0) {
      this.fails.delete(ip)
    } else {
      this.fails.set(ip, list)
    }
    return list
  }

  /** 是否已超限 */
  isBlocked(ip: string): boolean {
    const now = Date.now()
    return this.prune(ip, now).length >= this.maxFails
  }

  /** 剩余可尝试次数 */
  remaining(ip: string): number {
    const now = Date.now()
    return Math.max(0, this.maxFails - this.prune(ip, now).length)
  }

  recordFail(ip: string): void {
    const now = Date.now()
    const list = this.prune(ip, now)
    list.push(now)
    this.fails.set(ip, list)
  }

  reset(ip: string): void {
    this.fails.delete(ip)
  }

  clearAll(): void {
    this.fails.clear()
  }
}

/**
 * 通用滑动窗口限流（按 key：IP 或 session）。
 * 每次 `tryTake` 成功则计入一次；超限返回 false（调用方应回 429）。
 * 用于已认证重操作（缩略图 / 抽帧等），避免打爆 ffmpeg/sharp。
 */
export class SlidingWindowRateLimiter {
  private hits = new Map<string, number[]>()
  private readonly windowMs: number
  private readonly maxHits: number

  constructor(windowMs: number, maxHits: number) {
    this.windowMs = windowMs
    this.maxHits = maxHits
  }

  private prune(key: string, now: number): number[] {
    const list = (this.hits.get(key) || []).filter((t) => now - t < this.windowMs)
    if (list.length === 0) {
      this.hits.delete(key)
    } else {
      this.hits.set(key, list)
    }
    return list
  }

  /** 当前窗口内已用次数 */
  used(key: string, now = Date.now()): number {
    return this.prune(key, now).length
  }

  /** 剩余可请求次数（不含本次） */
  remaining(key: string, now = Date.now()): number {
    return Math.max(0, this.maxHits - this.prune(key, now).length)
  }

  /** 是否已达上限（不消耗配额） */
  isLimited(key: string, now = Date.now()): boolean {
    return this.prune(key, now).length >= this.maxHits
  }

  /**
   * 尝试占用一次配额。成功返回 true；已超限返回 false。
   */
  tryTake(key: string, now = Date.now()): boolean {
    const list = this.prune(key, now)
    if (list.length >= this.maxHits) return false
    list.push(now)
    this.hits.set(key, list)
    return true
  }

  reset(key: string): void {
    this.hits.delete(key)
  }

  clearAll(): void {
    this.hits.clear()
  }
}
