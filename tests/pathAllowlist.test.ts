import { afterEach, describe, expect, it } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import {
  _allowlistSizeForTests,
  _resetAllowlistForTests,
  allowDir,
  allowPath,
  canonicalizePath,
  isAllowedOutputDirForPersist,
  isPathAllowed,
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

  it('allowPath 对文件登记自身与父目录', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qy-allow-file-'))
    const file = path.join(dir, 'sample.png')
    fs.writeFileSync(file, 'x')
    allowPath(file)
    expect(isPathAllowed(file)).toBe(true)
    expect(isPathAllowed(path.join(dir, 'other.mp4'))).toBe(true)
    expect(isPathAllowed(path.join(dir, '..', 'outside.txt'))).toBe(false)
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
})
