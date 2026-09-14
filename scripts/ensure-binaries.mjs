/**
 * 检查并补装开发依赖中的原生/静态二进制（electron、ffmpeg、ffprobe、sharp 等）。
 * 国内网络下 postinstall 常失败，可用本脚本修复「Electron uninstall / FFmpeg 未就绪」。
 *
 * 用法：
 *   node scripts/ensure-binaries.mjs
 *   node scripts/ensure-binaries.mjs --force   # 强制重跑各 install
 *   npm run ensure:binaries
 */
import { spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const require = createRequire(path.join(root, 'package.json'))
const force = process.argv.includes('--force')

/** 国内镜像（仅在未设置时写入当前进程环境） */
function applyMirrors() {
  if (!process.env.ELECTRON_MIRROR) {
    process.env.ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/'
  }
  if (!process.env.FFMPEG_BINARIES_URL) {
    process.env.FFMPEG_BINARIES_URL =
      'https://cdn.npmmirror.com/binaries/ffmpeg-static'
  }
}

function exists(p) {
  try {
    return Boolean(p) && fs.existsSync(p)
  } catch {
    return false
  }
}

function log(msg) {
  console.log(msg)
}

function runNode(scriptRel, label) {
  const script = path.join(root, scriptRel)
  if (!exists(script)) {
    log(`  ✗ 找不到安装脚本: ${scriptRel}`)
    return false
  }
  log(`  → 运行 ${label} …`)
  const r = spawnSync(process.execPath, [script], {
    cwd: root,
    env: process.env,
    stdio: 'inherit'
  })
  if (r.status !== 0) {
    log(`  ✗ ${label} 失败 (exit ${r.status ?? 'null'})`)
    return false
  }
  return true
}

function runNpmRebuild(pkg, label) {
  log(`  → npm rebuild ${pkg} …`)
  const r = spawnSync(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['rebuild', pkg],
    {
      cwd: root,
      env: process.env,
      stdio: 'inherit',
      shell: process.platform === 'win32'
    }
  )
  if (r.status !== 0) {
    log(`  ✗ ${label} 失败 (exit ${r.status ?? 'null'})`)
    return false
  }
  return true
}

function resolveElectronExe() {
  try {
    const electronDir = path.dirname(require.resolve('electron/package.json'))
    const pathTxt = path.join(electronDir, 'path.txt')
    if (!exists(pathTxt)) return ''
    const rel = fs.readFileSync(pathTxt, 'utf8').trim()
    return path.join(electronDir, 'dist', rel)
  } catch {
    return ''
  }
}

function resolveFfmpeg() {
  try {
    return String(require('ffmpeg-static') || '')
  } catch {
    return ''
  }
}

function resolveFfprobe() {
  try {
    const mod = require('@ffprobe-installer/ffprobe')
    return String(mod?.path || '')
  } catch {
    return ''
  }
}

function checkSharp() {
  try {
    require('sharp')
    return true
  } catch {
    return false
  }
}

function checkResvg() {
  try {
    require('@resvg/resvg-js')
    return true
  } catch {
    return false
  }
}

applyMirrors()
log('轻影 · 检查本地二进制')
log(`工作目录: ${root}`)
log(`镜像 ELECTRON_MIRROR=${process.env.ELECTRON_MIRROR}`)
log(`镜像 FFMPEG_BINARIES_URL=${process.env.FFMPEG_BINARIES_URL}`)
log('')

/** @type {Array<{ id: string; label: string; ok: () => boolean; fix: () => boolean }>} */
const tasks = [
  {
    id: 'electron',
    label: 'Electron',
    ok: () => exists(resolveElectronExe()),
    fix: () => runNode('node_modules/electron/install.js', 'electron install')
  },
  {
    id: 'ffmpeg',
    label: 'ffmpeg-static',
    ok: () => exists(resolveFfmpeg()),
    fix: () =>
      runNode('node_modules/ffmpeg-static/install.js', 'ffmpeg-static install')
  },
  {
    id: 'ffprobe',
    label: '@ffprobe-installer/ffprobe',
    ok: () => exists(resolveFfprobe()),
    fix: () => {
      // 无独立 install.js 时，重装该包触发平台二进制下载
      log('  → npm install @ffprobe-installer/ffprobe --no-save …')
      const r = spawnSync(
        process.platform === 'win32' ? 'npm.cmd' : 'npm',
        ['install', '@ffprobe-installer/ffprobe', '--no-save'],
        {
          cwd: root,
          env: process.env,
          stdio: 'inherit',
          shell: process.platform === 'win32'
        }
      )
      if (r.status !== 0) {
        log(`  ✗ ffprobe 重装失败 (exit ${r.status ?? 'null'})`)
        return false
      }
      return exists(resolveFfprobe())
    }
  },
  {
    id: 'sharp',
    label: 'sharp',
    ok: () => checkSharp(),
    fix: () => runNpmRebuild('sharp', 'sharp rebuild')
  },
  {
    id: 'resvg',
    label: '@resvg/resvg-js',
    ok: () => checkResvg(),
    fix: () => runNpmRebuild('@resvg/resvg-js', 'resvg rebuild')
  }
]

let failed = 0
for (const t of tasks) {
  const before = t.ok()
  if (before && !force) {
    log(`✓ ${t.label} 已就绪`)
    continue
  }
  if (before && force) {
    log(`↻ ${t.label} 强制重装`)
  } else {
    log(`✗ ${t.label} 缺失，尝试补装`)
  }
  const fixed = t.fix()
  const after = t.ok()
  if (fixed && after) {
    log(`✓ ${t.label} 已修复`)
  } else {
    log(`✗ ${t.label} 仍不可用`)
    failed += 1
  }
  log('')
}

log('—— 结果 ——')
log(`Electron:  ${resolveElectronExe() || '(无)'}`)
log(`ffmpeg:    ${resolveFfmpeg() || '(无)'}`)
log(`ffprobe:   ${resolveFfprobe() || '(无)'}`)
log(`sharp:     ${checkSharp() ? 'ok' : 'fail'}`)
log(`resvg:     ${checkResvg() ? 'ok' : 'fail'}`)

if (failed > 0) {
  log('')
  log(`有 ${failed} 项未就绪。可检查网络，或手动设置镜像后重试：`)
  log('  set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/')
  log(
    '  set FFMPEG_BINARIES_URL=https://cdn.npmmirror.com/binaries/ffmpeg-static'
  )
  log('  npm run ensure:binaries')
  process.exit(1)
}

log('')
log('全部就绪。可执行: npm run dev')
process.exit(0)
