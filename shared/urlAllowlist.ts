/**
 * 判断 URL 是否允许通过 shell.openExternal 打开。
 * 仅允许 http: / https:；非法 URL 与其它协议一律拒绝。
 */
export function isAllowedExternalUrl(url: string): boolean {
  if (typeof url !== 'string' || !url.trim()) {
    return false
  }
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}
