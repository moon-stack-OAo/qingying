import { randomBytes } from 'crypto'

/** 配对码有效期（毫秒） */
export const PAIR_CODE_TTL_MS = 10 * 60 * 1000

/** 6 位易读字符（去掉易混 0/O/1/I/L） */
const PAIR_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

export interface PairCodeState {
  code: string
  /** 生成时间 */
  createdAt: number
  /** 过期时间戳 */
  expiresAt: number
}

/**
 * 内存配对码：仅当绑定局域网（0.0.0.0）时登录需要。
 * 不落盘，改密 / 停服务 / 切换绑定时作废。
 */
export class PairCodeStore {
  private current: PairCodeState | null = null

  /** 生成新码并替换旧码 */
  refresh(now = Date.now()): PairCodeState {
    const code = generatePairCode()
    this.current = {
      code,
      createdAt: now,
      expiresAt: now + PAIR_CODE_TTL_MS
    }
    return this.current
  }

  /** 清除（停服务 / 改绑本机 / 改密） */
  clear(): void {
    this.current = null
  }

  /**
   * 确保有未过期码；过期或不存在则重新生成。
   * 绑定局域网且服务运行时应调用。
   */
  ensure(now = Date.now()): PairCodeState {
    if (this.current && now < this.current.expiresAt) {
      return this.current
    }
    return this.refresh(now)
  }

  /** 当前有效码；过期或不存在返回 null */
  peek(now = Date.now()): PairCodeState | null {
    if (!this.current) return null
    if (now >= this.current.expiresAt) {
      this.current = null
      return null
    }
    return this.current
  }

  /**
   * 校验用户提交的配对码（大小写不敏感）。
   * 无有效码或错误均返回 false。
   */
  verify(input: string | undefined | null, now = Date.now()): boolean {
    const state = this.peek(now)
    if (!state) return false
    const raw = typeof input === 'string' ? input.trim().toUpperCase() : ''
    if (!raw) return false
    return raw === state.code
  }
}

export function generatePairCode(bytes = randomBytes(6)): string {
  let out = ''
  for (let i = 0; i < 6; i++) {
    out += PAIR_ALPHABET[bytes[i]! % PAIR_ALPHABET.length]
  }
  return out
}
