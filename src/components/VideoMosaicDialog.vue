<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { MosaicRegion } from '@shared/types'
import { defaultMosaicRect, roundCropRect, type CropRect } from '@shared/cropUiLogic'
import ImageCropCanvas from './ImageCropCanvas.vue'

const props = defineProps<{
  modelValue: boolean
  videoPath: string
  regions: MosaicRegion[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: [regions: MosaicRegion[]]
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value)
})
const loading = ref(false)
/** 仅抽帧失败；勿与规则校验共用，否则会整块替换预览 */
const frameError = ref('')
const dataUrl = ref('')
const naturalWidth = ref(0)
const naturalHeight = ref(0)
const timeSec = ref(0)
const draft = ref<CropRect>({ x: 0, y: 0, w: 0, h: 0 })
const draftStart = ref(0)
const draftEnd = ref(0)
const draftMode = ref<MosaicRegion['mode']>('pixelate')
const draftStrength = ref(16)
const rules = ref<MosaicRegion[]>([])

function cloneRegions(regions: MosaicRegion[]): MosaicRegion[] {
  return regions.map((region) => ({ ...region }))
}

async function loadFrame(): Promise<void> {
  if (!props.videoPath) return
  loading.value = true
  frameError.value = ''
  try {
    const result = await window.electronAPI.extractVideoFrame({
      path: props.videoPath,
      timeSec: Math.max(0, timeSec.value),
      maxEdge: 1600
    })
    if (!result.ok || !result.dataUrl || !result.width || !result.height) {
      frameError.value = result.error || '抽帧失败'
      return
    }
    dataUrl.value = result.dataUrl
    naturalWidth.value = result.width
    naturalHeight.value = result.height
    // 抽帧成功后补齐默认居中框（打开时 reset 时尚无分辨率）
    if (!(draft.value.w > 0 && draft.value.h > 0)) {
      draft.value = defaultMosaicRect(result.width, result.height)
    }
  } catch (cause) {
    frameError.value = cause instanceof Error ? cause.message : String(cause)
  } finally {
    loading.value = false
  }
}

function resetDraft(): void {
  // 有分辨率时直接落到居中 50% 框，避免清成 0 后坐标丢失、无法添加
  draft.value =
    naturalWidth.value > 0 && naturalHeight.value > 0
      ? defaultMosaicRect(naturalWidth.value, naturalHeight.value)
      : { x: 0, y: 0, w: 0, h: 0 }
  draftStart.value = Math.max(0, timeSec.value)
  draftEnd.value = 0
  draftMode.value = 'pixelate'
  draftStrength.value = 16
}

function buildRegionFromDraft(): MosaicRegion | null {
  if (!(draft.value.w > 1 && draft.value.h > 1)) return null
  if (draftEnd.value > 0 && draftEnd.value <= draftStart.value) return null
  const rect = roundCropRect(
    draft.value,
    naturalWidth.value || 1,
    naturalHeight.value || 1
  )
  return {
    id: `mosaic-${Date.now()}-${rules.value.length + 1}`,
    startSec: Math.round(Math.max(0, draftStart.value) * 1000) / 1000,
    endSec: draftEnd.value > 0 ? Math.round(draftEnd.value * 1000) / 1000 : undefined,
    x: rect.x,
    y: rect.y,
    w: rect.w,
    h: rect.h,
    mode: draftMode.value,
    strength: Math.max(2, Math.min(128, Math.round(draftStrength.value)))
  }
}

function addRule(): void {
  if (!(draft.value.w > 1 && draft.value.h > 1)) {
    ElMessage.warning('请先在画面中框选打码区域')
    return
  }
  if (draftEnd.value > 0 && draftEnd.value <= draftStart.value) {
    ElMessage.warning('结束时间必须大于开始时间')
    return
  }
  const region = buildRegionFromDraft()
  if (!region) return
  rules.value.push(region)
  resetDraft()
}

function removeRule(index: number): void {
  rules.value.splice(index, 1)
}

function confirm(): void {
  // 当前默认/框选未点「添加」时一并写入，避免只看见框却保存不到像素坐标
  const pending = buildRegionFromDraft()
  const next = cloneRegions(rules.value)
  if (pending) next.push(pending)
  if (next.length < 1) {
    ElMessage.warning('请先框选并添加至少一个打码区域')
    return
  }
  emit('confirm', next)
  visible.value = false
}

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    rules.value = cloneRegions(props.regions || [])
    timeSec.value = 0
    frameError.value = ''
    resetDraft()
    void loadFrame()
  }
)
</script>

<template>
  <el-dialog v-model="visible" title="视频打码" width="760px" destroy-on-close append-to-body>
    <div class="toolbar">
      <span>预览时间(秒)</span>
      <el-input-number
        v-model="timeSec"
        :min="0"
        :max="86400"
        :step="0.5"
        :precision="2"
        size="small"
        controls-position="right"
      />
      <el-button size="small" :loading="loading" @click="loadFrame">重新抽帧</el-button>
      <span v-if="naturalWidth && naturalHeight" class="muted">
        原视频 {{ naturalWidth }} x {{ naturalHeight }}
      </span>
    </div>

    <el-alert
      v-if="frameError && !dataUrl"
      :title="frameError"
      type="error"
      :closable="false"
      show-icon
      class="frame-alert"
    />

    <!-- 抽帧中保留已有预览，避免提示/加载态把画面整块顶掉 -->
    <div v-if="loading && !dataUrl" class="status">加载预览中...</div>
    <template v-else-if="dataUrl">
      <div class="preview-wrap" :class="{ 'is-loading': loading }">
        <ImageCropCanvas
          v-model="draft"
          :src="dataUrl"
          :natural-width="naturalWidth"
          :natural-height="naturalHeight"
          :disabled="loading"
          default-mode="mosaic"
        />
        <div v-if="loading" class="preview-loading">正在抽帧...</div>
      </div>
      <el-alert
        v-if="frameError"
        :title="frameError"
        type="error"
        :closable="true"
        show-icon
        class="frame-alert"
        @close="frameError = ''"
      />
      <div class="toolbar rule-form">
        <span>开始</span>
        <el-input-number
          v-model="draftStart"
          :min="0"
          :max="86400"
          :step="0.5"
          :precision="2"
          size="small"
          controls-position="right"
        />
        <span>结束</span>
        <el-tooltip content="0 = 到视频结尾（全程打码）" placement="top" :show-after="400">
          <el-input-number
            v-model="draftEnd"
            :min="0"
            :max="86400"
            :step="0.5"
            :precision="2"
            size="small"
            controls-position="right"
          />
        </el-tooltip>
        <span class="muted">0=到结尾</span>
        <el-select v-model="draftMode" size="small" class="mode-select">
          <el-option label="像素化" value="pixelate" />
          <el-option label="模糊" value="blur" />
        </el-select>
        <el-input-number
          v-model="draftStrength"
          :min="2"
          :max="128"
          :step="1"
          size="small"
          controls-position="right"
        />
        <el-button type="primary" size="small" :disabled="loading" @click="addRule">
          添加区域
        </el-button>
      </div>
    </template>

    <div v-if="rules.length" class="rules">
      <div v-for="(rule, index) in rules" :key="rule.id" class="rule-row">
        <span>
          {{ index + 1 }}. {{ rule.mode === 'blur' ? '模糊' : '像素化' }}
          {{ rule.w }} x {{ rule.h }} @ {{ rule.x }},{{ rule.y }}
        </span>
        <span>{{ rule.startSec }}s - {{ rule.endSec || '结束' }}</span>
        <el-button text type="danger" size="small" @click="removeRule(index)">删除</el-button>
      </div>
    </div>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" @click="confirm">保存打码规则</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
  font-size: var(--fs-sm, 12px);
  color: var(--app-fg-secondary, #666);
}
.rule-form {
  margin-top: 10px;
}
.mode-select {
  width: 92px;
}
.status {
  padding: 48px;
  text-align: center;
  color: var(--app-fg-muted, #888);
}
.muted {
  color: var(--app-fg-muted, #888);
}
.frame-alert {
  margin-bottom: 10px;
}
.preview-wrap {
  position: relative;
}
.preview-wrap.is-loading {
  opacity: 0.72;
}
.preview-loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  font-size: var(--fs-sm, 12px);
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.55);
  background: rgba(0, 0, 0, 0.18);
  border-radius: var(--radius-xs, 4px);
}
.rules {
  margin-top: 12px;
  border-top: 1px solid var(--panel-border);
}
.rule-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 7px 0;
  font-size: var(--fs-sm, 12px);
  font-variant-numeric: tabular-nums;
}
.rule-row span:first-child {
  flex: 1;
  min-width: 0;
}
</style>
