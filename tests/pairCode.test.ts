import { describe, expect, it } from 'vitest'
import {
  generatePairCode,
  PAIR_CODE_TTL_MS,
  PairCodeStore
} from '../electron/main/lanServer/pairCode'

describe('generatePairCode', () => {
  it('生成 6 位易读字符', () => {
    const code = generatePairCode(Buffer.from([0, 1, 2, 3, 4, 5]))
    expect(code).toHaveLength(6)
    expect(code).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/)
  })
})

describe('PairCodeStore', () => {
  it('refresh / peek / verify 基本流程', () => {
    const store = new PairCodeStore()
    const t0 = 1_000_000
    const state = store.refresh(t0)
    expect(state.code).toHaveLength(6)
    expect(state.expiresAt).toBe(t0 + PAIR_CODE_TTL_MS)
    expect(store.peek(t0)?.code).toBe(state.code)
    expect(store.verify(state.code, t0)).toBe(true)
    expect(store.verify(state.code.toLowerCase(), t0)).toBe(true)
    expect(store.verify('WRONG1', t0)).toBe(false)
    expect(store.verify('', t0)).toBe(false)
  })

  it('过期后 peek 为空，ensure 重新生成', () => {
    const store = new PairCodeStore()
    const t0 = 2_000_000
    const first = store.refresh(t0)
    expect(store.peek(t0 + PAIR_CODE_TTL_MS + 1)).toBeNull()
    expect(store.verify(first.code, t0 + PAIR_CODE_TTL_MS + 1)).toBe(false)
    const next = store.ensure(t0 + PAIR_CODE_TTL_MS + 1)
    expect(next.code).not.toBe(first.code)
    expect(store.verify(next.code, t0 + PAIR_CODE_TTL_MS + 1)).toBe(true)
  })

  it('clear 后需重新 ensure', () => {
    const store = new PairCodeStore()
    store.refresh(1_000)
    store.clear()
    expect(store.peek(1_000)).toBeNull()
    const again = store.ensure(1_000)
    expect(again.code).toHaveLength(6)
  })
})
