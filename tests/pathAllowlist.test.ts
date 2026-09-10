import { afterEach, describe, expect, it } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import {
  _allowlistSizeForTests,
  _resetAllowlistForTests,
  allowDir,
  allowOutputPath,
  allowPath,
  canAllowSidecarOutput,
  canonicalizePath,
  ensureOutputPathAllowed,
  isAllowedDataDirForSet,
  isAllowedOutputDirForPersist,
  isPathAllowed,
  isPathInsideAnyRoot,
  isPathInsideRoot,
  pathNotAllowedError,
  safeJoinUnderRoot
} from '../electron/main/pathAllowlist'

describe('pathAllowlist', () => {
  afterEach(() => {
    _resetAllowlistForTests()
  })

  it('canonicalizePath 去尾部分隔符并在 Windows 上小写', () => {
    const c = canonicalizePath('C:\\Foo\\Bar\\')
    expect(c).toBeTruthy()
    if (process.platform === 'win32') {
      expect(c).toBe(path.resolve('C:\\Foo\\Bar').toLowerCase())
    }
  })

  it('allowDir 允许目录及其子路径', () => {
    const root = path.join(os.tmpdir(), 'qy-allow-dir-test')
    allowDir(root)
    expect(isPathAllowed(root)).toBe(true)
    expect(isPathAllowed(path.join(root, 'a.jpg'))).toBe(true)
    expect(isPathAllowed(path.join(root, 'sub', 'b.mp4'))).toBe(true)
    expect(isPathAllowed(path.join(os.tmpdir(), 'other', 'x.jpg'))).toBe(false)
  })

  it('allowPath 仅登记精确文件，不放开同目录其他文件', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qy-allow-file-'))
    const file = path.join(dir, 'sample.png')
    fs.writeFileSync(file, 'x')
    allowPath(file)
    expect(isPathAllowed(file)).toBe(true)
    expect(isPathAllowed(path.join(dir, 'other.mp4'))).toBe(false)
    expect(isPathAllowed(path.join(dir, '..', 'outside.txt'))).toBe(false)
    expect(_allowlistSizeForTests().dirs).toBe(0)
    expect(_allowlistSizeForTests().files).toBe(1)
  })

  it('allowOutputPath 与 allowPath 对文件同为精确登记', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qy-allow-out-'))
    const out = path.join(dir, 'out.mp4')
    allowOutputPath(out)
    expect(isPathAllowed(out)).toBe(true)
    expect(isPathAllowed(path.join(dir, 'other.mp4'))).toBe(false)
  })

  it('canAllowSidecarOutput：同父目录且输入已允许时为 true', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qy-sidecar-'))
    const input = path.join(dir, 'in.mp4')
    const output = path.join(dir, 'in_compressed.mp4')
    const otherDir = path.join(dir, 'sub')
    fs.mkdirSync(otherDir)
    const elsewhere = path.join(otherDir, 'out.mp4')
    fs.writeFileSync(input, 'x')
    allowPath(input)
    expect(canAllowSidecarOutput(input, output)).toBe(true)
    expect(canAllowSidecarOutput(input, elsewhere)).toBe(false)
    expect(canAllowSidecarOutput('', output)).toBe(false)
  })

  it('ensureOutputPathAllowed：已允许目录内直接 OK；同父旁路可登记精确文件', () => {
    const fixedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'qy-fixed-out-'))
    allowDir(fixedRoot)
    const inFixed = path.join(fixedRoot, 'a_out.mp4')
    expect(ensureOutputPathAllowed(inFixed, [])).toBe(true)
    expect(isPathAllowed(inFixed)).toBe(true)

    const sideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qy-side-out-'))
    const input = path.join(sideDir, 'src.png')
    const output = path.join(sideDir, 'src_out.jpg')
    const evil = path.join(os.tmpdir(), 'qy-evil-out', 'x.jpg')
    fs.writeFileSync(input, 'x')
    allowPath(input)
    expect(ensureOutputPathAllowed(output, [input])).toBe(true)
    expect(isPathAllowed(output)).toBe(true)
    expect(isPathAllowed(path.join(sideDir, 'neighbor.png'))).toBe(false)
    expect(ensureOutputPathAllowed(evil, [input])).toBe(false)
  })

  it('allowPath 对已存在目录按目录登记', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qy-allow-exist-dir-'))
    allowPath(dir)
    expect(isPathAllowed(path.join(dir, 'nested', 'f.bin'))).toBe(true)
  })

  it('拒绝路径穿越到允许目录之外', () => {
    const root = path.join(os.tmpdir(), 'qy-allow-escape')
    allowDir(root)
    const escaped = path.join(root, '..', 'secret.txt')
    expect(isPathAllowed(escaped)).toBe(false)
  })

  it('pathNotAllowedError 返回中文', () => {
    expect(pathNotAllowedError('输入路径')).toContain('不在允许访问范围内')
  })

  it('_resetAllowlistForTests 清空集合', () => {
    allowDir(path.join(os.tmpdir(), 'qy-reset'))
    expect(_allowlistSizeForTests().dirs).toBeGreaterThan(0)
    _resetAllowlistForTests()
    expect(_allowlistSizeForTests()).toEqual({ dirs: 0, files: 0 })
  })

  it('isPathInsideRoot 拒绝跳出与前缀误判', () => {
    const root = path.join(os.tmpdir(), 'qy-inside-root')
    expect(isPathInsideRoot(root, path.join(root, 'a.mp4'))).toBe(true)
    expect(isPathInsideRoot(root, path.join(root, '..', 'secret.txt'))).toBe(false)
    // 前缀相似目录不应误判为内部
    expect(isPathInsideRoot(root, root + '-evil' + path.sep + 'x.bin')).toBe(false)
  })

  it('safeJoinUnderRoot 拒绝路径穿越', () => {
    const root = path.join(os.tmpdir(), 'qy-safe-join-public')
    expect(safeJoinUnderRoot(root, '/index.html')).toBe(
      path.resolve(root, 'index.html')
    )
    expect(safeJoinUnderRoot(root, '/assets/app.js')).toBe(
      path.resolve(root, 'assets', 'app.js')
    )
    expect(safeJoinUnderRoot(root, '/../secret.txt')).toBeNull()
    expect(safeJoinUnderRoot(root, '/..%2Fsecret.txt')).toBeNull()
    expect(safeJoinUnderRoot(root, '/%2e%2e/secret.txt')).toBeNull()
  })

  it('isAllowedOutputDirForPersist 拒绝未入白名单的新路径回灌', () => {
    const trusted = path.join(os.tmpdir(), 'qy-trusted-out')
    const evil = path.join(os.tmpdir(), 'qy-evil-out')
    expect(isAllowedOutputDirForPersist('', trusted)).toBe(true)
    expect(isAllowedOutputDirForPersist(trusted, trusted)).toBe(true)
    expect(isAllowedOutputDirForPersist(trusted + path.sep, trusted)).toBe(true)
    expect(isAllowedOutputDirForPersist(evil, trusted)).toBe(false)
    allowDir(evil)
    expect(isAllowedOutputDirForPersist(evil, trusted)).toBe(true)
  })

  it('isAllowedDataDirForSet 拒绝未入白名单的新数据目录', () => {
    const current = path.join(os.tmpdir(), 'qy-userdata-cur')
    const next = path.join(os.tmpdir(), 'qy-userdata-next')
    expect(isAllowedDataDirForSet('', current)).toBe(false)
    expect(isAllowedDataDirForSet(current, current)).toBe(true)
    expect(isAllowedDataDirForSet(current + path.sep, current)).toBe(true)
    expect(isAllowedDataDirForSet(next, current)).toBe(false)
    allowDir(next)
    expect(isAllowedDataDirForSet(next, current)).toBe(true)
  })

  it('isPathInsideAnyRoot 任一根命中即可', () => {
    const uploads = path.join(os.tmpdir(), 'qy-lan-uploads')
    const outputs = path.join(os.tmpdir(), 'qy-lan-outputs')
    const outside = path.join(os.tmpdir(), 'qy-outside', 'secret.mp4')
    expect(
      isPathInsideAnyRoot([uploads, outputs], path.join(uploads, 'a.jpg'))
    ).toBe(true)
    expect(
      isPathInsideAnyRoot([uploads, outputs], path.join(outputs, 'b.mp4'))
    ).toBe(true)
    expect(isPathInsideAnyRoot([uploads, outputs], outside)).toBe(false)
    expect(isPathInsideAnyRoot(['', '  '], path.join(uploads, 'a.jpg'))).toBe(
      false
    )
  })
})
