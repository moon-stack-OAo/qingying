import fs from 'fs'
import path from 'path'
import type {IncomingMessage, ServerResponse} from 'http'
import {isPathInsideAnyRoot} from '../../pathAllowlist'
import {DOWNLOAD_RATE_MAX, lanCtx} from '../context'
import {clientIp, json, requireAuth} from '../httpUtil'
import {lanMediaAllowedRoots} from '../paths'

function guessMime(name: string): string {
  const ext = path.extname(name).toLowerCase()
  const map: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mkv': 'video/x-matroska',
    '.mov': 'video/quicktime',
    '.mp3': 'audio/mpeg',
    '.m4a': 'audio/mp4',
    '.opus': 'audio/opus',
    '.wav': 'audio/wav',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.gif': 'image/gif',
    '.tif': 'image/tiff',
    '.tiff': 'image/tiff'
  }
  return map[ext] || 'application/octet-stream'
}

export function handleDownload(
  req: IncomingMessage,
  res: ServerResponse,
  taskId: string
): void {
  if (!requireAuth(req, res)) return

  const ip = clientIp(req)
  if (!lanCtx.downloadLimiter.tryTake(ip)) {
    json(res, 429, {
      ok: false,
      error: `下载请求过于频繁，请稍后再试（${DOWNLOAD_RATE_MAX} 次 / 分钟）`,
      remaining: 0
    })
    return
  }

  // 防路径穿越：仅允许 map 中的 id
  if (
    !taskId ||
    taskId.includes('..') ||
    taskId.includes('/') ||
    taskId.includes('\\')
  ) {
    json(res, 400, {ok: false, error: '无效任务 ID'})
    return
  }

  const rec = lanCtx.lanTasks.get(taskId)
  if (!rec) {
    json(res, 404, {ok: false, error: '任务不存在'})
    return
  }

  const t = rec.task
  if (t.status !== 'completed' || !t.outputPath) {
    json(res, 400, {ok: false, error: '任务未完成，无法下载'})
    return
  }

  if (!fs.existsSync(t.outputPath)) {
    json(res, 404, {ok: false, error: '输出文件不存在'})
    return
  }

  // 强制输出路径落在 lan-outputs 或当前 settings.outputDir 之下（防路径穿越 / 误配）
  const resolved = path.resolve(t.outputPath)
  if (!isPathInsideAnyRoot(lanMediaAllowedRoots(false), resolved)) {
    json(res, 403, {ok: false, error: '输出路径不在允许目录内'})
    return
  }

  try {
    const st = fs.statSync(resolved)
    if (!st.isFile()) {
      json(res, 404, {ok: false, error: '输出不是文件'})
      return
    }
  } catch {
    json(res, 404, {ok: false, error: '无法读取输出文件'})
    return
  }

  const downloadName = path.basename(resolved)
  const type = guessMime(downloadName)
  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': fs.statSync(resolved).size,
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`
  })
  const stream = fs.createReadStream(resolved)
  stream.pipe(res)
  stream.on('error', () => {
    try {
      res.end()
    } catch {
      // ignore
    }
  })
}
