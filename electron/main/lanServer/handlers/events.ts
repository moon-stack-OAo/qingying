import type {IncomingMessage, ServerResponse} from 'http'
import {lanCtx} from '../context'
import {clientIp, json, requireAuth} from '../httpUtil'
import {
  attachSseClient,
  SSE_MAX_PER_IP,
  sseClientCountForIp
} from '../sse'
import {toLanView} from '../taskUtil'

export function handleTaskEvents(
  req: IncomingMessage,
  res: ServerResponse
): void {
  if (!requireAuth(req, res)) return

  const ip = clientIp(req)
  if (sseClientCountForIp(ip) >= SSE_MAX_PER_IP) {
    json(res, 429, {
      ok: false,
      error: `同一地址 SSE 连接过多（最多 ${SSE_MAX_PER_IP} 个）`
    })
    return
  }

  const tasks = Array.from(lanCtx.lanTasks.values())
    .map((r) => toLanView(r.task))
    .sort((a, b) => b.id.localeCompare(a.id))

  attachSseClient(req, res, ip, {tasks})
}
