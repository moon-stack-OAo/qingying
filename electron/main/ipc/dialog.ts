import { dialog } from 'electron'
import { basename, dirname, extname } from 'path'
import { existsSync, statSync } from 'fs'
import {
  IMAGE_EXTENSIONS,
  IpcChannels,
  VIDEO_EXTENSIONS
} from '../../../shared/types'
import { allowDir, allowPath, allowPaths } from '../pathAllowlist'
import { getMainWindowRef, handleFromMainWindow } from '../ipcGuard'

function isMediaFile(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase()
  return (
    (VIDEO_EXTENSIONS as string[]).includes(ext) ||
    (IMAGE_EXTENSIONS as string[]).includes(ext)
  )
}

/** 文件/目录选择相关 IPC */
export function registerDialogIpc(): void {
  handleFromMainWindow(
    IpcChannels.SELECT_FILES,
    async (
      _e,
      opts?: {
        mode?: string
        mediaKind?: 'video' | 'image' | 'all'
      }
    ) => {
      const mainWindow = getMainWindowRef()
      if (!mainWindow) return { files: [] }

      const videoExts = VIDEO_EXTENSIONS.map((e) => e.replace('.', ''))
      const imageExts = IMAGE_EXTENSIONS.map((e) => e.replace('.', ''))
      const mediaExts = Array.from(new Set(videoExts.concat(imageExts)))

      const mode = typeof opts?.mode === 'string' ? opts.mode : ''
      let kind: 'video' | 'image' | 'all' =
        opts?.mediaKind === 'video' ||
        opts?.mediaKind === 'image' ||
        opts?.mediaKind === 'all'
          ? opts.mediaKind
          : 'all'
      if (mode) {
        if (
          mode === 'image' ||
          mode === 'image-crop' ||
          mode === 'image-stitch'
        ) {
          kind = 'image'
        } else if (
          mode === 'compress' ||
          mode === 'audio' ||
          mode === 'video-concat' ||
          mode === 'media-compose' ||
          mode === 'video-mosaic'
        ) {
          kind = 'video'
        }
      }

      const title =
        kind === 'image'
          ? '选择图片'
          : kind === 'video'
            ? mode === 'video-mosaic'
              ? '选择视频（打码仅支持单个）'
              : '选择视频'
            : '选择媒体文件'

      const filters =
        kind === 'image'
          ? [
              { name: '图片文件', extensions: imageExts },
              { name: '所有文件', extensions: ['*'] }
            ]
          : kind === 'video'
            ? [
                { name: '视频文件', extensions: videoExts },
                { name: '所有文件', extensions: ['*'] }
              ]
            : [
                { name: '媒体文件', extensions: mediaExts },
                { name: '视频文件', extensions: videoExts },
                { name: '图片文件', extensions: imageExts },
                { name: '所有文件', extensions: ['*'] }
              ]

      // 视频打码仅允许单选
      const properties: Array<'openFile' | 'multiSelections'> =
        mode === 'video-mosaic'
          ? ['openFile']
          : ['openFile', 'multiSelections']

      const result = await dialog.showOpenDialog(mainWindow, {
        title,
        properties,
        filters
      })

      if (result.canceled || !result.filePaths.length) {
        return { files: [] }
      }

      const files = result.filePaths
        .filter(isMediaFile)
        .map((p) => ({ path: p, name: basename(p) }))

      allowPaths(files.map((f) => f.path))
      return { files }
    }
  )

  handleFromMainWindow(IpcChannels.SELECT_DIR, async (_e, defaultPath?: string) => {
    const mainWindow = getMainWindowRef()
    if (!mainWindow) return { path: null }

    const start = typeof defaultPath === 'string' ? defaultPath.trim() : ''
    let defaultDir: string | undefined
    if (start) {
      try {
        if (existsSync(start)) {
          defaultDir = statSync(start).isDirectory() ? start : dirname(start)
        } else {
          // 目录尚不存在时，尽量落到已存在的父路径
          let cur = start
          while (cur && cur !== dirname(cur)) {
            const parent = dirname(cur)
            if (existsSync(parent)) {
              defaultDir = parent
              break
            }
            cur = parent
          }
        }
      } catch {
        defaultDir = undefined
      }
    }

    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择目录',
      properties: ['openDirectory', 'createDirectory'],
      ...(defaultDir ? { defaultPath: defaultDir } : {})
    })

    if (result.canceled || !result.filePaths.length) {
      return { path: null }
    }
    const selected = result.filePaths[0]
    allowDir(selected)
    return { path: selected }
  })

  handleFromMainWindow(IpcChannels.SELECT_IMAGE, async () => {
    const mainWindow = getMainWindowRef()
    if (!mainWindow) return { path: null }

    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择水印图片',
      properties: ['openFile'],
      filters: [
        {
          name: '图片',
          extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif']
        },
        { name: '所有文件', extensions: ['*'] }
      ]
    })

    if (result.canceled || !result.filePaths.length) {
      return { path: null }
    }
    const selected = result.filePaths[0]
    allowPath(selected)
    return { path: selected }
  })
}
