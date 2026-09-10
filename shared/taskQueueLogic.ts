/**
 * taskQueue 可单测纯逻辑（无 Electron / ffmpeg 副作用）
 */

/** 并发限制到 1–4（与 UI / 设置一致） */
export function clampTaskConcurrency(n: number): number {
  return Math.max(1, Math.min(4, Math.floor(n) || 1))
}

/**
 * 同 id 已被替换时，旧 QueueItem 收尾不应再推 TASK_END。
 * running 中当前条目不是本 item 即视为过期。
 */
export function isStaleQueueItem<T>(
  taskId: string,
  item: T | undefined,
  running: Map<string, T>
): boolean {
  return item !== undefined && running.get(taskId) !== item
}

/** replaced=同 id 替换不向 UI 报取消；cancelled=用户取消需推终态 */
export function shouldNotifyCancelOnDrop(
  reason: 'replaced' | 'cancelled'
): boolean {
  return reason === 'cancelled'
}

/** LAN 任务不向桌面主窗口推 TASK_* IPC（仍走 listeners / SSE） */
export function shouldSendTaskIpcToDesktop(
  taskId: string | undefined,
  lanTaskIds: ReadonlySet<string>
): boolean {
  if (!taskId) return true
  return !lanTaskIds.has(taskId)
}

/** 系统完成通知 / 批次统计排除 LAN */
export function shouldCountInBatchNotify(
  taskId: string,
  lanTaskIds: ReadonlySet<string>
): boolean {
  return !lanTaskIds.has(taskId)
}

/**
 * cancelAll 候选 id：默认只取消桌面；includeLan 时全清（退出等硬停）。
 */
export function filterCancelAllTaskIds(
  ids: readonly string[],
  lanTaskIds: ReadonlySet<string>,
  includeLan: boolean
): string[] {
  if (includeLan) return Array.from(new Set(ids))
  const out: string[] = []
  const seen = new Set<string>()
  for (const id of ids) {
    if (lanTaskIds.has(id) || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}
