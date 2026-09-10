import type {IncomingMessage, ServerResponse} from 'http'
import {getSettings} from '../../settings'
import {lanCtx} from '../context'
import {clientIp, json} from '../httpUtil'
import {readJsonBody} from '../multipart'
import {verifyPassword} from '../password'
import {buildSetCookie, parseCookie, SESSION_COOKIE} from '../session'

export async function handleLogin(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const ip = clientIp(req)
  if (lanCtx.loginLimiter.isBlocked(ip)) {
    json(res, 429, {ok: false, error: '登录尝试过多，请稍后再试'})
    return
  }

  let body: unknown
  try {
    body = await readJsonBody(req)
  } catch (e) {
    json(res, 400, {
      ok: false,
      error: e instanceof Error ? e.message : '请求无效'
    })
    return
  }

  const obj =
    body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  const username = typeof obj.username === 'string' ? obj.username.trim() : ''
  const password = typeof obj.password === 'string' ? obj.password : ''
  const pairCode =
    typeof obj.pairCode === 'string'
      ? obj.pairCode
      : typeof obj.pair_code === 'string'
        ? obj.pair_code
        : ''

  const settings = getSettings()
  if (!settings.lanPasswordHash) {
    json(res, 503, {ok: false, error: '服务端未设置密码'})
    return
  }

  const userOk = username === (settings.lanUsername || 'admin')
  const passOk = userOk && verifyPassword(password, settings.lanPasswordHash)

  if (!passOk) {
    lanCtx.loginLimiter.recordFail(ip)
    json(res, 401, {
      ok: false,
      error: '用户名或密码错误',
      remaining: lanCtx.loginLimiter.remaining(ip)
    })
    return
  }

  // 绑定局域网时额外校验桌面显示的配对码（降低明文 HTTP 撞密/嗅探后直接滥用）
  if (lanCtx.listenHost === '0.0.0.0') {
    lanCtx.pairCodes.ensure()
    if (!lanCtx.pairCodes.verify(pairCode)) {
      lanCtx.loginLimiter.recordFail(ip)
      const expired = !lanCtx.pairCodes.peek()
      json(res, 401, {
        ok: false,
        error: expired
          ? '配对码已过期，请在电脑版轻影设置中刷新后重试'
          : '配对码错误，请在电脑版轻影「设置 → 远程访问」中查看',
        code: expired ? 'PAIR_CODE_EXPIRED' : 'PAIR_CODE_INVALID',
        remaining: lanCtx.loginLimiter.remaining(ip)
      })
      return
    }
  }

  lanCtx.loginLimiter.reset(ip)
  const sess = lanCtx.sessions.create(username)
  json(
    res,
    200,
    {ok: true, username: sess.username},
    {
      'Set-Cookie': buildSetCookie(SESSION_COOKIE, sess.id)
    }
  )
}

export function handleLogout(req: IncomingMessage, res: ServerResponse): void {
  const sid = parseCookie(req.headers.cookie, SESSION_COOKIE)
  lanCtx.sessions.destroy(sid)
  json(
    res,
    200,
    {ok: true},
    {'Set-Cookie': buildSetCookie(SESSION_COOKIE, '', {clear: true})}
  )
}
