import { randomBytes } from 'crypto'
import fs from 'fs'
import path from 'path'
import type { IncomingMessage } from 'http'
import { Readable } from 'stream'

/** 上传大小上限：512MB */
export const MAX_UPLOAD_BYTES = 512 * 1024 * 1024

export interface MultipartFile {
  fieldName: string
  fileName: string
  mimeType: string
  tempPath: string
  size: number
}

export interface MultipartResult {
  fields: Record<string, string>
  files: MultipartFile[]
}

/**
 * 从 Content-Type 解析 multipart boundary
 */
export function parseBoundary(contentType: string | undefined): string | null {
  if (!contentType) return null
  const m = /boundary\s*=\s*(?:"([^"]+)"|([^;\s]+))/i.exec(contentType)
  if (!m) return null
  return m[1] || m[2] || null
}

/** 去掉路径穿越与危险字符，仅保留文件名 */
export function sanitizeFileName(name: string): string {
  const base = path.basename(name.replace(/\\/g, '/'))
  const cleaned = base.replace(/[<>:"|?*\x00-\x1f]/g, '_').trim()
  if (!cleaned || cleaned === '.' || cleaned === '..') {
    return 'upload.bin'
  }
  if (cleaned.length > 180) {
    const ext = path.extname(cleaned)
    const stem = cleaned.slice(0, 180 - ext.length)
    return stem + ext
  }
  return cleaned
}

function safeUnlink(p: string): void {
  try {
    if (p && fs.existsSync(p)) fs.unlinkSync(p)
  } catch {
    // ignore
  }
}

function parsePartHeaders(headerText: string): {
  fieldName: string
  fileName: string | null
  mimeType: string
} | null {
  const disp = /Content-Disposition:\s*form-data;\s*(.+)/i.exec(headerText)
  if (!disp) return null
  const nameMatch = /name="([^"]+)"/i.exec(disp[1])
  if (!nameMatch) return null
  const fieldName = nameMatch[1]
  const fileMatch = /filename="([^"]*)"/i.exec(disp[1])
  const mimeMatch = /Content-Type:\s*([^\r\n]+)/i.exec(headerText)
  const mimeType = mimeMatch ? mimeMatch[1].trim() : 'application/octet-stream'
  const fileName =
    fileMatch && fileMatch[1] !== undefined ? fileMatch[1] : null
  return { fieldName, fileName, mimeType }
}

/**
 * 简易 multipart/form-data 流式解析：边读边写盘，不把整包 body 拼进内存
 * 仅支持常见浏览器上传形态
 */
export async function parseMultipart(
  req: IncomingMessage,
  uploadDir: string,
  maxBytes = MAX_UPLOAD_BYTES
): Promise<MultipartResult> {
  const contentType = req.headers['content-type']
  const boundary = parseBoundary(
    typeof contentType === 'string' ? contentType : undefined
  )
  if (!boundary) {
    throw new Error('缺少 multipart boundary')
  }

  const contentLength = req.headers['content-length']
  if (typeof contentLength === 'string') {
    const n = Number(contentLength)
    if (Number.isFinite(n) && n > maxBytes) {
      req.resume()
      throw new Error(`上传超过上限 ${Math.floor(maxBytes / (1024 * 1024))}MB`)
    }
  }

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true })
  }

  return parseMultipartStream(req, boundary, uploadDir, maxBytes)
}

type Phase = 'open' | 'headers' | 'body' | 'after-boundary' | 'done'

type ActivePart = {
  fieldName: string
  fileName: string | null
  mimeType: string
  isFile: boolean
  tempPath: string
  writeStream: fs.WriteStream | null
  size: number
  fieldChunks: Buffer[]
}

/**
 * 按 chunk 状态机解析 multipart；文件部分直接落盘
 * 导出供单测注入 Readable
 */
export function parseMultipartStream(
  stream: Readable,
  boundary: string,
  uploadDir: string,
  maxBytes = MAX_UPLOAD_BYTES
): Promise<MultipartResult> {
  // 形态：--boundary\r\n headers \r\n\r\n body \r\n--boundary\r\n ... --boundary--
  const openBoundary = Buffer.from(`--${boundary}`)
  const closeBoundary = Buffer.from(`\r\n--${boundary}`)
  const crlfHeaders = Buffer.from('\r\n\r\n')
  const holdBack = closeBoundary.length

  const fields: Record<string, string> = {}
  const files: MultipartFile[] = []
  const tempPaths: string[] = []

  let totalBytes = 0
  let buffer = Buffer.alloc(0)
  let phase: Phase = 'open'
  let part: ActivePart | null = null

  const limitError = (): Error =>
    new Error(`上传超过上限 ${Math.floor(maxBytes / (1024 * 1024))}MB`)

  const cleanupTemps = (): void => {
    for (const p of tempPaths) safeUnlink(p)
    tempPaths.length = 0
  }

  const endWriteStream = (ws: fs.WriteStream | null): Promise<void> =>
    new Promise((resolve) => {
      if (!ws || ws.destroyed) {
        resolve()
        return
      }
      ws.end(() => resolve())
      ws.once('error', () => resolve())
    })

  const writeAll = (ws: fs.WriteStream, data: Buffer): Promise<void> =>
    new Promise((resolve, reject) => {
      if (data.length === 0) {
        resolve()
        return
      }
      ws.write(data, (err) => (err ? reject(err) : resolve()))
    })

  const finishPart = async (body: Buffer): Promise<void> => {
    if (!part) return
    if (part.isFile) {
      if (part.writeStream) {
        await writeAll(part.writeStream, body)
        part.size += body.length
        await endWriteStream(part.writeStream)
        part.writeStream = null
      }
      files.push({
        fieldName: part.fieldName,
        fileName: sanitizeFileName(part.fileName || 'upload.bin'),
        mimeType: part.mimeType,
        tempPath: part.tempPath,
        size: part.size
      })
    } else {
      if (body.length > 0) part.fieldChunks.push(body)
      fields[part.fieldName] = Buffer.concat(part.fieldChunks).toString('utf8')
    }
    part = null
  }

  const appendBody = async (data: Buffer): Promise<void> => {
    if (!part || data.length === 0) return
    if (part.isFile) {
      if (!part.writeStream) throw new Error('写入流未初始化')
      await writeAll(part.writeStream, data)
      part.size += data.length
    } else {
      part.fieldChunks.push(data)
    }
  }

  const beginPart = (headerBuf: Buffer): void => {
    const parsed = parsePartHeaders(headerBuf.toString('utf8'))
    if (!parsed) throw new Error('无效的 multipart part 头')
    const isFile = parsed.fileName !== null
    let tempPath = ''
    let writeStream: fs.WriteStream | null = null
    if (isFile) {
      const safeBase = sanitizeFileName(parsed.fileName || 'upload.bin')
      tempPath = path.join(
        uploadDir,
        `${Date.now()}-${randomBytes(6).toString('hex')}-${safeBase}`
      )
      tempPaths.push(tempPath)
      writeStream = fs.createWriteStream(tempPath)
    }
    part = {
      fieldName: parsed.fieldName,
      fileName: parsed.fileName,
      mimeType: parsed.mimeType,
      isFile,
      tempPath,
      writeStream,
      size: 0,
      fieldChunks: []
    }
  }

  /** 处理已读到的 `--boundary` 之后的后缀（`--` 结束 或 `\r\n` 下一 part） */
  const handleAfterBoundary = (): 'need-more' | 'continue' | 'done' => {
    if (buffer.length < 2) return 'need-more'
    if (buffer[0] === 0x2d && buffer[1] === 0x2d) {
      phase = 'done'
      buffer = Buffer.alloc(0)
      return 'done'
    }
    if (buffer[0] === 0x0d && buffer[1] === 0x0a) {
      buffer = buffer.subarray(2)
      phase = 'headers'
      return 'continue'
    }
    throw new Error('multipart 分隔符后格式无效')
  }

  /**
   * 尽量消费 buffer；返回是否已结束
   */
  const consume = async (): Promise<boolean> => {
    while (phase !== 'done') {
      if (phase === 'open') {
        const idx = buffer.indexOf(openBoundary)
        if (idx < 0) {
          if (buffer.length > openBoundary.length) {
            buffer = buffer.subarray(buffer.length - openBoundary.length)
          }
          return false
        }
        buffer = buffer.subarray(idx + openBoundary.length)
        phase = 'after-boundary'
        continue
      }

      if (phase === 'after-boundary') {
        const r = handleAfterBoundary()
        if (r === 'need-more') return false
        if (r === 'done') return true
        continue
      }

      if (phase === 'headers') {
        const headerEnd = buffer.indexOf(crlfHeaders)
        if (headerEnd < 0) {
          if (buffer.length > 64 * 1024) {
            throw new Error('multipart 头部过大')
          }
          return false
        }
        const headerBuf = buffer.subarray(0, headerEnd)
        buffer = buffer.subarray(headerEnd + 4)
        beginPart(headerBuf)
        phase = 'body'
        continue
      }

      if (phase === 'body') {
        const idx = buffer.indexOf(closeBoundary)
        if (idx < 0) {
          if (buffer.length > holdBack) {
            const flush = buffer.subarray(0, buffer.length - holdBack)
            buffer = buffer.subarray(buffer.length - holdBack)
            await appendBody(flush)
          }
          return false
        }
        const bodyChunk = buffer.subarray(0, idx)
        buffer = buffer.subarray(idx + closeBoundary.length)
        await finishPart(bodyChunk)
        phase = 'after-boundary'
        continue
      }

      return false
    }
    return true
  }

  return new Promise((resolve, reject) => {
    let settled = false
    let chain: Promise<void> = Promise.resolve()

    const fail = (err: Error): void => {
      if (settled) return
      settled = true
      stream.destroy()
      const ws = part?.writeStream ?? null
      part = null
      void endWriteStream(ws).then(() => {
        cleanupTemps()
        reject(err)
      })
    }

    const succeed = (): void => {
      if (settled) return
      settled = true
      const keep = new Set(files.map((f) => f.tempPath))
      for (let i = tempPaths.length - 1; i >= 0; i--) {
        if (keep.has(tempPaths[i])) tempPaths.splice(i, 1)
      }
      cleanupTemps()
      resolve({ fields, files })
    }

    stream.on('data', (chunk: Buffer | string) => {
      if (settled) return
      const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk
      totalBytes += buf.length
      if (totalBytes > maxBytes) {
        fail(limitError())
        return
      }
      chain = chain
        .then(async () => {
          if (settled) return
          buffer = Buffer.concat([buffer, buf])
          if (await consume()) succeed()
        })
        .catch((e: unknown) => {
          fail(e instanceof Error ? e : new Error(String(e)))
        })
    })

    stream.on('end', () => {
      chain = chain
        .then(async () => {
          if (settled) return
          if (await consume()) {
            succeed()
            return
          }
          // 流结束仍在 body：把剩余当作最后 part（无收尾 boundary 的宽松处理）
          if (phase === 'body' && part) {
            await finishPart(buffer)
            buffer = Buffer.alloc(0)
            phase = 'done'
            succeed()
            return
          }
          if (files.length > 0 || Object.keys(fields).length > 0) {
            phase = 'done'
            succeed()
            return
          }
          throw new Error('multipart 数据不完整')
        })
        .catch((e: unknown) => {
          fail(e instanceof Error ? e : new Error(String(e)))
        })
    })

    stream.on('error', (err) => {
      fail(err instanceof Error ? err : new Error(String(err)))
    })
  })
}

function readBodyWithLimit(
  req: IncomingMessage,
  maxBytes: number
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let total = 0
    let aborted = false

    const onData = (chunk: Buffer | string): void => {
      if (aborted) return
      const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk
      total += buf.length
      if (total > maxBytes) {
        aborted = true
        req.removeListener('data', onData)
        req.destroy()
        reject(
          new Error(`上传超过上限 ${Math.floor(maxBytes / (1024 * 1024))}MB`)
        )
        return
      }
      chunks.push(buf)
    }

    req.on('data', onData)
    req.on('end', () => {
      if (aborted) return
      resolve(Buffer.concat(chunks))
    })
    req.on('error', (err) => {
      if (!aborted) reject(err)
    })
  })
}

/**
 * 读取 JSON body（有上限；小请求仍整包缓冲）
 */
export async function readJsonBody(
  req: IncomingMessage,
  maxBytes = 64 * 1024
): Promise<unknown> {
  const raw = await readBodyWithLimit(req, maxBytes)
  if (raw.length === 0) return {}
  try {
    return JSON.parse(raw.toString('utf8')) as unknown
  } catch {
    throw new Error('无效 JSON')
  }
}

/** 将可读流写入文件 */
export function streamToFile(
  stream: Readable,
  filePath: string
): Promise<number> {
  return new Promise((resolve, reject) => {
    const ws = fs.createWriteStream(filePath)
    let size = 0
    stream.on('data', (c: Buffer) => {
      size += c.length
    })
    stream.pipe(ws)
    ws.on('finish', () => resolve(size))
    ws.on('error', reject)
    stream.on('error', reject)
  })
}
