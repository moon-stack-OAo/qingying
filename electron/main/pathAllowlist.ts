import fs from 'fs'
import path from 'path'

/** 允许的目录（其下子路径均可访问） */
const allowedDirs = new Set<string>()
/** 允许的精确文件路径 */
const allowedFiles = new Set<string>()

/**
 * 规范化路径用于比较：resolve + 去尾部分隔符 + Windows 小写
 */
export function canonicalizePath(p: string): string {
  const raw = (p || '').trim()
  if (!raw) return ''
  let resolved: string
  try {
    resolved = path.resolve(raw)
  } catch {
    return ''
  }
  // 保留盘符根如 C:\ ，其余去掉末尾分隔符
  if (resolved.length > 3) {
    resolved = resolved.replace(/[\\/]+$/, '')
  }
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved
}

function isUnderAllowedDir(targetCanon: string, dirCanon: string): boolean {
  if (!targetCanon || !dirCanon) return false
  if (targetCanon === dirCanon) return true
  const sep = path.sep
  const prefix = dirCanon.endsWith(sep) ? dirCanon : dirCanon + sep
  return targetCanon.startsWith(prefix)
}

/**
 * 判断 target 是否落在 root 目录之内（含 root 自身）
 * 使用 canonicalizePath，避免 Windows 大小写 / 分隔符 / 前缀误判
 */
export function isPathInsideRoot(root: string, target: string): boolean {
  const rootCanon = canonicalizePath(root)
  const targetCanon = canonicalizePath(target)
  if (!rootCanon || !targetCanon) return false
  return isUnderAllowedDir(targetCanon, rootCanon)
}

/**
 * 将 URL 相对路径安全拼接到 public root 下；穿越或非法则返回 null
 * rel 形如 "/index.html" 或 "assets/app.js"
 */
export function safeJoinUnderRoot(root: string, urlPath: string): string | null {
  const rootResolved = path.resolve(root)
  if (!rootResolved) return null
  const clean = String(urlPath || '').split('?')[0].split('#')[0]
  let rel = clean
  try {
    rel = decodeURIComponent(clean)
  } catch {
    return null
  }
  if (rel === '/' || rel === '') rel = '/index.html'
  if (rel.includes('\0')) return null
  // 去掉开头斜杠后相对拼接，再 resolve
  const normalizedRel = rel.replace(/\\/g, '/').replace(/^\/+/, '')
  const joined = path.resolve(rootResolved, normalizedRel)
  if (!isPathInsideRoot(rootResolved, joined)) return null
  return joined
}

/** 登记单个路径：已存在目录→目录；否则→文件并允许其父目录 */
export function allowPath(p: string): void {
  const raw = (p || '').trim()
  if (!raw) return
  const c = canonicalizePath(raw)
  if (!c) return

  try {
    if (fs.existsSync(raw) && fs.statSync(raw).isDirectory()) {
      allowedDirs.add(c)
      return
    }
  } catch {
    // 按文件处理
  }

  allowedFiles.add(c)
  const parent = canonicalizePath(path.dirname(raw))
  if (parent) {
    allowedDirs.add(parent)
  }
}

/** 显式登记为允许目录（不要求已存在） */
export function allowDir(p: string): void {
  const c = canonicalizePath(p)
  if (c) allowedDirs.add(c)
}

export function allowPaths(paths: Iterable<string>): void {
  Array.from(paths).forEach((p) => allowPath(p))
}

/** 路径是否在允许范围内（精确文件或落在允许目录下） */
export function isPathAllowed(p: string): boolean {
  const c = canonicalizePath(p)
  if (!c) return false
  if (allowedFiles.has(c)) return true
  if (allowedDirs.has(c)) return true
  return Array.from(allowedDirs).some((dir) => isUnderAllowedDir(c, dir))
}

export function pathNotAllowedError(label = '路径'): string {
  return `${label}不在允许访问范围内`
}

/** 仅测试用：清空集合 */
export function _resetAllowlistForTests(): void {
  allowedDirs.clear()
  allowedFiles.clear()
}

/** 仅测试用：查看当前规模 */
export function _allowlistSizeForTests(): { dirs: number; files: number } {
  return { dirs: allowedDirs.size, files: allowedFiles.size }
}
