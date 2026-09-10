import {describe, expect, it} from 'vitest'
import {
  clearProgressThrottle,
  shouldPushProgress
} from '../electron/main/lanServer/sse'

describe('lanServer SSE progress throttle', () => {
  it('首次进度应推送', () => {
    clearProgressThrottle()
    expect(shouldPushProgress('t1', 1)).toBe(true)
  })

  it('间隔内微小变化不推，force 或足够 delta 才推', () => {
    clearProgressThrottle()
    expect(shouldPushProgress('t2', 10)).toBe(true)
    expect(shouldPushProgress('t2', 10.2)).toBe(false)
    expect(shouldPushProgress('t2', 11)).toBe(true)
    expect(shouldPushProgress('t2', 11.1, true)).toBe(true)
  })
})
