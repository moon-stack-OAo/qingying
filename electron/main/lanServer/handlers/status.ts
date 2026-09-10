import type {IncomingMessage, ServerResponse} from 'http'
import {
  DEFAULT_PRESETS,
  IMAGE_PRESET_OPTIONS
} from '../../../../shared/types'
import {getImageEngineStatus} from '../../image'
import {getSettings} from '../../settings'
import {lanCtx} from '../context'
import {getSession, json} from '../httpUtil'
import {MAX_UPLOAD_BYTES} from '../multipart'

export function handleStatus(req: IncomingMessage, res: ServerResponse): void {
  const sess = getSession(req)
  const settings = getSettings()
  const imageEngine = getImageEngineStatus()
  // 配对码仅桌面端 IPC 下发；网页只告知是否需要填写
  const pairCodeRequired = lanCtx.listenHost === '0.0.0.0'
  json(res, 200, {
    ok: true,
    product: '轻影',
    authenticated: Boolean(sess),
    username: sess?.username,
    needLogin: true,
    hasPassword: Boolean(settings.lanPasswordHash),
    pairCodeRequired,
    presets: DEFAULT_PRESETS.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description
    })),
    imagePresets: IMAGE_PRESET_OPTIONS.map((p) => ({
      id: p.value,
      name: p.label
    })),
    modes: [
      {value: 'compress', label: '视频压缩'},
      {value: 'audio', label: '仅抽取音频'},
      {value: 'image', label: '图片压缩'}
    ],
    audioFormats: [
      {value: 'm4a', label: 'M4A'},
      {value: 'mp3', label: 'MP3'},
      {value: 'opus', label: 'Opus'}
    ],
    audioBitrates: ['128k', '192k', '256k', '320k'],
    videoFormats: ['mp4', 'mkv', 'mov', 'webm'],
    imageFormats: [
      {value: 'jpeg', label: 'JPEG'},
      {value: 'png', label: 'PNG'},
      {value: 'webp', label: 'WebP'},
      {value: 'keep', label: '保持原格式'}
    ],
    imageEngineReady: !imageEngine.error,
    maxUploadMb: Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))
  })
}
