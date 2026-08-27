import {describe, expect, it} from 'vitest'
import {
  applyAspectRatio,
  clampCropRect,
  computeContainRect,
  defaultCropRect,
  defaultMosaicRect,
  displayToNatural,
  naturalToDisplay,
  roundCropRect
} from '../shared/cropUiLogic'

describe('displayToNatural / naturalToDisplay', () => {
  it('往返映射（浮点）', () => {
    const dispW = 800
    const dispH = 600
    const natW = 4000
    const natH = 3000
    const n = displayToNatural(200, 150, dispW, dispH, natW, natH)
    expect(n).toEqual({x: 1000, y: 750})
    const d = naturalToDisplay(n.x, n.y, dispW, dispH, natW, natH)
    expect(d).toEqual({x: 200, y: 150})
  })

  it('亚像素不提前 round', () => {
    const n = displayToNatural(100.5, 50.25, 800, 600, 4000, 3000)
    expect(n.x).toBeCloseTo(502.5, 5)
    expect(n.y).toBeCloseTo(251.25, 5)
  })

  it('非法尺寸返回 0', () => {
    expect(displayToNatural(10, 10, 0, 100, 100, 100)).toEqual({x: 0, y: 0})
    expect(naturalToDisplay(10, 10, 100, 100, 0, 100)).toEqual({x: 0, y: 0})
  })
})

describe('clampCropRect', () => {
  it('夹紧越界矩形', () => {
    expect(clampCropRect({x: -10, y: -5, w: 500, h: 500}, 100, 80)).toEqual({
      x: 0,
      y: 0,
      w: 100,
      h: 80
    })
  })

  it('w/h 最小为 1', () => {
    expect(clampCropRect({x: 0, y: 0, w: 0, h: -1}, 50, 50)).toEqual({
      x: 0,
      y: 0,
      w: 1,
      h: 1
    })
  })

  it('右下角不越界', () => {
    expect(clampCropRect({x: 90, y: 90, w: 20, h: 20}, 100, 100)).toEqual({
      x: 80,
      y: 80,
      w: 20,
      h: 20
    })
  })

  it('拖动中保留浮点', () => {
    const r = clampCropRect({x: 10.4, y: 20.6, w: 30.2, h: 40.8}, 100, 100)
    expect(r.x).toBeCloseTo(10.4, 5)
    expect(r.y).toBeCloseTo(20.6, 5)
    expect(r.w).toBeCloseTo(30.2, 5)
    expect(r.h).toBeCloseTo(40.8, 5)
  })
})

describe('roundCropRect', () => {
  it('确认时取整并夹紧', () => {
    expect(roundCropRect({x: 10.6, y: 20.4, w: 30.5, h: 40.2}, 100, 100)).toEqual({
      x: 11,
      y: 20,
      w: 31,
      h: 40
    })
  })
})

describe('defaultCropRect', () => {
  it('居中约 80%', () => {
    const r = defaultCropRect(1000, 500)
    expect(r.w).toBe(800)
    expect(r.h).toBe(400)
    expect(r.x).toBe(100)
    expect(r.y).toBe(50)
  })
})

describe('defaultMosaicRect', () => {
  it('居中 50% × 50%', () => {
    const r = defaultMosaicRect(1920, 1080)

    expect(r.w).toBe(960)
    expect(r.h).toBe(540)
    expect(r.x).toBe(480)
    expect(r.y).toBe(270)
  })

  it('极小画面边长至少 2px', () => {
    const r = defaultMosaicRect(10, 8)

    expect(r.w).toBeGreaterThanOrEqual(2)
    expect(r.h).toBeGreaterThanOrEqual(2)
  })
})

describe('applyAspectRatio', () => {
  it('约束为 1:1', () => {
    const r = applyAspectRatio({x: 0, y: 0, w: 200, h: 100}, 1, 400, 400)
    expect(r.w).toBe(r.h)
    expect(r.w).toBeGreaterThan(0)
  })

  it('16:9 不超出画布', () => {
    const r = applyAspectRatio({x: 0, y: 0, w: 1600, h: 900}, 16 / 9, 800, 600)
    expect(r.w).toBeLessThanOrEqual(800)
    expect(r.h).toBeLessThanOrEqual(600)
    expect(Math.abs(r.w / r.h - 16 / 9)).toBeLessThan(0.05)
  })
})

describe('computeContainRect', () => {
  it('横向图左右留白', () => {
    const r = computeContainRect(400, 400, 800, 400)
    expect(r.width).toBe(400)
    expect(r.height).toBe(200)
    expect(r.left).toBe(0)
    expect(r.top).toBe(100)
  })

  it('纵向图上下适应', () => {
    const r = computeContainRect(200, 400, 100, 400)
    expect(r.width).toBe(100)
    expect(r.height).toBe(400)
    expect(r.left).toBe(50)
    expect(r.top).toBe(0)
  })
})
