/**
 * 生成 concat demuxer list 文件内容
 * 每行 file 'path'，路径内单引号转义为 '\''
 */
export function buildConcatDemuxerList(paths: string[]): string {
  return paths
    .map((p) => {
      const escaped = String(p ?? '').replace(/'/g, "'\\''")
      return `file '${escaped}'`
    })
    .join('\n')
}

/**
 * 构建 filter_complex concat（重编码路径）的 filter 字符串
 * 例 n=2 hasAudio: [0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[outv][outa]
 * 无音频: [0:v][1:v]concat=n=2:v=1:a=0[outv]
 */
export function buildConcatFilterComplex(
  count: number,
  hasAudio: boolean
): string {
  const n = Math.max(0, Math.floor(count))
  if (n <= 0) return ''
  const labels: string[] = []
  for (let i = 0; i < n; i++) {
    labels.push(`[${i}:v]`)
    if (hasAudio) labels.push(`[${i}:a]`)
  }
  if (hasAudio) {
    return `${labels.join('')}concat=n=${n}:v=1:a=1[outv][outa]`
  }
  return `${labels.join('')}concat=n=${n}:v=1:a=0[outv]`
}
