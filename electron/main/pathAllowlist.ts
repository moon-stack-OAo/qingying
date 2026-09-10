import fs from 'fs'
import path from 'path'
import { isUncPath } from '../../shared/pathUtils'

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

/** 看起来像目录：末尾分隔符，或无扩展名且非 UNC 文件启发式 */
function looksLikeDirectory(raw: string): boolean {
  if (/[\\/]$/.test(raw)) return true
  const base = path.basename(raw)
  // 有扩展名多半是文件；勿对 UNC 做 existsSync（会卡死）
  if (base.includes('.')) return false
  return false
}

/**
 * 登记单个路径：已存在目录→目录；否则→**仅精确文件**。
 *
 * 不再连带 `allowedDirs.add(parent)`。sidecar / 打开输出须由调用方
 * `allowPath` / `allowOutputPath` 显式登记计划或实际输出路径；
 * 选目录、settings.outputDir、userData 种子仍走 `allowDir` 整树放行。
 *
 * 同目录未选中邻接文件的 IMAGE_GET_* / OPEN_PATH 会失败——属预期收紧。
 */
export function allowPath(p: string): void {
  const raw = (p || '').trim()
  if (!raw) return
  const c = canonicalizePath(raw)
  if (!c) return

  const isUnc = isUncPath(raw) || isUncPath(c)
  if (!isUnc) {
    try {
      if (fs.existsSync(raw) && fs.statSync(raw).isDirectory()) {
        allowedDirs.add(c)
        return
      }
    } catch {
      // 按文件处理
    }
  } else if (looksLikeDirectory(raw)) {
    allowedDirs.add(c)
    return
  }

  allowedFiles.add(c)
}

/**
 * 显式登记计划/实际输出文件（与 allowPath 对文件语义相同，命名更清晰）。
 * 不放开父目录。
 */
export function allowOutputPath(p: string): void {
  allowPath(p)
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

/**
 * 是否可将 output 作为「与已允许输入同父目录的旁路输出」登记。
 * 仅比较规范化后的 dirname；不放开整目录。
 */
export function canAllowSidecarOutput(
  inputPath: string,
  outputPath: string
): boolean {
  const input = (inputPath || '').trim()
  const output = (outputPath || '').trim()
  if (!input || !output) return false
  if (!isPathAllowed(input)) return false
  const inDir = canonicalizePath(path.dirname(input))
  const outDir = canonicalizePath(path.dirname(output))
  return !!inDir && !!outDir && inDir === outDir
}

/**
 * IMAGE_PROCESS 等场景：若输出尚未允许，尝试按 sidecar 策略登记精确输出文件。
 * @returns true 表示输出已允许（原本就允许，或已成功登记）
 */
export function ensureOutputPathAllowed(
  outputPath: string,
  allowedInputs: Iterable<string>
): boolean {
  const out = (outputPath || '').trim()
  if (!out) return true
  if (isPathAllowed(out)) return true
  for (const input of Array.from(allowedInputs)) {
    if (canAllowSidecarOutput(input, out)) {
      allowOutputPath(out)
      return true
    }
  }
  return false
}

export function pathNotAllowedError(label = '路径'): string {
  return `${label}不在允许访问范围内`
}

/**
 * 判断 SETTINGS_SET 是否可持久化新的 outputDir。
 * 允许：清空；与当前已信任设置相同；或路径已在本会话白名单内（如 SELECT_DIR 刚登记）。
 * 禁止：渲染进程写入任意新路径以在下次启动时扩大白名单。
 */
export function isAllowedOutputDirForPersist(
  nextDir: string,
  currentTrustedDir: string
): boolean {
  const next = (nextDir || '').trim()
  if (!next) return true
  const cur = (currentTrustedDir || '').trim()
  if (cur && canonicalizePath(next) === canonicalizePath(cur)) return true
  return isPathAllowed(next)
}

/**
 * 判断 SET_DATA_DIR 是否可接受新的数据目录。
 * 允许：与当前 userData 相同（无操作）；或路径已在本会话白名单内（如 SELECT_DIR 刚登记）。
 */
export function isAllowedDataDirForSet(
  nextDir: string,
  currentUserDataDir: string
): boolean {
  const next = (nextDir || '').trim()
  if (!next) return false
  const cur = (currentUserDataDir || '').trim()
  if (cur && canonicalizePath(next) === canonicalizePath(cur)) return true
  return isPathAllowed(next)
}

/** target 是否落在任一 root 之下（空 root 忽略） */
export function isPathInsideAnyRoot(
  roots: Iterable<string>,
  target: string
): boolean {
  const t = (target || '').trim()
  if (!t) return false
  return Array.from(roots).some((root) => {
    const r = (root || '').trim()
    return !!r && isPathInsideRoot(r, t)
  })
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
