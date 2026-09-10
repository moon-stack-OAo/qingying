import fs from 'fs'
import path from 'path'
import type {IncomingMessage, ServerResponse} from 'http'
import {safeJoinUnderRoot} from '../../pathAllowlist'
import {publicDir} from '../paths'

function safeJoinPublic(urlPath: string): string | null {
  // 使用 relative / canonicalize，避免 startsWith 前缀误判（如 root 为 /pub 时误放行 /public）
  return safeJoinUnderRoot(publicDir(), urlPath)
}

export function serveStatic(req: IncomingMessage, res: ServerResponse): void {
  const url = req.url || '/'
  const filePath = safeJoinPublic(url)
  if (!filePath) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }

  let target = filePath
  if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) {
    const index = path.join(publicDir(), 'index.html')
    if (fs.existsSync(index)) {
      target = index
    } else {
      res.writeHead(404)
      res.end('Not Found')
      return
    }
  }

  const ext = path.extname(target).toLowerCase()
  const types: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.json': 'application/json'
  }
  try {
    const data = fs.readFileSync(target)
    res.writeHead(200, {
      'Content-Type': types[ext] || 'application/octet-stream',
      'Content-Length': data.length
    })
    res.end(data)
  } catch {
    res.writeHead(404)
    res.end('Not Found')
  }
}
