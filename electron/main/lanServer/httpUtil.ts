import type {IncomingMessage, ServerResponse} from 'http'
import {lanCtx} from './context'
import {parseCookie, SESSION_COOKIE} from './session'

export function json(
  res: ServerResponse,
  status: number,
  body: unknown,
  extraHeaders?: Record<string, string>
): void {
  const data = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data),
    ...extraHeaders
  })
  res.end(data)
}

/**
 * 规范化 socket 地址：去掉 IPv6 mapped 前缀（::ffff:127.0.0.1 → 127.0.0.1）
 * 默认不信任 X-Forwarded-For（直连服务可被伪造绕过限流）
 */
export function normalizeRemoteAddress(addr: string | undefined | null): string {
  if (!addr || typeof addr !== 'string') return 'unknown'
  let ip = addr.trim()
  if (ip.startsWith('::ffff:')) {
    ip = ip.slice(7)
  }
  return ip || 'unknown'
}

export function clientIp(req: IncomingMessage): string {
  // 仅使用 TCP 对端地址；不读取 X-Forwarded-For
  return normalizeRemoteAddress(req.socket.remoteAddress)
}

export function getSession(req: IncomingMessage) {
  const sid = parseCookie(req.headers.cookie, SESSION_COOKIE)
  return lanCtx.sessions.get(sid)
}

export function requireAuth(req: IncomingMessage, res: ServerResponse): boolean {
  const sess = getSession(req)
  if (!sess) {
    json(res, 401, {ok: false, error: '未登录'})
    return false
  }
  return true
}
