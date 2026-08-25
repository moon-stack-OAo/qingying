import { describe, expect, it } from 'vitest'
import {
  isMosaicRegionActiveAt,
  normalizeMosaicRegions
} from '../shared/ffmpegLogic'
import type { MosaicRegion } from '../shared/types'

function region(partial: Partial<MosaicRegion> & Pick<MosaicRegion, 'id'>): MosaicRegion {
  return {
    startSec: 0,
    x: 0,
    y: 0,
    w: 20,
    h: 20,
    mode: 'pixelate',
    strength: 8,
    ...partial
  }
}

describe('isMosaicRegionActiveAt', () => {
  it('start=0 且无 end：全程有效', () => {
    const r = region({ id: 'a', startSec: 0 })
    expect(isMosaicRegionActiveAt(r, 0)).toBe(true)
    expect(isMosaicRegionActiveAt(r, 999)).toBe(true)
  })

  it('仅 start：t < start 无效', () => {
    const r = region({ id: 'b', startSec: 2 })
    expect(isMosaicRegionActiveAt(r, 1.9)).toBe(false)
    expect(isMosaicRegionActiveAt(r, 2)).toBe(true)
    expect(isMosaicRegionActiveAt(r, 100)).toBe(true)
  })

  it('有 endSec：闭区间 [start, end]', () => {
    const r = region({ id: 'c', startSec: 1, endSec: 3 })
    expect(isMosaicRegionActiveAt(r, 0.9)).toBe(false)
    expect(isMosaicRegionActiveAt(r, 1)).toBe(true)
    expect(isMosaicRegionActiveAt(r, 3)).toBe(true)
    expect(isMosaicRegionActiveAt(r, 3.01)).toBe(false)
  })

  it('与 normalize 后语义一致：endSec=0 视为到结尾', () => {
    const [r] = normalizeMosaicRegions([
      region({ id: 'd', startSec: 0, endSec: 0 })
    ])
    expect(r.endSec).toBeUndefined()
    expect(isMosaicRegionActiveAt(r, 0)).toBe(true)
    expect(isMosaicRegionActiveAt(r, 50)).toBe(true)
  })
})
