/** 取路径末段文件名（不依赖 path 模块，兼容 Windows / Unix） */
function pathBasename(p: string): string {
  const norm = String(p || '').replace(/\\/g, '/')
  const parts = norm.split('/').filter(Boolean)
  return parts[parts.length - 1] || p
}

/**
 * 将文案中的绝对路径替换为 basename，避免错误信息泄露完整用户路径。
 * 优先替换 knownPaths，再做通用盘符 / UNC / Unix 绝对路径匹配。
 */
export function redactPathsInText(
  text: string,
  knownPaths?: Array<string | undefined | null>
): string {
  let out = String(text || '')
  if (!out) return out

  const known = (knownPaths || [])
    .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
    .map((p) => p.trim())
    .sort((a, b) => b.length - a.length)

  for (const p of known) {
    const base = pathBasename(p)
    if (!base || base === p) continue
    const variants = Array.from(
      new Set([p, p.replace(/\\/g, '/'), p.replace(/\//g, '\\')])
    )
    for (const v of variants) {
      if (v.length < 2) continue
      if (out.includes(v)) {
        out = out.split(v).join(base)
      }
    }
  }

  // Windows: C:\foo\bar 或 C:/foo/bar
  out = out.replace(
    /[A-Za-z]:[\\/](?:[^\s"'`<>|\n\r]+[\\/])*[^\s"'`<>|\n\r]+/g,
    (m) => pathBasename(m)
  )
  // UNC: \\server\share\...
  out = out.replace(/\\\\[^\s"'`<>|\n\r]+/g, (m) => pathBasename(m))
  // Unix 绝对路径（保留前导分隔/引号等）
  out = out.replace(
    /(^|[\s"'=:])(\/(?:[^\s"'`<>|\n\r]+\/)*[^\s"'`<>|\n\r]+)/g,
    (_m, pre: string, p: string) => pre + pathBasename(p)
  )

  return out
}

/**
 * 将 ffmpeg 原始错误映射为用户可读的中文短句
 * 按优先级匹配 stderr/消息关键字
 */
export function mapFfmpegError(
  raw: string,
  ctx?: {
    resolvedEncoder?: string
    inputPath?: string
    outputPath?: string
  }
): string {
  const text = redactPathsInText((raw || '').trim(), [
    ctx?.inputPath,
    ctx?.outputPath
  ])
  const lower = text.toLowerCase()

  // 输入不存在
  if (
    /no such file/i.test(text) ||
    /cannot find the file/i.test(text) ||
    /输入文件不存在/.test(text) ||
    /enoent/i.test(text)
  ) {
    return '输入文件不存在或路径无效。请确认文件仍在原位置。'
  }

  // 权限
  if (
    /permission denied/i.test(text) ||
    /access is denied/i.test(text) ||
    /eacces/i.test(text) ||
    /eperm/i.test(text)
  ) {
    return '无权限读写文件。请检查文件是否被占用，以及读写权限。'
  }

  // 磁盘空间
  if (
    /no space left/i.test(text) ||
    /disk full/i.test(text) ||
    /not enough space/i.test(text) ||
    /enospc/i.test(text)
  ) {
    return '磁盘空间不足。请清理输出目录所在磁盘后重试。'
  }

  // 无音频流（抽取音频时常见）
  if (
    /does not contain any stream/i.test(text) ||
    /output file does not contain any stream/i.test(text) ||
    /stream map.*matches no streams/i.test(text) ||
    /matches no streams/i.test(text) ||
    /no audio streams/i.test(text) ||
    /does not contain.*audio/i.test(lower) ||
    /could not find.*audio/i.test(text)
  ) {
    return '源文件没有可用的音频流，无法抽取音频。'
  }

  // GIF 调色板 / palette
  if (
    /palettegen/i.test(text) ||
    /paletteuse/i.test(text) ||
    /error generating palette/i.test(text) ||
    (/gif/i.test(text) && /palette/i.test(text))
  ) {
    return 'GIF 调色板生成或应用失败。可尝试降低分辨率/帧率，或缩短裁剪时长后重试。'
  }

  // GIF 过大 / 内存
  if (
    (/gif/i.test(lower) && /memory|too large|allocation/i.test(lower)) ||
    /gif.*muxer/i.test(lower)
  ) {
    return 'GIF 导出失败（体积或内存过高）。请降低最长边、帧率，或缩短时段后重试。'
  }

  // 动图优化：输入非动画 / 解码失败
  if (
    /does not contain any stream/i.test(text) ||
    (/webp/i.test(lower) && /no.*frame|not.*animat/i.test(lower))
  ) {
    return '动图优化失败：无法解码为动画帧。请确认输入为 GIF 或动图 WebP。'
  }

  // 动图 WebP / libwebp
  if (
    /libwebp/i.test(text) ||
    /webp.*anim/i.test(lower) ||
    (/webp/i.test(lower) &&
      /encoder|encode|quality|compression/i.test(lower) &&
      /error|fail|unable|cannot/i.test(lower))
  ) {
    return '动图 WebP 编码失败。可尝试降低质量/分辨率/帧率，或改用 GIF 后重试。'
  }

  // 损坏 / 不支持格式
  if (
    /invalid data found/i.test(text) ||
    /could not find codec/i.test(text) ||
    /unknown format/i.test(text) ||
    (/invalid argument/i.test(text) && /demuxer|codec/i.test(text))
  ) {
    return '文件损坏或不支持的格式。请换源文件或改用其他容器格式。'
  }

  // NVIDIA
  if (/nvenc|cuda|nvcuda|libcuda/i.test(text)) {
    return 'NVIDIA 硬件编码不可用。请检查显卡驱动，或改用软件 x264。'
  }

  // Intel QSV
  if (/qsv|quicksync|mfx|libmfx|vaapi.*qsv/i.test(text)) {
    return 'Intel QSV 硬件编码不可用。请检查核显驱动，或改用软件 x264。'
  }

  // AMD AMF
  if (/\bamf\b|amfrt|h264_amf|hevc_amf/i.test(text)) {
    return 'AMD AMF 硬件编码不可用。请检查显卡驱动，或改用软件 x264。'
  }

  // Apple VideoToolbox
  if (/videotoolbox|h264_videotoolbox|hevc_videotoolbox/i.test(text)) {
    return 'Apple VideoToolbox 硬件编码不可用。请检查系统支持，或改用软件 x264。'
  }

  // 编码器未找到
  if (/encoder\s+not found|unknown encoder|codec not found/i.test(text)) {
    return '编码器不可用。请改用「自动」或「软件 x264」。'
  }

  // 编码器初始化失败
  if (
    /conversion failed/i.test(text) ||
    /error while opening encoder/i.test(text) ||
    /error initializing/i.test(text) ||
    /cannot open encoder/i.test(text)
  ) {
    const enc = ctx?.resolvedEncoder
    if (
      enc &&
      enc !== 'libx264' &&
      enc !== 'libx265' &&
      enc !== 'libvpx-vp9'
    ) {
      return `编码器初始化失败（${enc}）。可尝试软件 x264 或检查硬件驱动。`
    }
    return '编码器初始化失败。请检查参数后重试，或改用软件 x264。'
  }

  // 其它：截断并加前缀
  const truncated = text.length > 200 ? `${text.slice(0, 200)}…` : text
  return truncated ? `压缩失败：${truncated}` : '压缩失败：未知错误'
}

/** 判断是否为硬件编码器相关失败（用于自动回退软件） */
export function isHardwareEncoderFailure(
  raw: string,
  resolvedEncoder?: string
): boolean {
  const enc = resolvedEncoder || ''
  const isHwEnc =
    enc === 'h264_nvenc' ||
    enc === 'h264_qsv' ||
    enc === 'h264_amf' ||
    enc === 'h264_videotoolbox' ||
    enc === 'h264_mf' ||
    enc === 'hevc_nvenc' ||
    enc === 'hevc_qsv' ||
    enc === 'hevc_amf' ||
    enc === 'hevc_videotoolbox' ||
    enc === 'hevc_mf' ||
    /nvenc|qsv|amf|videotoolbox|_mf\b|mediafoundation|hevc_/i.test(enc)

  if (!isHwEnc && enc) {
    // 明确是软件编码则不算硬件失败
    if (
      enc === 'libx264' ||
      enc === 'libx265' ||
      enc === 'libvpx-vp9'
    ) {
      return false
    }
  }

  const text = raw || ''
  if (
    /nvenc|cuda|nvcuda|libcuda|qsv|quicksync|mfx|libmfx|\bamf\b|amfrt|h264_amf|hevc_amf|videotoolbox|h264_videotoolbox|hevc_videotoolbox|h264_mf|hevc_mf|mediafoundation|mf_|\bhevc_nvenc\b|\bhevc_qsv\b|opencl|device|encoder not found|error while opening encoder|cannot open encoder|error initializing/i.test(
      text
    )
  ) {
    return true
  }

  // 使用了硬件编码器且非 0 退出，也视为可回退
  return isHwEnc
}
