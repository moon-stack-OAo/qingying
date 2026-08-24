import { afterEach, describe, expect, it } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { Readable } from 'stream'
import {
  parseBoundary,
  parseMultipartStream,
  sanitizeFileName
} from '../electron/main/lanServer/multipart'

function buildMultipart(
  boundary: string,
  parts: Array<
    | { kind: 'field'; name: string; value: string }
    | {
        kind: 'file'
        name: string
        fileName: string
        mime?: string
        content: Buffer | string
      }
  >
): Buffer {
  const chunks: Buffer[] = []
  for (const p of parts) {
    chunks.push(Buffer.from(`--${boundary}\r\n`))
    if (p.kind === 'field') {
      chunks.push(
        Buffer.from(
          `Content-Disposition: form-data; name="${p.name}"\r\n\r\n${p.value}\r\n`
        )
      )
    } else {
      const mime = p.mime || 'application/octet-stream'
      const body = typeof p.content === 'string' ? Buffer.from(p.content) : p.content
      chunks.push(
        Buffer.from(
          `Content-Disposition: form-data; name="${p.name}"; filename="${p.fileName}"\r\n` +
            `Content-Type: ${mime}\r\n\r\n`
        )
      )
      chunks.push(body)
      chunks.push(Buffer.from('\r\n'))
    }
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`))
  return Buffer.concat(chunks)
}

function readableFrom(buf: Buffer, chunkSize = 32): Readable {
  let offset = 0
  return new Readable({
    read() {
      if (offset >= buf.length) {
        this.push(null)
        return
      }
      const end = Math.min(offset + chunkSize, buf.length)
      this.push(buf.subarray(offset, end))
      offset = end
    }
  })
}

describe('multipart 流式解析', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const d of dirs.splice(0)) {
      try {
        fs.rmSync(d, { recursive: true, force: true })
      } catch {
        // ignore
      }
    }
  })

  function tmpDir(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'qy-mp-'))
    dirs.push(d)
    return d
  }

  it('parseBoundary 解析带引号与无引号', () => {
    expect(parseBoundary('multipart/form-data; boundary=----abc')).toBe('----abc')
    expect(
      parseBoundary('multipart/form-data; boundary="----xyz"; charset=utf-8')
    ).toBe('----xyz')
    expect(parseBoundary('text/plain')).toBeNull()
  })

  it('sanitizeFileName 去除路径与危险字符', () => {
    expect(sanitizeFileName('../../a/b\\c.txt')).toBe('c.txt')
    expect(sanitizeFileName('foo|bar?.mp4')).toBe('foo_bar_.mp4')
    expect(sanitizeFileName('')).toBe('upload.bin')
  })

  it('流式解析字段与文件（小 chunk）', async () => {
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
    const payload = Buffer.alloc(80 * 1024, 0xab)
    const body = buildMultipart(boundary, [
      { kind: 'field', name: 'mode', value: 'compress' },
      {
        kind: 'file',
        name: 'file',
        fileName: 'clip.mp4',
        mime: 'video/mp4',
        content: payload
      },
      { kind: 'field', name: 'presetId', value: 'standard' }
    ])

    const dir = tmpDir()
    const result = await parseMultipartStream(
      readableFrom(body, 17),
      boundary,
      dir,
      10 * 1024 * 1024
    )

    expect(result.fields.mode).toBe('compress')
    expect(result.fields.presetId).toBe('standard')
    expect(result.files).toHaveLength(1)
    expect(result.files[0].fileName).toBe('clip.mp4')
    expect(result.files[0].size).toBe(payload.length)
    expect(result.files[0].mimeType).toBe('video/mp4')
    expect(fs.existsSync(result.files[0].tempPath)).toBe(true)
    expect(fs.readFileSync(result.files[0].tempPath)).toEqual(payload)
  })

  it('超过 maxBytes 时拒绝并清理临时文件', async () => {
    const boundary = '----BoundXYZ'
    const payload = Buffer.alloc(64 * 1024, 1)
    const body = buildMultipart(boundary, [
      {
        kind: 'file',
        name: 'file',
        fileName: 'big.bin',
        content: payload
      }
    ])
    const dir = tmpDir()
    await expect(
      parseMultipartStream(readableFrom(body, 4096), boundary, dir, 8 * 1024)
    ).rejects.toThrow(/上传超过上限/)

    const left = fs.readdirSync(dir)
    expect(left).toEqual([])
  })

  it('boundary 落在 chunk 交界处仍能解析', async () => {
    const boundary = 'Bndry'
    const content = Buffer.from('hello-world-data')
    const body = buildMultipart(boundary, [
      {
        kind: 'file',
        name: 'file',
        fileName: 'a.txt',
        mime: 'text/plain',
        content
      }
    ])
    const dir = tmpDir()
    // 故意用 1 字节 chunk 压测状态机
    const result = await parseMultipartStream(
      readableFrom(body, 1),
      boundary,
      dir
    )
    expect(result.files).toHaveLength(1)
    expect(fs.readFileSync(result.files[0].tempPath).toString()).toBe(
      'hello-world-data'
    )
  })
})
