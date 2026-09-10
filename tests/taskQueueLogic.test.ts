import { describe, expect, it } from 'vitest'
import {
  clampTaskConcurrency,
  filterCancelAllTaskIds,
  isStaleQueueItem,
  shouldCountInBatchNotify,
  shouldNotifyCancelOnDrop,
  shouldSendTaskIpcToDesktop
} from '@shared/taskQueueLogic'

describe('taskQueue 纯逻辑', () => {
  describe('clampTaskConcurrency', () => {
    it('钳制到 1–4', () => {
      expect(clampTaskConcurrency(1)).toBe(1)
      expect(clampTaskConcurrency(4)).toBe(4)
      expect(clampTaskConcurrency(2.9)).toBe(2)
      expect(clampTaskConcurrency(0)).toBe(1)
      expect(clampTaskConcurrency(-3)).toBe(1)
      expect(clampTaskConcurrency(99)).toBe(4)
      expect(clampTaskConcurrency(Number.NaN)).toBe(1)
    })
  })

  describe('shouldNotifyCancelOnDrop', () => {
    it('用户取消推终态；同 id 替换不推', () => {
      expect(shouldNotifyCancelOnDrop('cancelled')).toBe(true)
      expect(shouldNotifyCancelOnDrop('replaced')).toBe(false)
    })
  })

  describe('isStaleQueueItem', () => {
    it('无 item 或仍是当前 running → 不过期', () => {
      const item = { id: 'a' }
      const running = new Map([['t1', item]])
      expect(isStaleQueueItem('t1', undefined, running)).toBe(false)
      expect(isStaleQueueItem('t1', item, running)).toBe(false)
    })

    it('同 id 已被新 item 替换 → 旧 item 过期', () => {
      const oldItem = { id: 'old' }
      const newItem = { id: 'new' }
      const running = new Map([['t1', newItem]])
      expect(isStaleQueueItem('t1', oldItem, running)).toBe(true)
    })

    it('running 已删该 id（取消释放槽）→ 旧 item 过期', () => {
      const oldItem = { id: 'old' }
      const running = new Map<string, typeof oldItem>()
      expect(isStaleQueueItem('t1', oldItem, running)).toBe(true)
    })
  })

  describe('LAN 分流', () => {
    const lan = new Set(['lan-1', 'lan-2'])

    it('shouldSendTaskIpcToDesktop：LAN 不推桌面', () => {
      expect(shouldSendTaskIpcToDesktop(undefined, lan)).toBe(true)
      expect(shouldSendTaskIpcToDesktop('desk-1', lan)).toBe(true)
      expect(shouldSendTaskIpcToDesktop('lan-1', lan)).toBe(false)
    })

    it('shouldCountInBatchNotify：排除 LAN', () => {
      expect(shouldCountInBatchNotify('desk-1', lan)).toBe(true)
      expect(shouldCountInBatchNotify('lan-2', lan)).toBe(false)
    })

    it('filterCancelAllTaskIds：默认只桌面；includeLan 全清', () => {
      const ids = ['desk-1', 'lan-1', 'desk-1', 'lan-2']
      expect(filterCancelAllTaskIds(ids, lan, false)).toEqual(['desk-1'])
      expect(filterCancelAllTaskIds(ids, lan, true).sort()).toEqual([
        'desk-1',
        'lan-1',
        'lan-2'
      ])
    })
  })
})
