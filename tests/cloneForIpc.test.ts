import { describe, expect, it } from 'vitest'
import { reactive, ref } from 'vue'
import { cloneForIpc } from '../shared/cloneForIpc'

describe('cloneForIpc', () => {
  it('剥离 Vue reactive Proxy，结果可 structuredClone', () => {
    const task = reactive({
      id: '1',
      options: {
        mode: 'video-mosaic',
        mosaics: [{ id: 'r1', x: 1, y: 2, w: 3, h: 4, mode: 'blur', strength: 8, startSec: 0 }]
      },
      nested: { a: 1 }
    })
    const plain = cloneForIpc(task)
    expect(plain).toEqual({
      id: '1',
      options: {
        mode: 'video-mosaic',
        mosaics: [{ id: 'r1', x: 1, y: 2, w: 3, h: 4, mode: 'blur', strength: 8, startSec: 0 }]
      },
      nested: { a: 1 }
    })
    expect(() => structuredClone(plain)).not.toThrow()
    expect(plain).not.toBe(task)
    expect(plain.options).not.toBe(task.options)
  })

  it('处理 ref 数组与函数字段', () => {
    const list = ref([
      {
        id: 'a',
        fn: () => 1,
        ok: true
      }
    ])
    const plain = cloneForIpc(list.value)
    expect(plain).toEqual([{ id: 'a', ok: true }])
    expect(() => structuredClone(plain)).not.toThrow()
  })
})
