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
