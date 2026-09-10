import type {IncomingMessage, ServerResponse} from 'http'
import {extractVideoFrameJpeg} from '../../ffmpeg'
import {getImageJpegBuffer} from '../../image'
import {
  LAN_PREVIEW_MAX_EDGE,
  LAN_THUMB_MAX_EDGE,
  lanCtx,
  THUMB_RATE_MAX
} from '../context'
import {clientIp, json, requireAuth} from '../httpUtil'
import {
  isImageExt,
  isVideoExt,
  resolveThumbSourcePath
} from '../taskUtil'

function parseThumbEdge(req: IncomingMessage, fallback: number): number {
  try {
    const u = new URL(req.url || '/', 'http://localhost')
    const raw = u.searchParams.get('edge')
    if (raw == null || raw === '') return fallback
    const n = Number(raw)
    if (!Number.isFinite(n)) return fallback
    return Math.max(64, Math.min(LAN_PREVIEW_MAX_EDGE, Math.floor(n)))
  } catch {
    return fallback
  }
}

export async function handleThumbnail(
  req: IncomingMessage,
  res: ServerResponse,
  taskId: string
): Promise<void> {
  if (!requireAuth(req, res)) return

  const ip = clientIp(req)
  if (!lanCtx.thumbLimiter.tryTake(ip)) {
    json(res, 429, {
      ok: false,
      error: `缩略图请求过于频繁，请稍后再试（${THUMB_RATE_MAX} 次 / 分钟）`,
      remaining: 0
    })
    return
  }

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
  if (t.options?.mode === 'audio') {
    json(res, 404, {ok: false, error: '音频任务无缩略图'})
    return
  }

  const src = resolveThumbSourcePath(t)
  if (!src) {
    json(res, 404, {ok: false, error: '源文件不可用'})
    return
  }

  const edge = parseThumbEdge(req, LAN_THUMB_MAX_EDGE)

  try {
    let buffer: Buffer | undefined
    if (isImageExt(src)) {
      const r = await getImageJpegBuffer(src, edge)
      if (!r.ok || !r.buffer) {
        json(res, 500, {ok: false, error: r.error || '生成缩略图失败'})
        return
      }
      buffer = r.buffer
    } else if (isVideoExt(src)) {
      const r = await extractVideoFrameJpeg({
        path: src,
        timeSec: 1,
        maxEdge: edge
      })
      if (!r.ok || !r.buffer) {
        json(res, 500, {ok: false, error: r.error || '抽帧失败'})
        return
      }
      buffer = r.buffer
    } else {
      json(res, 404, {ok: false, error: '不支持的媒体类型'})
      return
    }

    res.writeHead(200, {
      'Content-Type': 'image/jpeg',
      'Content-Length': buffer.length,
      'Cache-Control': 'private, max-age=300'
    })
    res.end(buffer)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (!res.headersSent) {
      json(res, 500, {ok: false, error: msg || '生成缩略图失败'})
    }
  }
}
