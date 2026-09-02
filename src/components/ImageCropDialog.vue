<script lang="ts" setup>
import {computed, ref, watch} from 'vue'
import ImageCropCanvas from './ImageCropCanvas.vue'
import {type CropRect, roundCropRect} from '@shared/cropUiLogic'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    /** 预览图片本地路径（图片模式） */
    imagePath: string
    crop: CropRect
    /** 对话框标题 */
    title?: string
    /** 额外说明（如视频参考图提示） */
    hint?: string
    /** 预加载 dataUrl（视频抽帧）；有则优先于 imagePath 加载 */
    initialDataUrl?: string
    /** 与 initialDataUrl 配套的源视频/图显示宽 */
    naturalWidth?: number
    /** 与 initialDataUrl 配套的源视频/图显示高 */
    naturalHeight?: number
    /** 视频路径：提供时显示时间点重新抽帧 */
    videoPath?: string
    /** 当前抽帧时间点（秒） */
    frameTimeSec?: number
  }>(),
  {
    title: '图片裁切',
    hint: '',
    initialDataUrl: '',
    naturalWidth: 0,
    naturalHeight: 0,
    videoPath: '',
    frameTimeSec: 0
  }
)

const emit = defineEmits<{
  'update:modelValue': [v: boolean]
  confirm: [rect: CropRect]
}>()

const loading = ref(false)
const error = ref('')
const dataUrl = ref('')
const naturalWidth = ref(0)
const naturalHeight = ref(0)
const draft = ref<CropRect>({ x: 0, y: 0, w: 0, h: 0 })
/** 0 = 自由 */
const aspectKey = ref(0)
/** 视频抽帧时间点 */
const timeSec = ref(0)

const aspectOptions: Array<{ label: string; value: number; ratio: number | null }> = [
  { label: '自由', value: 0, ratio: null },
  { label: '1:1', value: 1, ratio: 1 },
  { label: '4:3', value: 2, ratio: 4 / 3 },
  { label: '16:9', value: 3, ratio: 16 / 9 },
  { label: '9:16', value: 4, ratio: 9 / 16 }
]

const aspectRatio = computed((): number | null => {
  const opt = aspectOptions.find((o) => o.value === aspectKey.value)
  return opt?.ratio ?? null
})

const visible = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v)
})

const sizeLabel = computed(() => {
  if (!(naturalWidth.value > 0 && naturalHeight.value > 0)) return ''
  return `${naturalWidth.value} × ${naturalHeight.value}`
})

const isVideoMode = computed(
  () => !!(props.videoPath && props.videoPath.trim())
)

function applyDraftFromProps(): void {
  draft.value = {
    x: props.crop.x,
    y: props.crop.y,
    w: props.crop.w,
    h: props.crop.h
  }
}

function applyPreloaded(): boolean {
  const url = (props.initialDataUrl || '').trim()
  const w = props.naturalWidth || 0
  const h = props.naturalHeight || 0
  if (!url || !(w > 0 && h > 0)) return false
  dataUrl.value = url
  naturalWidth.value = w
  naturalHeight.value = h
  applyDraftFromProps()
  return true
}

async function loadPreview(path: string): Promise<void> {
  loading.value = true
  error.value = ''
  dataUrl.value = ''
  naturalWidth.value = 0
  naturalHeight.value = 0
  try {
    const api = window.electronAPI
    if (!api?.getImageDataUrl) {
      error.value = '预览接口不可用'
      return
    }
    const res = await api.getImageDataUrl(path)
    if (!res.ok || !res.dataUrl) {
      error.value = res.error || '加载预览失败'
      return
    }
    dataUrl.value = res.dataUrl
    naturalWidth.value = res.width || 0
    naturalHeight.value = res.height || 0
    applyDraftFromProps()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

async function loadVideoFrame(t: number): Promise<void> {
  const vpath = (props.videoPath || '').trim()
  if (!vpath) return
  loading.value = true
  error.value = ''
  try {
    const api = window.electronAPI
    if (!api?.extractVideoFrame) {
      error.value = '抽帧接口不可用'
      return
    }
    const res = await api.extractVideoFrame({
      path: vpath,
      timeSec: t,
      maxEdge: 1600
    })
    if (!res.ok || !res.dataUrl) {
      error.value = res.error || '抽帧失败'
      return
    }
    dataUrl.value = res.dataUrl
    if (res.width && res.height) {
      naturalWidth.value = res.width
      naturalHeight.value = res.height
    }
    // 换帧时保留已有 draft（同分辨率坐标系）
    if (!(draft.value.w > 0 && draft.value.h > 0)) {
      applyDraftFromProps()
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

function onRefreshFrame(): void {
  const t =
    typeof timeSec.value === 'number' && Number.isFinite(timeSec.value)
      ? Math.max(0, timeSec.value)
      : 0
  timeSec.value = t
  void loadVideoFrame(t)
}

watch(
  () =>
    [
      props.modelValue,
      props.imagePath,
      props.initialDataUrl,
      props.videoPath
    ] as const,
  ([open]) => {
    if (open) {
      aspectKey.value = 0
      timeSec.value =
        typeof props.frameTimeSec === 'number' &&
        Number.isFinite(props.frameTimeSec)
          ? Math.max(0, props.frameTimeSec)
          : 0
      if (applyPreloaded()) {
        loading.value = false
        error.value = ''
        return
      }
      const path = (props.imagePath || '').trim()
      if (path) {
        void loadPreview(path)
      } else {
        error.value = '无预览路径'
      }
    }
    if (!open) {
      dataUrl.value = ''
      error.value = ''
    }
  }
)

function onConfirm(): void {
  if (!(draft.value.w > 0 && draft.value.h > 0)) {
    error.value = '请选择有效的裁切区域（宽高须大于 0）'
    return
  }
  emit(
    'confirm',
    roundCropRect(draft.value, naturalWidth.value || 1, naturalHeight.value || 1)
  )
  emit('update:modelValue', false)
}

function onCancel(): void {
  emit('update:modelValue', false)
}
</script>

<template>
  <el-dialog
    v-model="visible"
    align-center
    destroy-on-close
    append-to-body
    class="image-crop-dialog"
    width="min(920px, 96vw)"
  >
    <template #header>
      <div class="dlg-head-text">
        <div class="dlg-title">{{ title }}</div>
        <div v-if="sizeLabel || hint" class="dlg-sub">
          <template v-if="sizeLabel">原图 {{ sizeLabel }}</template>
          <template v-if="sizeLabel && hint"> · </template>
          <template v-if="hint">{{ hint }}</template>
        </div>
      </div>
    </template>

    <div v-if="loading" class="crop-dialog-status">加载预览中…</div>
    <el-alert
      v-else-if="error"
      type="error"
      :title="error"
      show-icon
      :closable="false"
      class="crop-dialog-alert"
    />
    <template v-else-if="dataUrl">
      <div class="crop-dialog-toolbar">
        <span class="label">比例</span>
        <el-radio-group v-model="aspectKey" size="small">
          <el-radio-button
            v-for="opt in aspectOptions"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }}
          </el-radio-button>
        </el-radio-group>
        <span class="toolbar-hint">拖拽框边缘改尺寸；框内拖动改位置</span>
      </div>
      <div v-if="isVideoMode" class="crop-dialog-toolbar">
        <span class="label">时间点(秒)</span>
        <el-input-number
          v-model="timeSec"
          :min="0"
          :max="86400"
          :step="0.5"
          :precision="2"
          size="small"
          controls-position="right"
          class="w-time"
        />
        <el-button :loading="loading" plain size="small" @click="onRefreshFrame">
          重新抽帧
        </el-button>
      </div>
      <ImageCropCanvas
        v-model="draft"
        :src="dataUrl"
        :natural-width="naturalWidth"
        :natural-height="naturalHeight"
        :aspect-ratio="aspectRatio"
      />
      <div class="crop-dialog-nums">
        <span>X {{ draft.x }}</span>
        <span>Y {{ draft.y }}</span>
        <span>宽 {{ draft.w }}</span>
        <span>高 {{ draft.h }}</span>
      </div>
    </template>
    <div v-else class="crop-dialog-status muted">无预览</div>

    <template #footer>
      <div class="dlg-foot">
        <span class="dlg-foot-hint">取消不写入参数</span>
        <el-button @click="onCancel">取消</el-button>
        <el-button
          :disabled="loading || !!error || !(draft.w > 0 && draft.h > 0)"
          type="primary"
          @click="onConfirm"
        >
          确认裁切
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.dlg-head-text {
  min-width: 0;
  padding-right: 28px;
}

.dlg-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--app-fg);
  line-height: 1.3;
}

.dlg-sub {
  margin-top: 2px;
  font-size: 12px;
  color: var(--app-fg-muted);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.crop-dialog-status {
  padding: 48px 16px;
  text-align: center;
  color: var(--app-fg-secondary);
  font-size: var(--fs-sm, 13px);
}

.crop-dialog-status.muted,
.muted {
  color: var(--app-fg-muted);
}

.crop-dialog-alert {
  margin-bottom: 8px;
}

.crop-dialog-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  margin-bottom: 10px;
}

.crop-dialog-toolbar .label {
  font-size: 12px;
  color: var(--app-fg-muted);
}

.toolbar-hint {
  font-size: 12px;
  color: var(--app-fg-muted);
}

.crop-dialog-nums {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 16px;
  margin-top: 10px;
  font-size: 12px;
  color: var(--app-fg-muted);
  font-variant-numeric: tabular-nums;
  font-family: var(--font-mono, ui-monospace, monospace);
}

.dlg-foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  width: 100%;
}

.dlg-foot-hint {
  margin-right: auto;
  font-size: 12px;
  color: var(--app-fg-muted);
}

.w-time {
  width: 120px;
}
</style>
