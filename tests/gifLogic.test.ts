import path from 'path'
import { describe, expect, it } from 'vitest'
import {
  buildGifOptimizeArgs,
  buildGifVfChain,
  buildImagesToGifArgs,
  buildImagesToGifConcatList,
  buildVideoToGifArgs,
  fpsFromFrameDelayMs,
  frameDelayMsFromFps,
  isGifOptimizeInputPath,
  normalizeGifColors,
  normalizeGifDither,
  normalizeGifFps,
  normalizeGifFrameDelayMs,
  normalizeGifLoop,
  normalizeGifMaxEdge,
  normalizeGifOptions,
  normalizeGifOutputKind,
  normalizeGifWebpQuality,
  resolveGifTiming,
  validateGifOptions
} from '../shared/gifLogic'
import type { CompressOptions } from '../shared/types'

function baseGifOptions(
  over: Partial<CompressOptions> = {}
): CompressOptions {
  return {
    presetId: 'standard',
    crf: 23,
    maxEdge: 480,
    format: 'mp4',
    outputDir: path.join('D:', 'out'),
    encoder: 'software',
    mode: 'video-to-gif',
    gif: { fps: 12, loop: 0, colors: 256, dither: 'bayer', outputKind: 'gif' },
    ...over
  }
}

describe('normalizeGif*', () => {
  it('fps 默认与边界', () => {
    expect(normalizeGifFps(undefined)).toBe(12)
    expect(normalizeGifFps(0)).toBe(12)
    expect(normalizeGifFps(-1)).toBe(12)
    expect(normalizeGifFps(10)).toBe(10)
    expect(normalizeGifFps(24.4)).toBe(24.4)
    expect(normalizeGifFps(100)).toBe(50)
    expect(normalizeGifFps(undefined, 10)).toBe(10)
  })

  it('frameDelayMs 与互推', () => {
    expect(normalizeGifFrameDelayMs(undefined)).toBe(100)
    expect(normalizeGifFrameDelayMs(0)).toBe(100)
    expect(normalizeGifFrameDelayMs(50)).toBe(50)
    expect(normalizeGifFrameDelayMs(5)).toBe(20)
    expect(fpsFromFrameDelayMs(100)).toBe(10)
    expect(frameDelayMsFromFps(10)).toBe(100)
  })

  it('maxEdge 默认与 0', () => {
    expect(normalizeGifMaxEdge(undefined)).toBe(480)
    expect(normalizeGifMaxEdge(-1)).toBe(480)
    expect(normalizeGifMaxEdge(0)).toBe(0)
    expect(normalizeGifMaxEdge(640)).toBe(640)
  })

  it('loop', () => {
    expect(normalizeGifLoop(undefined)).toBe(0)
    expect(normalizeGifLoop(-1)).toBe(-1)
    expect(normalizeGifLoop(3)).toBe(3)
    expect(normalizeGifLoop(-5)).toBe(0)
  })

  it('colors / dither', () => {
    expect(normalizeGifColors(undefined)).toBe(256)
    expect(normalizeGifColors(1)).toBe(256)
    expect(normalizeGifColors(128)).toBe(128)
    expect(normalizeGifColors(999)).toBe(256)
    expect(normalizeGifDither('floyd_steinberg')).toBe('floyd_steinberg')
    expect(normalizeGifDither('nope')).toBe('bayer')
  })

  it('normalizeGifOptions 补默认并吃顶层 maxEdge', () => {
    const n = normalizeGifOptions({}, 320)
    expect(n.fps).toBe(12)
    expect(n.maxEdge).toBe(320)
    expect(n.loop).toBe(0)
    expect(n.dither).toBe('bayer')
    expect(n.outputKind).toBe('gif')
    expect(n.quality).toBe(75)
    expect(n.frameDelayMs).toBe(83)
  })

  it('images-to-gif 默认 fps=10 / delay=100', () => {
    const n = normalizeGifOptions({}, 480, 'images-to-gif')
    expect(n.fps).toBe(10)
    expect(n.frameDelayMs).toBe(100)
  })

  it('gif-optimize 默认 fps=10 / maxEdge', () => {
    const n = normalizeGifOptions({}, undefined, 'gif-optimize')
    expect(n.fps).toBe(10)
    expect(n.maxEdge).toBe(480)
    expect(n.outputKind).toBe('gif')
  })

  it('isGifOptimizeInputPath', () => {
    expect(isGifOptimizeInputPath('a.gif')).toBe(true)
    expect(isGifOptimizeInputPath('b.WEBP')).toBe(true)
    expect(isGifOptimizeInputPath('c.png')).toBe(false)
    expect(isGifOptimizeInputPath('')).toBe(false)
  })

  it('frameDelayMs 优先于 fps', () => {
    const n = normalizeGifOptions(
      { fps: 24, frameDelayMs: 200 },
      480,
      'images-to-gif'
    )
    expect(n.frameDelayMs).toBe(200)
    expect(n.fps).toBe(5)
  })

  it('outputKind / webp quality', () => {
    expect(normalizeGifOutputKind(undefined)).toBe('gif')
    expect(normalizeGifOutputKind('webp')).toBe('webp')
    expect(normalizeGifOutputKind('nope')).toBe('gif')
    expect(normalizeGifWebpQuality(undefined)).toBe(75)
    expect(normalizeGifWebpQuality(80.4)).toBe(80)
    expect(normalizeGifWebpQuality(-1)).toBe(0)
    expect(normalizeGifWebpQuality(200)).toBe(100)
  })

  it('resolveGifTiming', () => {
    expect(resolveGifTiming(undefined, 'images-to-gif').fps).toBe(10)
    expect(resolveGifTiming({ fps: 15 }, 'video-to-gif').fps).toBe(15)
    expect(resolveGifTiming({ frameDelayMs: 50 }, 'images-to-gif').fps).toBe(20)
  })
})

describe('validateGifOptions', () => {
  it('非 gif 模式跳过', () => {
    expect(validateGifOptions(baseGifOptions({ mode: 'compress' }))).toBeNull()
  })

  it('trim 非法', () => {
    expect(
      validateGifOptions(
        baseGifOptions({ trimStart: 10, trimEnd: 5 })
      )
    ).toMatch(/结束时间/)
  })

  it('合法通过', () => {
    expect(validateGifOptions(baseGifOptions())).toBeNull()
  })

  it('images-to-gif 合法且忽略 trim', () => {
    expect(
      validateGifOptions(
        baseGifOptions({
          mode: 'images-to-gif',
          trimStart: 10,
          trimEnd: 5,
          gif: { fps: 10, outputKind: 'gif' }
        })
      )
    ).toBeNull()
  })
})

describe('buildGifVfChain / buildVideoToGifArgs', () => {
  it('vf 含 fps 与 scale', () => {
    const vf = buildGifVfChain({ fps: 12, maxEdge: 480 })
    expect(vf).toContain('fps=12')
    expect(vf).toContain('force_original_aspect_ratio=decrease')
  })

  it('maxEdge=0 时无 scale', () => {
    const vf = buildGifVfChain({ fps: 15, maxEdge: 0 })
    expect(vf).toBe('fps=15')
  })

  it('pass1 palettegen', () => {
    const args = buildVideoToGifArgs({
      inputPath: path.join('D:', 'in.mp4'),
      outputPath: path.join('D:', 'out.gif'),
      palettePath: path.join('D:', 'p.png'),
      options: baseGifOptions(),
      pass: 1
    })
    expect(args).toContain('-i')
    expect(args.some((a) => a.includes('palettegen'))).toBe(true)
    expect(args[args.length - 1]).toBe(path.join('D:', 'p.png'))
    expect(args).not.toContain('-loop')
  })

  it('pass2 paletteuse + loop', () => {
    const args = buildVideoToGifArgs({
      inputPath: path.join('D:', 'in.mp4'),
      outputPath: path.join('D:', 'out.gif'),
      palettePath: path.join('D:', 'p.png'),
      options: baseGifOptions({ gif: { fps: 10, loop: -1, dither: 'none' } }),
      pass: 2
    })
    const lavfi = args[args.indexOf('-lavfi') + 1]
    expect(lavfi).toContain('paletteuse')
    expect(lavfi).toContain('dither=none')
    expect(args).toContain('-loop')
    expect(args[args.indexOf('-loop') + 1]).toBe('-1')
    expect(args[args.length - 1]).toBe(path.join('D:', 'out.gif'))
  })

  it('trim 写入 seek', () => {
    const args = buildVideoToGifArgs({
      inputPath: 'a.mp4',
      outputPath: 'b.gif',
      palettePath: 'p.png',
      options: baseGifOptions({ trimStart: 1.5, trimEnd: 5 }),
      pass: 1
    })
    expect(args).toContain('-ss')
    expect(args).toContain('1.5')
    expect(args).toContain('-t')
  })

  it('webp：libwebp 单遍，无 palette', () => {
    const args = buildVideoToGifArgs({
      inputPath: path.join('D:', 'in.mp4'),
      outputPath: path.join('D:', 'out.webp'),
      palettePath: '',
      options: baseGifOptions({
        gif: {
          outputKind: 'webp',
          fps: 12,
          loop: 0,
          quality: 80
        }
      }),
      pass: 2
    })
    expect(args).toContain('-c:v')
    expect(args[args.indexOf('-c:v') + 1]).toBe('libwebp')
    expect(args).toContain('-quality')
    expect(args[args.indexOf('-quality') + 1]).toBe('80')
    expect(args).toContain('-loop')
    expect(args[args.indexOf('-loop') + 1]).toBe('0')
    expect(args).toContain('-an')
    expect(args.some((a) => a.includes('palettegen'))).toBe(false)
    expect(args.some((a) => a.includes('paletteuse'))).toBe(false)
    expect(args[args.length - 1]).toBe(path.join('D:', 'out.webp'))
  })

  it('webp：loop=-1 映射为播一次', () => {
    const args = buildVideoToGifArgs({
      inputPath: 'a.mp4',
      outputPath: 'b.webp',
      palettePath: '',
      options: baseGifOptions({
        gif: { outputKind: 'webp', loop: -1, quality: 75 }
      }),
      pass: 1
    })
    expect(args[args.indexOf('-loop') + 1]).toBe('1')
  })
})

describe('buildImagesToGifConcatList / buildImagesToGifArgs', () => {
  it('concat list 含 duration 且末帧重复', () => {
    const text = buildImagesToGifConcatList(
      [path.join('D:', 'a.png'), path.join('D:', 'b.png')],
      0.1
    )
    expect(text).toContain('ffconcat version 1.0')
    expect(text).toContain('duration 0.1')
    const fileLines = text.split('\n').filter((l) => l.startsWith('file '))
    expect(fileLines.length).toBe(3)
  })

  it('pass1 palettegen + concat', () => {
    const list = path.join('D:', 'list.ffconcat')
    const args = buildImagesToGifArgs({
      concatListPath: list,
      outputPath: path.join('D:', 'out.gif'),
      palettePath: path.join('D:', 'p.png'),
      options: baseGifOptions({
        mode: 'images-to-gif',
        gif: { fps: 10, colors: 128, outputKind: 'gif' }
      }),
      pass: 1
    })
    expect(args).toContain('-f')
    expect(args).toContain('concat')
    expect(args).toContain('-safe')
    expect(args).toContain(list)
    expect(args.some((a) => a.includes('palettegen'))).toBe(true)
    expect(args.some((a) => String(a).includes('fps='))).toBe(false)
  })

  it('pass2 paletteuse', () => {
    const args = buildImagesToGifArgs({
      concatListPath: 'list.txt',
      outputPath: 'out.gif',
      palettePath: 'p.png',
      options: baseGifOptions({
        mode: 'images-to-gif',
        gif: { fps: 10, dither: 'none', loop: 0 }
      }),
      pass: 2
    })
    const lavfi = args[args.indexOf('-lavfi') + 1]
    expect(lavfi).toContain('paletteuse')
    expect(lavfi).toContain('dither=none')
    expect(args[args.indexOf('-loop') + 1]).toBe('0')
  })

  it('webp 单遍', () => {
    const args = buildImagesToGifArgs({
      concatListPath: 'list.txt',
      outputPath: 'out.webp',
      palettePath: '',
      options: baseGifOptions({
        mode: 'images-to-gif',
        maxEdge: 320,
        gif: { outputKind: 'webp', quality: 70, loop: -1 }
      }),
      pass: 2
    })
    expect(args[args.indexOf('-c:v') + 1]).toBe('libwebp')
    expect(args[args.indexOf('-quality') + 1]).toBe('70')
    expect(args[args.indexOf('-loop') + 1]).toBe('1')
    expect(args.some((a) => a.includes('scale='))).toBe(true)
  })
})

describe('buildGifOptimizeArgs', () => {
  it('pass1 palettegen + fps/scale，无 seek', () => {
    const args = buildGifOptimizeArgs({
      inputPath: path.join('D:', 'in.gif'),
      outputPath: path.join('D:', 'out.gif'),
      palettePath: path.join('D:', 'p.png'),
      options: baseGifOptions({
        mode: 'gif-optimize',
        maxEdge: 480,
        gif: { fps: 10, colors: 128, outputKind: 'gif' },
        trimStart: 1,
        trimEnd: 5
      }),
      pass: 1
    })
    expect(args.some((a) => a.includes('palettegen'))).toBe(true)
    expect(args.some((a) => String(a).includes('fps=10'))).toBe(true)
    expect(args).not.toContain('-ss')
    expect(args[args.length - 1]).toBe(path.join('D:', 'p.png'))
  })

  it('pass2 paletteuse + loop', () => {
    const args = buildGifOptimizeArgs({
      inputPath: path.join('D:', 'in.webp'),
      outputPath: path.join('D:', 'out.gif'),
      palettePath: path.join('D:', 'p.png'),
      options: baseGifOptions({
        mode: 'gif-optimize',
        gif: { fps: 10, loop: 0, dither: 'bayer', outputKind: 'gif' }
      }),
      pass: 2
    })
    const lavfi = args[args.indexOf('-lavfi') + 1]
    expect(lavfi).toContain('paletteuse')
    expect(args).toContain('-loop')
    expect(args[args.indexOf('-loop') + 1]).toBe('0')
    expect(args[args.length - 1]).toBe(path.join('D:', 'out.gif'))
  })

  it('webp：libwebp 单遍', () => {
    const args = buildGifOptimizeArgs({
      inputPath: path.join('D:', 'in.gif'),
      outputPath: path.join('D:', 'out.webp'),
      palettePath: '',
      options: baseGifOptions({
        mode: 'gif-optimize',
        maxEdge: 320,
        gif: { outputKind: 'webp', fps: 10, quality: 70, loop: -1 }
      }),
      pass: 2
    })
    expect(args[args.indexOf('-c:v') + 1]).toBe('libwebp')
    expect(args[args.indexOf('-quality') + 1]).toBe('70')
    expect(args[args.indexOf('-loop') + 1]).toBe('1')
    expect(args.some((a) => a.includes('palettegen'))).toBe(false)
  })

  it('validateGifOptions 覆盖 gif-optimize', () => {
    expect(
      validateGifOptions(
        baseGifOptions({
          mode: 'gif-optimize',
          gif: { fps: 10, outputKind: 'gif', colors: 64 }
        })
      )
    ).toBeNull()
  })
})
