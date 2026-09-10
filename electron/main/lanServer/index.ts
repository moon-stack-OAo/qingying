import http, {type IncomingMessage, type ServerResponse} from 'http'
import os from 'os'
import type {LanRemoteConfigInput, LanStatus} from '../../../shared/types'
import {getSettings, saveSettings} from '../settings'
import {DEFAULT_LAN_PORT, lanCtx} from './context'
import {handleLogin, handleLogout} from './handlers/auth'
import {handleDownload} from './handlers/download'
import {serveStatic} from './handlers/static'
import {handleStatus} from './handlers/status'
import {handleCreateTask, handleListTasks} from './handlers/tasks'
import {handleThumbnail} from './handlers/thumbnail'
import {json} from './httpUtil'
import {ensureUploadsDir, normalizeBindHost} from './paths'
import {hashPassword, validateLanPassword} from './password'
import {attachQueueListener} from './taskUtil'

export {DEFAULT_LAN_PORT}

function runningBindOrSetting(
  settingHost: unknown
): '0.0.0.0' | '127.0.0.1' {
  if (lanCtx.server != null && lanCtx.listenPort > 0) return lanCtx.listenHost
  return normalizeBindHost(settingHost)
}

/** 本机局域网 IPv4 地址 */
export function getLanAddresses(): string[] {
  const addrs: string[] = []
  try {
    const ifaces = os.networkInterfaces()
    for (const list of Object.values(ifaces)) {
      if (!list) continue
      for (const info of list) {
        if (info.family === 'IPv4' && !info.internal) {
          addrs.push(info.address)
        }
      }
    }
  } catch {
    // ignore
  }
  if (addrs.length === 0) addrs.push('127.0.0.1')
  return addrs
}

export function getLanStatus(): LanStatus {
  const s = getSettings()
  const port = s.lanPort || DEFAULT_LAN_PORT
  const bindHost = runningBindOrSetting(s.lanBindHost)
  const running = lanCtx.server != null && lanCtx.listenPort > 0
  const activePort = running ? lanCtx.listenPort : port
  // 仅本机绑定时只暴露 loopback；局域网绑定则列出网卡地址
  const urls =
    bindHost === '127.0.0.1'
      ? [`http://127.0.0.1:${activePort}`]
      : getLanAddresses().map((ip) => `http://${ip}:${activePort}`)
  const pairRequired = bindHost === '0.0.0.0'
  const pair = pairRequired && running ? lanCtx.pairCodes.ensure() : null
  return {
    enabled: Boolean(s.lanRemoteEnabled),
    running,
    port: activePort,
    bindHost,
    username: s.lanUsername || 'admin',
    hasPassword: Boolean(s.lanPasswordHash),
    urls,
    error: lanCtx.lastError,
    pairCode: pair?.code ?? null,
    pairCodeExpiresAt: pair?.expiresAt ?? null,
    pairCodeRequired: pairRequired
  }
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  // 局域网页与 API 同源（本机静态资源 + Cookie SameSite=Lax），不提供 CORS
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Cache-Control', 'no-store')

  const method = (req.method || 'GET').toUpperCase()
  const url = req.url || '/'
  const pathOnly = url.split('?')[0]

  try {
    if (pathOnly === '/api/status' && method === 'GET') {
      handleStatus(req, res)
      return
    }
    if (pathOnly === '/api/login' && method === 'POST') {
      await handleLogin(req, res)
      return
    }
    if (pathOnly === '/api/logout' && method === 'POST') {
      handleLogout(req, res)
      return
    }
    if (pathOnly === '/api/tasks' && method === 'GET') {
      handleListTasks(req, res)
      return
    }
    if (pathOnly === '/api/tasks' && method === 'POST') {
      await handleCreateTask(req, res)
      return
    }

    const dl = /^\/api\/tasks\/([^/]+)\/download$/.exec(pathOnly)
    if (dl && method === 'GET') {
      handleDownload(req, res, decodeURIComponent(dl[1]))
      return
    }

    const thumb = /^\/api\/tasks\/([^/]+)\/thumbnail$/.exec(pathOnly)
    if (thumb && method === 'GET') {
      await handleThumbnail(req, res, decodeURIComponent(thumb[1]))
      return
    }

    if (pathOnly.startsWith('/api/')) {
      json(res, 404, {ok: false, error: '接口不存在'})
      return
    }

    if (method === 'GET' || method === 'HEAD') {
      serveStatic(req, res)
      return
    }

    json(res, 405, {ok: false, error: '方法不允许'})
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('[lanServer] request error:', msg)
    if (!res.headersSent) {
      json(res, 500, {ok: false, error: msg})
    }
  }
}

/**
 * 启动局域网 HTTP 服务（按设置绑定 0.0.0.0 或 127.0.0.1）
 */
export function startLanServer(port?: number): Promise<LanStatus> {
  return new Promise((resolve) => {
    const settings = getSettings()
    const p =
      typeof port === 'number' && Number.isFinite(port)
        ? Math.max(1024, Math.min(65535, Math.floor(port)))
        : settings.lanPort || DEFAULT_LAN_PORT
    const host = normalizeBindHost(settings.lanBindHost)

    if (lanCtx.server) {
      // 已在运行：端口与绑定地址均一致则直接返回
      if (lanCtx.listenPort === p && lanCtx.listenHost === host) {
        lanCtx.lastError = undefined
        resolve(getLanStatus())
        return
      }
      stopLanServer()
    }

    if (!settings.lanPasswordHash) {
      lanCtx.lastError = '请先设置远程访问密码'
      resolve(getLanStatus())
      return
    }

    ensureUploadsDir()
    attachQueueListener()
    lanCtx.sessions.purgeExpired()

    const s = http.createServer((req, res) => {
      void handleRequest(req, res)
    })

    s.on('error', (err: NodeJS.ErrnoException) => {
      lanCtx.lastError =
        err.code === 'EADDRINUSE' ? `端口 ${p} 已被占用` : err.message
      console.warn('[lanServer] listen error:', lanCtx.lastError)
      lanCtx.server = null
      lanCtx.listenPort = 0
      lanCtx.listenHost = '0.0.0.0'
      lanCtx.pairCodes.clear()
      resolve(getLanStatus())
    })

    s.listen(p, host, () => {
      lanCtx.server = s
      lanCtx.listenPort = p
      lanCtx.listenHost = host
      lanCtx.lastError = undefined
      if (host === '0.0.0.0') {
        lanCtx.pairCodes.refresh()
      } else {
        lanCtx.pairCodes.clear()
      }
      console.log(`[lanServer] listening on ${host}:${p}`)
      resolve(getLanStatus())
    })
  })
}

/**
 * 停止服务并清除会话
 */
export function stopLanServer(): LanStatus {
  if (lanCtx.server) {
    try {
      lanCtx.server.close()
    } catch (err) {
      console.warn('[lanServer] close error:', err)
    }
    lanCtx.server = null
  }
  lanCtx.listenPort = 0
  lanCtx.listenHost = '0.0.0.0'
  lanCtx.sessions.clearAll()
  lanCtx.loginLimiter.clearAll()
  lanCtx.pairCodes.clear()
  lanCtx.downloadLimiter.clearAll()
  lanCtx.thumbLimiter.clearAll()
  // 保留 lanTasks 状态，便于再次开启后查看历史；不 detach 进度监听以便运行中任务仍更新
  // 若完全关闭远程，仍可保留内存任务
  lanCtx.lastError = undefined
  return getLanStatus()
}

/** 手动刷新配对码（仅局域网绑定且服务运行时有效） */
export function refreshLanPairCode(): LanStatus {
  const bindHost = runningBindOrSetting(getSettings().lanBindHost)
  const running = lanCtx.server != null && lanCtx.listenPort > 0
  if (bindHost === '0.0.0.0' && running) {
    lanCtx.pairCodes.refresh()
  } else {
    lanCtx.pairCodes.clear()
  }
  return getLanStatus()
}

/**
 * 应用局域网配置：持久化 + start/stop + 改密清会话
 */
export async function applyLanRemoteConfig(
  input: LanRemoteConfigInput
): Promise<{ok: boolean; status: LanStatus; error?: string}> {
  try {
    const current = getSettings()
    const partial: Partial<typeof current> = {}

    if (typeof input.enabled === 'boolean') {
      partial.lanRemoteEnabled = input.enabled
    }
    if (typeof input.port === 'number' && Number.isFinite(input.port)) {
      partial.lanPort = Math.max(1024, Math.min(65535, Math.floor(input.port)))
    }
    if (input.bindHost === '0.0.0.0' || input.bindHost === '127.0.0.1') {
      partial.lanBindHost = input.bindHost
    }
    if (typeof input.username === 'string') {
      const u = input.username.trim()
      if (u && u.length <= 64) {
        partial.lanUsername = u
      }
    }

    let passwordChanged = false
    if (typeof input.password === 'string' && input.password.length > 0) {
      const pwdErr = validateLanPassword(input.password)
      if (pwdErr) {
        return {
          ok: false,
          status: getLanStatus(),
          error: pwdErr
        }
      }
      partial.lanPasswordHash = hashPassword(input.password)
      passwordChanged = true
    }

    const prevHost = normalizeBindHost(current.lanBindHost)
    const next = saveSettings(partial)

    if (passwordChanged) {
      lanCtx.sessions.clearAll()
      lanCtx.pairCodes.clear()
    }

    // 关闭 → 停服务
    if (!next.lanRemoteEnabled) {
      const status = stopLanServer()
      return {ok: true, status}
    }

    // 开启：需有密码
    if (!next.lanPasswordHash) {
      lanCtx.lastError = '请先设置远程访问密码'
      return {
        ok: false,
        status: getLanStatus(),
        error: lanCtx.lastError
      }
    }

    const desiredHost = normalizeBindHost(next.lanBindHost)
    if (prevHost !== desiredHost) {
      lanCtx.pairCodes.clear()
    }
    // 端口/绑定变更、改密或未运行 → 重启
    const needRestart =
      !lanCtx.server ||
      lanCtx.listenPort !== next.lanPort ||
      lanCtx.listenHost !== desiredHost ||
      passwordChanged

    if (needRestart) {
      if (lanCtx.server) stopLanServer()
      const status = await startLanServer(next.lanPort)
      if (!status.running) {
        return {
          ok: false,
          status,
          error: status.error || '启动失败'
        }
      }
      return {ok: true, status}
    }

    if (desiredHost === '0.0.0.0') {
      lanCtx.pairCodes.ensure()
    } else {
      lanCtx.pairCodes.clear()
    }

    return {ok: true, status: getLanStatus()}
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    lanCtx.lastError = msg
    return {ok: false, status: getLanStatus(), error: msg}
  }
}

/**
 * 根据当前设置同步服务状态（启动时 / settings 变更后）
 */
export async function syncLanServerFromSettings(): Promise<LanStatus> {
  const s = getSettings()
  if (!s.lanRemoteEnabled) {
    if (lanCtx.server) stopLanServer()
    return getLanStatus()
  }
  if (!s.lanPasswordHash) {
    lanCtx.lastError = '请先设置远程访问密码'
    if (lanCtx.server) stopLanServer()
    return getLanStatus()
  }
  const desiredHost = normalizeBindHost(s.lanBindHost)
  if (
    lanCtx.server &&
    lanCtx.listenPort === s.lanPort &&
    lanCtx.listenHost === desiredHost
  ) {
    return getLanStatus()
  }
  return startLanServer(s.lanPort)
}
