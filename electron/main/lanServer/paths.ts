import fs from 'fs'
import path from 'path'
import {app} from 'electron'
import type {CompressTask} from '../../../shared/types'
import {getSettings} from '../settings'

export function uploadsDir(): string {
  return path.join(app.getPath('userData'), 'lan-uploads')
}

/** 判断路径是否位于 lan-uploads 目录内（防误删用户本地文件） */
export function isUnderLanUploads(filePath: string): boolean {
  if (!filePath || typeof filePath !== 'string') return false
  try {
    const root = path.resolve(uploadsDir())
    const resolved = path.resolve(filePath)
    const rel = path.relative(root, resolved)
    return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel)
  } catch {
    return false
  }
}

/** 任务结束后清理局域网上传源文件（仅 lan-uploads 内） */
export function cleanupLanUploadSource(task: CompressTask): void {
  const candidates = [
    task.inputPath,
    ...(Array.isArray(task.inputPaths) ? task.inputPaths : [])
  ]
  for (const raw of candidates) {
    const p = typeof raw === 'string' ? raw.trim() : ''
    if (!p || !isUnderLanUploads(p)) continue
    try {
      if (fs.existsSync(p) && fs.statSync(p).isFile()) {
        fs.unlinkSync(p)
      }
    } catch (err) {
      console.warn('[lanServer] 清理上传源失败:', path.basename(p), err)
    }
  }
}

export function publicDir(): string {
  // 开发：源码旁 public；打包：与 main 同级 lanServer/public 或 resources
  const candidates = [
    path.join(__dirname, 'public'),
    path.join(__dirname, 'lanServer', 'public'),
    path.join(app.getAppPath(), 'electron', 'main', 'lanServer', 'public'),
    path.join(process.resourcesPath || '', 'lan-web')
  ]
  for (const d of candidates) {
    if (d && fs.existsSync(path.join(d, 'index.html'))) return d
  }
  return path.join(__dirname, 'public')
}

export function ensureUploadsDir(): void {
  const d = uploadsDir()
  if (!fs.existsSync(d)) {
    fs.mkdirSync(d, {recursive: true})
  }
}

/** 局域网可读媒体根：uploads / outputs / 当前 outputDir */
export function lanMediaAllowedRoots(includeUploads: boolean): string[] {
  const roots: string[] = []
  if (includeUploads) {
    roots.push(uploadsDir())
  }
  roots.push(path.join(app.getPath('userData'), 'lan-outputs'))
  const out = getSettings().outputDir?.trim()
  if (out) roots.push(out)
  return roots
}

export function normalizeBindHost(v: unknown): '0.0.0.0' | '127.0.0.1' {
  return v === '127.0.0.1' ? '127.0.0.1' : '0.0.0.0'
}
