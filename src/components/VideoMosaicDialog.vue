<script lang="ts" setup>
import {computed, ref, watch} from 'vue'
import {ElMessage} from 'element-plus'
import type {MosaicRegion} from '@shared/types'
import {type CropRect, defaultMosaicRect, roundCropRect} from '@shared/cropUiLogic'
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
  <el-dialog
    v-model="visible"
    align-center
    append-to-body
    class="video-mosaic-dialog"
    destroy-on-close
    width="min(920px, 96vw)"
  >
    <template #header>
      <div class="dlg-head-text">
        <div class="dlg-title">编辑打码区域</div>
        <div class="dlg-sub">
          在画面框选区域 · 已添加 {{ rules.length }}
          <template v-if="naturalWidth && naturalHeight">
            · {{ naturalWidth }} × {{ naturalHeight }}
          </template>
        </div>
      </div>
    </template>

    <div class="mosaic-layout">
      <div class="mosaic-preview-col">
        <div class="toolbar">
          <span class="label">预览时间(秒)</span>
          <el-input-number
            v-model="timeSec"
            :max="86400"
            :min="0"
            :precision="2"
            :step="0.5"
            controls-position="right"
            size="small"
          />
          <el-button :loading="loading" plain size="small" @click="loadFrame">
            重新抽帧
          </el-button>
        </div>

        <el-alert
          v-if="frameError && !dataUrl"
          :closable="false"
          :title="frameError"
          class="frame-alert"
          show-icon
          type="error"
        />

        <div v-if="loading && !dataUrl" class="status">加载预览中…</div>
        <template v-else-if="dataUrl">
          <div :class="{ 'is-loading': loading }" class="preview-wrap">
            <ImageCropCanvas
              v-model="draft"
              :disabled="loading"
              :natural-height="naturalHeight"
              :natural-width="naturalWidth"
              :src="dataUrl"
              default-mode="mosaic"
            />
            <div v-if="loading" class="preview-loading">正在抽帧…</div>
          </div>
          <el-alert
            v-if="frameError"
            :closable="true"
            :title="frameError"
            class="frame-alert"
            show-icon
            type="error"
            @close="frameError = ''"
          />
          <div class="toolbar rule-form">
            <span class="label">开始</span>
            <el-input-number
              v-model="draftStart"
              :max="86400"
              :min="0"
              :precision="2"
              :step="0.5"
              controls-position="right"
              size="small"
            />
            <span class="label">结束</span>
            <el-tooltip :show-after="400" content="0 = 到视频结尾（全程打码）" placement="top">
              <el-input-number
                v-model="draftEnd"
                :max="86400"
                :min="0"
                :precision="2"
                :step="0.5"
                controls-position="right"
                size="small"
              />
            </el-tooltip>
            <span class="muted">0=到结尾</span>
            <el-select v-model="draftMode" class="mode-select" size="small">
              <el-option label="像素化" value="pixelate" />
              <el-option label="模糊" value="blur" />
            </el-select>
            <el-input-number
              v-model="draftStrength"
              :max="128"
              :min="2"
              :step="1"
              controls-position="right"
              size="small"
            />
            <el-button :disabled="loading" plain size="small" type="primary" @click="addRule">
              添加区域
            </el-button>
          </div>
        </template>
      </div>

      <aside class="mosaic-side">
        <div class="side-h">
          <span>区域列表 · {{ rules.length }}</span>
        </div>
        <div v-if="rules.length" class="region-list">
          <div v-for="(rule, index) in rules" :key="rule.id" class="region-card">
            <div class="region-main">
              <div class="region-name">
                区域 {{ index + 1 }} · {{ rule.mode === 'blur' ? '模糊' : '像素化' }}
              </div>
              <div class="region-meta">
                {{ rule.w }} × {{ rule.h }} @ {{ rule.x }},{{ rule.y }}
                · {{ rule.startSec }}s–{{ rule.endSec || '结尾' }}
              </div>
            </div>
            <el-button size="small" text type="danger" @click="removeRule(index)">
              删除
            </el-button>
          </div>
        </div>
        <div v-else class="region-empty">框选后点「添加区域」写入列表</div>
      </aside>
    </div>

    <template #footer>
      <div class="dlg-foot">
        <span class="dlg-foot-hint">未点添加的当前框选也会一并保存</span>
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" @click="confirm">保存区域</el-button>
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
}

.mosaic-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 240px;
  gap: 12px;
  min-height: 0;
}

.mosaic-preview-col {
  min-width: 0;
}

.toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
  font-size: 12px;
  color: var(--app-fg-secondary);
}

.toolbar .label {
  color: var(--app-fg-muted);
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
  color: var(--app-fg-muted);
}

.muted {
  color: var(--app-fg-muted);
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
  font-size: 12px;
  color: var(--accent-fg, #fff);
  background: color-mix(in oklch, var(--fg) 28%, transparent);
  border-radius: var(--radius, 8px);
}

.mosaic-side {
  border: 1px solid var(--panel-border);
  border-radius: var(--radius);
  background: var(--surface-2, var(--notes-bg));
  display: flex;
  flex-direction: column;
  min-height: 280px;
  max-height: min(520px, 60vh);
  overflow: hidden;
}

.side-h {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid var(--panel-border);
  font-weight: 600;
  font-size: 13px;
  color: var(--app-fg);
}

.region-list {
  overflow: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.region-card {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 10px;
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-sm);
  background: var(--surface, var(--panel-bg));
}

.region-main {
  flex: 1;
  min-width: 0;
}

.region-name {
  font-weight: 600;
  font-size: 13px;
  color: var(--app-fg);
}

.region-meta {
  margin-top: 2px;
  color: var(--app-fg-muted);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  font-family: var(--font-mono, ui-monospace, monospace);
}

.region-empty {
  padding: 24px 12px;
  text-align: center;
  font-size: 12px;
  color: var(--app-fg-muted);
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

@media (max-width: 720px) {
  .mosaic-layout {
    grid-template-columns: 1fr;
  }

  .mosaic-side {
    max-height: 200px;
  }
}
</style>
