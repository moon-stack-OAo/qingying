import type {IncomingMessage, ServerResponse} from 'http'
import type {LanTaskView} from '../../../shared/types'

/** 每 IP 最多同时 SSE 连接数 */
export const SSE_MAX_PER_IP = 3

/** 进度推送最短间隔（ms） */
const PROGRESS_MIN_INTERVAL_MS = 150
/** 进度变化至少多少百分点才推（间隔未到时） */
const PROGRESS_MIN_DELTA = 0.5

export type SseEventName = 'snapshot' | 'progress' | 'end' | 'queued'

export interface SseProgressPayload {
  id: string
  progress: number
  status: string
  time?: string
  speed?: string
  etaSec?: number
}

interface SseClient {
  id: number
  ip: string
  res: ServerResponse
}

let nextClientId = 1
const clients = new Map<number, SseClient>()

/** 节流：按 taskId 记录上次推送 */
const lastProgressPush = new Map<
  string,
  {at: number; progress: number}
>()

function countByIp(ip: string): number {
  let n = 0
  clients.forEach((c) => {
    if (c.ip === ip) n += 1
  })
  return n
}

function writeEvent(
  res: ServerResponse,
  event: SseEventName,
  data: unknown
): boolean {
  if (res.writableEnded || res.destroyed) return false
  try {
    const payload = JSON.stringify(data)
    res.write(`event: ${event}\ndata: ${payload}\n\n`)
    return true
  } catch {
    return false
  }
}

export function broadcastSse(event: SseEventName, data: unknown): void {
  if (clients.size === 0) return
  const dead: number[] = []
  clients.forEach((client, id) => {
    if (!writeEvent(client.res, event, data)) {
      dead.push(id)
    }
  })
  for (let i = 0; i < dead.length; i++) {
    removeSseClient(dead[i])
  }
}

export function shouldPushProgress(
  taskId: string,
  progress: number,
  force = false
): boolean {
  if (force) {
    lastProgressPush.set(taskId, {at: Date.now(), progress})
    return true
  }
  const now = Date.now()
  const prev = lastProgressPush.get(taskId)
  if (!prev) {
    lastProgressPush.set(taskId, {at: now, progress})
    return true
  }
  const elapsed = now - prev.at
  const delta = Math.abs(progress - prev.progress)
  if (elapsed >= PROGRESS_MIN_INTERVAL_MS || delta >= PROGRESS_MIN_DELTA) {
    lastProgressPush.set(taskId, {at: now, progress})
    return true
  }
  return false
}

export function clearProgressThrottle(taskId?: string): void {
  if (taskId) lastProgressPush.delete(taskId)
  else lastProgressPush.clear()
}

export function broadcastProgress(
  payload: SseProgressPayload,
  force = false
): void {
  if (!shouldPushProgress(payload.id, payload.progress, force)) return
  broadcastSse('progress', payload)
}

export function broadcastTaskView(
  event: 'end' | 'queued',
  view: LanTaskView
): void {
  if (event === 'end') clearProgressThrottle(view.id)
  broadcastSse(event, view)
}

function removeSseClient(id: number): void {
  const client = clients.get(id)
  if (!client) return
  clients.delete(id)
  try {
    if (!client.res.writableEnded) client.res.end()
  } catch {
    // ignore
  }
}

/** 关闭全部 SSE（停服务时） */
export function closeAllSseClients(): void {
  const ids: number[] = []
  clients.forEach((_c, id) => {
    ids.push(id)
  })
  for (let i = 0; i < ids.length; i++) {
    removeSseClient(ids[i])
  }
  clearProgressThrottle()
}

export function sseClientCountForIp(ip: string): number {
  return countByIp(ip)
}

/**
 * 已鉴权后挂载 SSE 流；调用方负责写 200 头之前的鉴权与限流。
 * 返回 client id；失败（写失败）返回 null。
 */
export function attachSseClient(
  req: IncomingMessage,
  res: ServerResponse,
  ip: string,
  snapshot: {tasks: LanTaskView[]}
): number | null {
  const id = nextClientId++
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  })
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders()
  }

  const client: SseClient = {id, ip, res}
  clients.set(id, client)

  if (!writeEvent(res, 'snapshot', snapshot)) {
    removeSseClient(id)
    return null
  }

  const onClose = (): void => {
    removeSseClient(id)
  }
  req.on('close', onClose)
  req.on('aborted', onClose)
  res.on('close', onClose)
  res.on('error', onClose)

  const heartbeat = setInterval(() => {
    if (res.writableEnded || res.destroyed) {
      clearInterval(heartbeat)
      removeSseClient(id)
      return
    }
    try {
      res.write(': ping\n\n')
    } catch {
      clearInterval(heartbeat)
      removeSseClient(id)
    }
  }, 25_000)

  res.on('close', () => clearInterval(heartbeat))
  return id
}
