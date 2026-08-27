/** 原图像素裁切矩形 */
export interface CropRect {
  x: number
  y: number
  w: number
  h: number
}

/**
 * 显示坐标 → 原图像素（浮点，拖动中避免 round 抖动）
 * 显示区域为图片 contain 后的实际绘制区尺寸
 */
export function displayToNatural(
  dx: number,
  dy: number,
  dispW: number,
  dispH: number,
  natW: number,
  natH: number
): { x: number; y: number } {
  if (
    !(dispW > 0) ||
    !(dispH > 0) ||
    !(natW > 0) ||
    !(natH > 0) ||
    !Number.isFinite(dx) ||
    !Number.isFinite(dy)
  ) {
    return { x: 0, y: 0 }
  }
  return {
    x: (dx / dispW) * natW,
    y: (dy / dispH) * natH
  }
}

/** 原图像素 → 显示坐标（浮点） */
export function naturalToDisplay(
  nx: number,
  ny: number,
  dispW: number,
  dispH: number,
  natW: number,
  natH: number
): { x: number; y: number } {
  if (
    !(dispW > 0) ||
    !(dispH > 0) ||
    !(natW > 0) ||
    !(natH > 0) ||
    !Number.isFinite(nx) ||
    !Number.isFinite(ny)
  ) {
    return { x: 0, y: 0 }
  }
  return {
    x: (nx / natW) * dispW,
    y: (ny / natH) * dispH
  }
}

/** 将裁切矩形夹紧到原图范围内（浮点）；w/h 最小为 1 */
export function clampCropRect(
  rect: CropRect,
  natW: number,
  natH: number
): CropRect {
  const maxW = Math.max(1, Number(natW) || 1)
  const maxH = Math.max(1, Number(natH) || 1)
  let w = Number(rect.w)
  let h = Number(rect.h)
  let x = Number(rect.x)
  let y = Number(rect.y)

  if (!Number.isFinite(w) || w < 1) w = 1
  if (!Number.isFinite(h) || h < 1) h = 1
  if (!Number.isFinite(x) || x < 0) x = 0
  if (!Number.isFinite(y) || y < 0) y = 0

  w = Math.min(w, maxW)
  h = Math.min(h, maxH)
  x = Math.min(x, maxW - w)
  y = Math.min(y, maxH - h)
  x = Math.max(0, x)
  y = Math.max(0, y)

  return { x, y, w, h }
}

/** 确认/落盘时取整像素 */
export function roundCropRect(rect: CropRect, natW: number, natH: number): CropRect {
  return clampCropRect(
    {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      w: Math.round(rect.w),
      h: Math.round(rect.h)
    },
    Math.max(1, Math.floor(natW)),
    Math.max(1, Math.floor(natH))
  )
}

/**
 * 默认裁切：居中约 80% 区域；图过小时取全图
 */
export function defaultCropRect(natW: number, natH: number): CropRect {
  const maxW = Math.max(1, Math.floor(natW))
  const maxH = Math.max(1, Math.floor(natH))
  const w = Math.max(1, Math.round(maxW * 0.8))
  const h = Math.max(1, Math.round(maxH * 0.8))
  const x = Math.max(0, Math.round((maxW - w) / 2))
  const y = Math.max(0, Math.round((maxH - h) / 2))
  return clampCropRect({ x, y, w, h }, maxW, maxH)
}

/**
 * 默认打码框：画面正中约 50% × 50%；边长至少 2px（打码滤镜下限）
 */
export function defaultMosaicRect(natW: number, natH: number): CropRect {
  const maxW = Math.max(1, Math.floor(natW))
  const maxH = Math.max(1, Math.floor(natH))
  const w = Math.max(2, Math.min(maxW, Math.round(maxW * 0.5)))
  const h = Math.max(2, Math.min(maxH, Math.round(maxH * 0.5)))
  const x = Math.max(0, Math.round((maxW - w) / 2))
  const y = Math.max(0, Math.round((maxH - h) / 2))
  return clampCropRect({ x, y, w, h }, maxW, maxH)
}

/**
 * 按宽高比约束矩形（以当前中心为锚，尽量贴近目标 w/h）
 * aspectRatio = w/h，如 16/9
 */
export function applyAspectRatio(
  rect: CropRect,
  aspectRatio: number,
  natW: number,
  natH: number
): CropRect {
  if (!(aspectRatio > 0) || !Number.isFinite(aspectRatio)) {
    return clampCropRect(rect, natW, natH)
  }
  const maxW = Math.max(1, Math.floor(natW))
  const maxH = Math.max(1, Math.floor(natH))
  let w = Math.max(1, Math.round(rect.w))
  let h = Math.max(1, Math.round(rect.h))
  const cx = rect.x + rect.w / 2
  const cy = rect.y + rect.h / 2

  // 以较大边为基准，再夹紧
  if (w / h > aspectRatio) {
    h = Math.max(1, Math.round(w / aspectRatio))
  } else {
    w = Math.max(1, Math.round(h * aspectRatio))
  }

  // 若超出画布，按能放下的最大尺寸缩放
  if (w > maxW) {
    w = maxW
    h = Math.max(1, Math.round(w / aspectRatio))
  }
  if (h > maxH) {
    h = maxH
    w = Math.max(1, Math.round(h * aspectRatio))
  }
  if (w > maxW) {
    w = maxW
    h = Math.max(1, Math.round(w / aspectRatio))
    if (h > maxH) h = maxH
  }

  let x = Math.round(cx - w / 2)
  let y = Math.round(cy - h / 2)
  return clampCropRect({ x, y, w, h }, maxW, maxH)
}

/** 计算 contain 后图片在容器内的绘制矩形 */
export function computeContainRect(
  containerW: number,
  containerH: number,
  natW: number,
  natH: number
): { left: number; top: number; width: number; height: number } {
  if (
    !(containerW > 0) ||
    !(containerH > 0) ||
    !(natW > 0) ||
    !(natH > 0)
  ) {
    return { left: 0, top: 0, width: 0, height: 0 }
  }
  const scale = Math.min(containerW / natW, containerH / natH)
  const width = Math.max(1, natW * scale)
  const height = Math.max(1, natH * scale)
  const left = (containerW - width) / 2
  const top = (containerH - height) / 2
  return { left, top, width, height }
}
