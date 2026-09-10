/**
 * 纯路径小工具（无 Node `path` / fs），可供 preload 与渲染进程复用。
 */

/** 取路径末段文件名（兼容 Windows / Unix / UNC） */
export function pathBasename(filePath: string): string {
  const normalized = String(filePath || '').replace(/\\/g, '/')
  const parts = normalized.split('/').filter(Boolean)
  return parts[parts.length - 1] || filePath
}

/**
 * 是否看起来像 UNC（`\\server\share` / `//server/share`）。
 * 用于避免对网络路径做同步 `existsSync`（会卡死主进程）。
 */
export function isUncPath(p: string): boolean {
  const raw = String(p || '').trim()
  if (!raw) return false
  return /^[\\/]{2}/.test(raw)
}

/**
 * `file:///C:/a/b.mp4` 或 `file:///C%3A/...` → Windows 本地路径观感。
 * 非 file: URL 返回空串。
 */
export function fileUrlToPath(url: string): string {
  const raw = String(url || '').trim()
  if (!raw || !/^file:/i.test(raw)) return ''
  try {
    const u = new URL(raw)
    let p = decodeURIComponent(u.pathname || '')
    // Windows: /C:/Users/... → C:/Users/...
    if (/^\/[A-Za-z]:\//.test(p)) {
      p = p.slice(1)
    }
    return p.replace(/\//g, '\\')
  } catch {
    return ''
  }
}
