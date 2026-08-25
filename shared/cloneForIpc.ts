/**
 * 将 Vue 响应式对象转为可经 Electron IPC（Structured Clone）传递的纯数据。
 * Proxy / 函数 / Symbol 等不可克隆值会被剥离。
 */
export function cloneForIpc<T>(value: T): T {
  return structuredClone(toPlain(value)) as T
}

function toPlain(value: unknown): unknown {
  if (value == null) return value
  const t = typeof value
  if (t === 'string' || t === 'number' || t === 'boolean' || t === 'bigint') {
    return value
  }
  if (t === 'function' || t === 'symbol' || t === 'undefined') {
    return undefined
  }
  if (Array.isArray(value)) {
    return value.map((item) => toPlain(item))
  }
  if (value instanceof Date) {
    return new Date(value.getTime())
  }
  if (ArrayBuffer.isView(value)) {
    return value
  }
  if (value instanceof ArrayBuffer) {
    return value
  }
  if (t === 'object') {
    const src = value as Record<string | symbol, unknown>
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(src)) {
      const next = toPlain(src[key])
      if (next !== undefined) {
        out[key] = next
      }
    }
    return out
  }
  return undefined
}
