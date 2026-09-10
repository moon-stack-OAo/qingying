import type {Server} from 'http'
import type {CompressTask} from '../../../shared/types'
import {PairCodeStore} from './pairCode'
import {LoginRateLimiter, SlidingWindowRateLimiter} from './rateLimit'
import {SessionStore} from './session'

/** 默认端口 */
export const DEFAULT_LAN_PORT = 17890

/** 局域网输出命名：仅用时间戳，避免原文件名过长 */
export const LAN_NAME_TEMPLATE = '{date}_{time}'

/** 局域网任务列表缩略图最长边 */
export const LAN_THUMB_MAX_EDGE = 128
/** 点击预览时允许的最大边长 */
export const LAN_PREVIEW_MAX_EDGE = 1600

/** 同时进行的局域网上传上限（解析 multipart / 写盘） */
export const MAX_CONCURRENT_UPLOADS = 2

/**
 * 缩略图/抽帧等重操作限流：按客户端 IP，60 秒内最多 30 次。
 * 列表多图并发加载时仍可用；恶意刷接口会打满 ffmpeg/sharp。
 */
export const THUMB_RATE_WINDOW_MS = 60 * 1000
export const THUMB_RATE_MAX = 30

/** 下载限流：按 IP，60 秒内最多 20 次（比缩略图更重带宽） */
export const DOWNLOAD_RATE_WINDOW_MS = 60 * 1000
export const DOWNLOAD_RATE_MAX = 20

/** 局域网任务内存表（含路径，不下发前端） */
export interface LanTaskRecord {
  task: CompressTask
  /** 是否由局域网创建 */
  fromLan: boolean
}

/**
 * 局域网服务共享可变状态。
 * 用单一对象避免跨模块 `export let` 再赋值问题，并降低循环依赖风险。
 */
export const lanCtx = {
  server: null as Server | null,
  listenPort: 0,
  /** 当前实际监听地址 */
  listenHost: '0.0.0.0' as '0.0.0.0' | '127.0.0.1',
  lastError: undefined as string | undefined,
  sessions: new SessionStore(),
  loginLimiter: new LoginRateLimiter(),
  thumbLimiter: new SlidingWindowRateLimiter(
    THUMB_RATE_WINDOW_MS,
    THUMB_RATE_MAX
  ),
  downloadLimiter: new SlidingWindowRateLimiter(
    DOWNLOAD_RATE_WINDOW_MS,
    DOWNLOAD_RATE_MAX
  ),
  /** 绑定 0.0.0.0 时登录所需配对码（仅内存） */
  pairCodes: new PairCodeStore(),
  lanTasks: new Map<string, LanTaskRecord>(),
  removeQueueListener: null as (() => void) | null,
  activeUploads: 0
}
