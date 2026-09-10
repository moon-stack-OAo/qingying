import fs from 'fs'
import path from 'path'
import type {IncomingMessage, ServerResponse} from 'http'
import {DOWNLOAD_RATE_MAX, lanCtx} from '../context'
import {clientIp, json, requireAuth} from '../httpUtil'
import {guessLanMime, resolveMediaSourcePath} from '../taskUtil'

function parseRange(
  rangeHeader: string | undefined,
  size: number
): {start: number; end: number} | null | 'invalid' {
  if (!rangeHeader || !rangeHeader.startsWith('bytes=')) return null
  const spec = rangeHeader.slice(6).trim()
  if (!spec || spec.includes(',')) return 'invalid'
  const [startRaw, endRaw] = spec.split('-', 2)
  let start: number
  let end: number
  if (startRaw === '') {
    const suffix = Number(endRaw)
    if (!Number.isFinite(suffix) || suffix <= 0) return 'invalid'
    start = Math.max(0, size - Math.floor(suffix))
    end = size - 1
  } else {
    start = Number(startRaw)
    end = endRaw === '' || endRaw == null ? size - 1 : Number(endRaw)
    if (!Number.isFinite(start) || !Number.isFinite(end)) return 'invalid'
    start = Math.floor(start)
    end = Math.floor(end)
  }
  if (start < 0 || end < start || start >= size) return 'invalid'
  end = Math.min(end, size - 1)
  return {start, end}
}

/**
 * 内联播放媒体流（支持 Range），供 lightbox video/audio 使用。
 * 输出优先；音频任务未完成时允许白名单内输入源。
 */
export function handleMedia(
  req: IncomingMessage,
  res: ServerResponse,
  taskId: string
): void {
  if (!requireAuth(req, res)) return

  const ip = clientIp(req)
  if (!lanCtx.downloadLimiter.tryTake(ip)) {
    json(res, 429, {
      ok: false,
      error: `媒体请求过于频繁，请稍后再试（${DOWNLOAD_RATE_MAX} 次 / 分钟）`,
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

  const resolved = resolveMediaSourcePath(rec.task)
  if (!resolved) {
    const mode = rec.task.options?.mode
    const msg =
      mode === 'audio' && rec.task.status !== 'completed'
        ? '源文件不可用，无法预览'
        : '任务未完成或媒体不可用'
    json(res, 400, {ok: false, error: msg})
    return
  }

  let size = 0
  try {
    const st = fs.statSync(resolved)
    if (!st.isFile()) {
      json(res, 404, {ok: false, error: '媒体不是文件'})
      return
    }
    size = st.size
  } catch {
    json(res, 404, {ok: false, error: '无法读取媒体文件'})
    return
  }

  const fileName = path.basename(resolved)
  const type = guessLanMime(fileName)
  const range = parseRange(req.headers.range, size)

  if (range === 'invalid') {
    res.writeHead(416, {
      'Content-Range': `bytes */${size}`,
      'Accept-Ranges': 'bytes'
    })
    res.end()
    return
  }

  const commonHeaders: Record<string, string | number> = {
    'Content-Type': type,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, max-age=60',
    'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`
  }

  const onStreamError = (stream: fs.ReadStream) => {
    stream.on('error', () => {
      try {
        res.end()
      } catch {
        /* ignore */
      }
    })
  }

  if (!range) {
    res.writeHead(200, {
      ...commonHeaders,
      'Content-Length': size
    })
    const stream = fs.createReadStream(resolved)
    onStreamError(stream)
    stream.pipe(res)
    return
  }

  const {start, end} = range
  const chunkSize = end - start + 1
  res.writeHead(206, {
    ...commonHeaders,
    'Content-Range': `bytes ${start}-${end}/${size}`,
    'Content-Length': chunkSize
  })
  const stream = fs.createReadStream(resolved, {start, end})
  onStreamError(stream)
  stream.pipe(res)
}
