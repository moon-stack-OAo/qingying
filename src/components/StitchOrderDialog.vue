<script lang="ts" setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { IMAGE_LAYOUT_OPTIONS } from '@shared/types'

export type StitchLayout = 'horizontal' | 'vertical' | 'grid'

export interface StitchOrderConfirmPayload {
  paths: string[]
  layout?: StitchLayout
  gridCols?: number
  gap?: number
  background?: string
}

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    mode: 'image-stitch' | 'video-concat'
    paths: string[]
    editable?: boolean
    layout?: StitchLayout
    gridCols?: number
    gap?: number
    background?: string
  }>(),
  {
    editable: true,
    layout: 'horizontal',
    gridCols: 2,
    gap: 0,
    background: '#000000'
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: [payload: StitchOrderConfirmPayload]
  append: []
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v)
})

const draftPaths = ref<string[]>([])
const draftLayout = ref<StitchLayout>('horizontal')
const draftGridCols = ref(2)
const draftGap = ref(0)
const draftBackground = ref('#000000')

/** 指针拖拽（Electron 下 HTML5 DnD 常失效） */
const dragFrom = ref<number | null>(null)
/** 插入指示：悬停行上方插入为该 index，下方为 index+1 */
const insertAt = ref<number | null>(null)
const listEl = ref<HTMLElement | null>(null)
let autoScrollRaf = 0

const isImageStitch = computed(() => props.mode === 'image-stitch')
const dialogTitle = computed(() =>
  isImageStitch.value ? '编辑图片拼接顺序' : '编辑视频拼接顺序'
)
const unitLabel = computed(() => (isImageStitch.value ? '张' : '段'))

function baseName(p: string): string {
  const s = p.replace(/\\/g, '/')
  const i = s.lastIndexOf('/')
  return i >= 0 ? s.slice(i + 1) : s
}

function resetDraft(): void {
  draftPaths.value = (props.paths || [])
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean)
  draftLayout.value =
    props.layout === 'vertical' || props.layout === 'grid'
      ? props.layout
      : 'horizontal'
  draftGridCols.value =
    typeof props.gridCols === 'number' && Number.isFinite(props.gridCols)
      ? Math.max(1, Math.min(20, Math.round(props.gridCols)))
      : 2
  draftGap.value =
    typeof props.gap === 'number' && Number.isFinite(props.gap)
      ? Math.max(0, Math.min(500, Math.round(props.gap)))
      : 0
  draftBackground.value =
    typeof props.background === 'string' && props.background.trim()
      ? props.background.trim()
      : '#000000'
  stopPointerDrag()
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) resetDraft()
    else stopPointerDrag()
  }
)

/**
 * 弹窗内「追加文件」后父级 paths 会变：保留已拖拽顺序，仅追加新项
 */
watch(
  () =>
    props.paths
      .map((p) => String(p || '').trim())
      .filter(Boolean)
      .join('\0'),
  () => {
    if (!props.modelValue) return
    if (dragFrom.value != null) return
    const incoming = (props.paths || [])
      .map((p) => (typeof p === 'string' ? p.trim() : ''))
      .filter(Boolean)
    const kept = draftPaths.value.filter((p) => incoming.includes(p))
    const added = incoming.filter((p) => !draftPaths.value.includes(p))
    draftPaths.value = kept.concat(added)
  }
)

function moveItem(from: number, to: number): void {
  if (from === to) return
  if (from < 0 || to < 0) return
  if (from >= draftPaths.value.length || to >= draftPaths.value.length) return
  const next = draftPaths.value.slice()
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  draftPaths.value = next
}

/** 根据指针 Y 得到插入位置 [0..length] */
function insertIndexFromClientY(clientY: number): number | null {
  const root = listEl.value
  if (!root) return null
  const rows = root.querySelectorAll<HTMLElement>('[data-stitch-row]')
  if (!rows.length) return 0
  for (let i = 0; i < rows.length; i++) {
    const rect = rows[i].getBoundingClientRect()
    const mid = rect.top + rect.height / 2
    if (clientY < mid) return i
  }
  return rows.length
}

function cancelAutoScroll(): void {
  if (autoScrollRaf) {
    cancelAnimationFrame(autoScrollRaf)
    autoScrollRaf = 0
  }
}

function maybeAutoScroll(clientY: number): void {
  const root = listEl.value
  if (!root) return
  const rect = root.getBoundingClientRect()
  const edge = 36
  let dy = 0
  if (clientY < rect.top + edge) {
    dy = -Math.ceil((rect.top + edge - clientY) / 4)
  } else if (clientY > rect.bottom - edge) {
    dy = Math.ceil((clientY - (rect.bottom - edge)) / 4)
  }
  if (!dy) {
    cancelAutoScroll()
    return
  }
  if (autoScrollRaf) return
  const step = (): void => {
    autoScrollRaf = 0
    if (dragFrom.value == null || !listEl.value) return
    listEl.value.scrollTop += dy
    // 继续滚动直到离开边缘（下一 pointermove 会重新判定）
  }
  autoScrollRaf = requestAnimationFrame(step)
}

function onPointerMove(e: PointerEvent): void {
  if (dragFrom.value == null) return
  maybeAutoScroll(e.clientY)
  const over = insertIndexFromClientY(e.clientY)
  if (over == null) return
  insertAt.value = over

  // 将拖拽项移到插入槽对应位置（插入 index 在源之后时需 -1）
  const from = dragFrom.value
  let to = over
  if (to > from) to -= 1
  if (to !== from) {
    moveItem(from, to)
    dragFrom.value = to
  }
}

function stopPointerDrag(): void {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerUp)
  cancelAutoScroll()
  dragFrom.value = null
  insertAt.value = null
}

function onPointerUp(): void {
  stopPointerDrag()
}

function onHandlePointerDown(index: number, e: PointerEvent): void {
  if (!props.editable) return
  if (e.button !== 0) return
  e.preventDefault()
  e.stopPropagation()
  dragFrom.value = index
  insertAt.value = index
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)
  try {
    ;(e.currentTarget as HTMLElement | null)?.setPointerCapture?.(e.pointerId)
  } catch {
    // ignore
  }
}

onBeforeUnmount(() => {
  stopPointerDrag()
})

function moveUp(index: number): void {
  if (index <= 0) return
  moveItem(index, index - 1)
}

function moveDown(index: number): void {
  if (index >= draftPaths.value.length - 1) return
  moveItem(index, index + 1)
}

function removeAt(index: number): void {
  if (draftPaths.value.length <= 1) {
    ElMessage.warning('至少保留 1 个文件')
    return
  }
  draftPaths.value = draftPaths.value.filter((_, i) => i !== index)
}

function confirm(): void {
  if (draftPaths.value.length < 2) {
    ElMessage.warning(
      isImageStitch.value
        ? '图片拼接至少需要 2 张图片'
        : '视频拼接至少需要 2 段视频'
    )
    return
  }
  const payload: StitchOrderConfirmPayload = {
    paths: draftPaths.value.slice()
  }
  if (isImageStitch.value) {
    payload.layout = draftLayout.value
    payload.gridCols = draftGridCols.value
    payload.gap = draftGap.value
    payload.background = draftBackground.value
  }
  emit('confirm', payload)
  visible.value = false
}

function showInsertLine(idx: number): boolean {
  if (insertAt.value == null || dragFrom.value == null) return false
  // 插入线画在目标行顶部；末尾用最后一行底部
  return insertAt.value === idx
}

function showInsertAfterLast(): boolean {
  if (insertAt.value == null || dragFrom.value == null) return false
  return insertAt.value === draftPaths.value.length
}
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="dialogTitle"
    width="560px"
    destroy-on-close
    append-to-body
  >
    <p class="hint">
      {{
        editable
          ? `按住左侧 ⋮⋮ 拖动调整${unitLabel}顺序（自上而下即拼接顺序）；也可用上移/下移`
          : '当前任务不可编辑顺序'
      }}
    </p>

    <div v-if="isImageStitch" class="layout-row">
      <div class="opt-item">
        <span class="label">布局方向</span>
        <el-select
          v-model="draftLayout"
          size="small"
          class="w-layout"
          :disabled="!editable"
        >
          <el-option
            v-for="opt in IMAGE_LAYOUT_OPTIONS"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
      </div>
      <div v-if="draftLayout === 'grid'" class="opt-item">
        <span class="label">列数</span>
        <el-input-number
          v-model="draftGridCols"
          :min="1"
          :max="20"
          :step="1"
          size="small"
          controls-position="right"
          :disabled="!editable"
        />
      </div>
      <div class="opt-item">
        <span class="label">间距</span>
        <el-input-number
          v-model="draftGap"
          :min="0"
          :max="500"
          :step="1"
          size="small"
          controls-position="right"
          :disabled="!editable"
        />
        <span class="unit">px</span>
      </div>
      <div class="opt-item">
        <span class="label">背景</span>
        <el-input
          v-model="draftBackground"
          size="small"
          class="w-bg"
          placeholder="#000000"
          :disabled="!editable"
        />
      </div>
    </div>

    <div ref="listEl" class="list">
      <div
        v-for="(p, idx) in draftPaths"
        :key="`${idx}\0${p}`"
        class="row"
        data-stitch-row
        :class="{ 'is-dragging': dragFrom === idx }"
      >
        <div v-if="showInsertLine(idx)" class="insert-line" aria-hidden="true" />
        <button
          v-if="editable"
          type="button"
          class="handle"
          title="按住拖动排序"
          aria-label="拖动排序"
          @pointerdown="onHandlePointerDown(idx, $event)"
        >
          ⋮⋮
        </button>
        <span v-else class="handle is-disabled">⋮⋮</span>
        <span class="idx">{{ idx + 1 }}.</span>
        <el-tooltip :content="p" placement="top" :show-after="400">
          <span class="name">{{ baseName(p) }}</span>
        </el-tooltip>
        <template v-if="editable">
          <el-button link size="small" :disabled="idx === 0" @click="moveUp(idx)">
            上移
          </el-button>
          <el-button
            link
            size="small"
            :disabled="idx >= draftPaths.length - 1"
            @click="moveDown(idx)"
          >
            下移
          </el-button>
          <el-button
            link
            size="small"
            type="danger"
            :disabled="draftPaths.length <= 1"
            @click="removeAt(idx)"
          >
            移除
          </el-button>
        </template>
      </div>
      <div v-if="showInsertAfterLast()" class="insert-line is-tail" aria-hidden="true" />
      <div v-if="!draftPaths.length" class="empty">暂无文件</div>
    </div>

    <div v-if="editable" class="footer-extra">
      <el-button size="small" type="primary" plain @click="emit('append')">
        追加文件
      </el-button>
      <span v-if="draftPaths.length < 2" class="warn">
        至少 2 {{ unitLabel }}才能启动
      </span>
    </div>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :disabled="!editable" @click="confirm">
        保存
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.hint {
  margin: 0 0 12px;
  font-size: var(--fs-sm, 12px);
  color: var(--app-fg-muted, #888);
  line-height: 1.45;
}

.layout-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 14px;
  margin-bottom: 12px;
}

.opt-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.label {
  font-size: var(--fs-sm, 12px);
  color: var(--app-fg-secondary, #666);
  white-space: nowrap;
}

.unit {
  font-size: var(--fs-sm, 12px);
  color: var(--app-fg-muted, #888);
}

.w-layout {
  width: 100px;
}

.w-bg {
  width: 110px;
}

.list {
  max-height: min(420px, 52vh);
  overflow: auto;
  border: 1px solid var(--panel-border, #e5e5e5);
  border-radius: var(--radius-xs, 4px);
  padding: 4px;
}

.row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 8px;
  border-radius: var(--radius-xs, 4px);
  font-size: var(--fs-sm, 12px);
  user-select: none;
}

.row + .row {
  margin-top: 2px;
}

.row.is-dragging {
  opacity: 0.45;
}

.insert-line {
  position: absolute;
  left: 4px;
  right: 4px;
  top: -1px;
  height: 2px;
  border-radius: 1px;
  background: var(--el-color-primary, #409eff);
  pointer-events: none;
  z-index: 2;
}

.insert-line.is-tail {
  position: relative;
  top: auto;
  margin: 2px 4px 4px;
}

.handle {
  flex-shrink: 0;
  margin: 0;
  padding: 2px 4px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--app-fg-muted, #888);
  cursor: grab;
  letter-spacing: -2px;
  width: 22px;
  text-align: center;
  line-height: 1;
  touch-action: none;
  user-select: none;
}

.handle:hover {
  background: color-mix(in srgb, var(--app-fg) 8%, transparent);
  color: var(--app-fg-secondary, #666);
}

.handle:active {
  cursor: grabbing;
}

.handle.is-disabled {
  cursor: default;
  opacity: 0.45;
}

.idx {
  flex-shrink: 0;
  color: var(--app-fg-muted, #888);
  font-variant-numeric: tabular-nums;
  min-width: 1.6em;
}

.name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--app-fg-secondary, #666);
}

.empty {
  padding: 28px;
  text-align: center;
  color: var(--app-fg-muted, #888);
}

.footer-extra {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
  flex-wrap: wrap;
}

.warn {
  font-size: var(--fs-sm, 12px);
  color: var(--el-color-warning);
}
</style>
