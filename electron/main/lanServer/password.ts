import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'

/** scrypt 参数：N=16384, r=8, p=1；输出 32 字节 */
const SCRYPT_N = 16384
const SCRYPT_R = 8
const SCRYPT_P = 1
const KEY_LEN = 32
const SALT_LEN = 16

/** 局域网远程密码最短长度 */
export const LAN_PASSWORD_MIN_LENGTH = 8
/** 局域网远程密码最长长度 */
export const LAN_PASSWORD_MAX_LENGTH = 128

/**
 * 校验局域网密码明文强度；通过返回 null，失败返回中文错误
 */
export function validateLanPassword(password: string): string | null {
  if (typeof password !== 'string' || password.length === 0) {
    return '请输入密码'
  }
  if (password.length < LAN_PASSWORD_MIN_LENGTH) {
    return `密码至少 ${LAN_PASSWORD_MIN_LENGTH} 位`
  }
  if (password.length > LAN_PASSWORD_MAX_LENGTH) {
    return '密码过长'
  }
  return null
}

/**
 * 生成密码哈希：格式 scrypt$N$r$p$saltB64$hashB64
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LEN)
  const hash = scryptSync(password, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P
  })
  return [
    'scrypt',
    String(SCRYPT_N),
    String(SCRYPT_R),
    String(SCRYPT_P),
    salt.toString('base64'),
    hash.toString('base64')
  ].join('$')
}

/**
 * 是否为当前允许的 scrypt 参数（拒绝 settings 中被篡改的超大 N/r/p，防 CPU DoS）
 */
export function isAllowedScryptParams(N: number, r: number, p: number): boolean {
  return N === SCRYPT_N && r === SCRYPT_R && p === SCRYPT_P
}

/**
 * 校验密码与存储哈希是否匹配（常量时间比较）
 * 仅接受与 hashPassword 一致的固定 (N,r,p)
 */
export function verifyPassword(password: string, stored: string): boolean {
  if (!stored || typeof stored !== 'string') return false
  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const N = Number(parts[1])
  const r = Number(parts[2])
  const p = Number(parts[3])
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) {
    return false
  }
  // 不信任存储中的任意 scrypt 参数，只允许固定集合
  if (!isAllowedScryptParams(N, r, p)) {
    return false
  }
  try {
    const salt = Buffer.from(parts[4], 'base64')
    const expected = Buffer.from(parts[5], 'base64')
    if (salt.length === 0 || expected.length === 0) return false
    const actual = scryptSync(password, salt, expected.length, {
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P
    })
    if (actual.length !== expected.length) return false
    return timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}
