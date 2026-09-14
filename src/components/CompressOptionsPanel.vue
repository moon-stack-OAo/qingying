<script lang="ts" setup>
import {computed, ref, watch} from 'vue'
import {ElMessage} from 'element-plus'
import {Folder} from '@element-plus/icons-vue'
import {
  ASPECT_RATIO_OPTIONS,
  type AspectRatioId,
  AUDIO_BITRATE_OPTIONS,
  AUDIO_FORMAT_OPTIONS,
  type AudioFormat,
  COMPAT_PROFILE_OPTIONS,
  type CompatProfile,
  CONCURRENCY_HINT,
  CONCURRENCY_OPTIONS,
  DEFAULT_PRESETS,
  ENCODE_PRESET_OPTIONS,
  type EncodePreset,
  ENCODER_OPTIONS,
  type EncoderDetectResult,
  type EncoderId,
  FPS_OPTIONS,
  type FpsMode,
  GIF_DITHER_OPTIONS,
  GIF_FPS_PRESETS,
  GIF_OUTPUT_KIND_OPTIONS,
  type GifDither,
  type GifOutputKind,
  IMAGE_EXTENSIONS,
  IMAGE_FORMAT_OPTIONS,
  IMAGE_LAYOUT_OPTIONS,
  NAME_TEMPLATE_OPTIONS,
  OUTPUT_DIR_MODE_OPTIONS,
  OUTPUT_FORMAT_OPTIONS,
  type OutputDirMode,
  type OutputFormat,
  type PresetId,
  type Rotate90,
  ROTATE90_OPTIONS,
  SCALE_MODE_OPTIONS,
  SCALE_PAD_OPTIONS,
  type ScaleMode,
  type ScalePadMode,
  TASK_MODE_OPTIONS,
  type TaskMode,
  VIDEO_EXTENSIONS,
  WATERMARK_MODE_OPTIONS,
  WATERMARK_POSITION_OPTIONS,
  type WatermarkMode,
  type WatermarkPosition
} from '@shared/types'
import type {CropRect} from '@shared/cropUiLogic'
import ImageCropDialog from './ImageCropDialog.vue'

const props = withDefaults(
  defineProps<{
    taskMode: TaskMode
    audioFormat: AudioFormat
    audioBitrate: string
    presetId: PresetId
    encoder: EncoderId
    concurrency: number
    nameTemplate: string
    nameTemplateCustom: boolean
    outputDir: string
    outputDirMode: OutputDirMode
    targetSizeMb: number
    /** 目标体积时两遍编码 */
    twoPass: boolean
    isCustom: boolean
    isWebm: boolean
    isAudioMode: boolean
    isImageMode: boolean
    isVideoConcatMode: boolean
    isMediaComposeMode: boolean
    isVideoMosaicMode: boolean
    isVideoToGifMode: boolean
    isImagesToGifMode: boolean
    isGifEncodeMode: boolean
    isVideoCompressMode: boolean
    presetDescription: string
    encoderInfo: EncoderDetectResult | null
    /** 裁剪开始秒，0 表示不裁剪 */
    trimStart: number
    /** 裁剪结束秒，0 表示到结尾 */
    trimEnd: number
    /** 画面旋转 90° */
    rotate90: Rotate90
    /** 去掉音轨 */
    muteAudio: boolean
    /** H.264 兼容档 */
    compatProfile: CompatProfile
    /** 视频模式音轨码率 */
    videoAudioBitrate: string
    /** 输出帧率 */
    fps: FpsMode
    /** x264 编码速度 */
    encodePreset: EncodePreset
    watermarkMode: WatermarkMode
    watermarkImagePath: string
    watermarkText: string
    watermarkPosition: WatermarkPosition
    watermarkOpacity: number
    watermarkScalePercent: number
    watermarkFontSize: number
    watermarkMargin: number
    imageFormat: 'jpeg' | 'png' | 'webp' | 'keep'
    imageQuality: number
    imageMaxEdge: number
    imageStrip: boolean
    imageLayout: 'horizontal' | 'vertical' | 'grid'
    imageGridCols: number
    imageGap: number
    imageBackground: string
    cropX: number
    cropY: number
    cropW: number
    cropH: number
    concatPreferCopy: boolean
    /** 视频打码：逐帧流水线 */
    mosaicFrameByFrame: boolean
    /** 视频转 GIF / 动图 WebP */
    gifOutputKind: GifOutputKind
    gifFps: number
    gifMaxEdge: number
    gifLoop: number
    gifColors: number
    gifDither: GifDither
    gifWebpQuality: number
    composeIntroPath: string
    composeIntroDuration: number
    composeOutroPath: string
    composeOutroDuration: number
    composeOverlayPath: string
    composeOverlayPosition: WatermarkPosition
    composeOverlayOpacity: number
    composeOverlayScalePercent: number
    composeOverlayMargin: number
    composeOverlayStartSec: number
    composeOverlayEndSec: number
    composeFitIntroOutro: boolean
    /** 可视化裁切预览路径（任务 inputPath，可空） */
    cropPreviewPath?: string
    /** 多任务全局草稿下裁切/混剪危险提示 */
    showCropComposeWarning?: boolean
    cropComposeWarningText?: string
    /** 是否有待处理任务（主 CTA 禁用） */
    hasPending?: boolean
    /** 是否有进行中任务（可选） */
    hasActive?: boolean
    /** 分辨率缩放模式（custom） */
    scaleMode: ScaleMode
    outWidth: number
    outHeight: number
    aspectRatio: AspectRatioId
    scalePad: ScalePadMode
    custom: {
      crf: number
      maxEdge: number
      format: OutputFormat
    }
  }>(),
  {
    cropPreviewPath: '',
    mosaicFrameByFrame: false,
    isVideoToGifMode: false,
    isImagesToGifMode: false,
    isGifEncodeMode: false,
    gifOutputKind: 'gif',
    gifFps: 12,
    gifMaxEdge: 480,
    gifLoop: 0,
    gifColors: 256,
    gifDither: 'bayer',
    gifWebpQuality: 75,
    showCropComposeWarning: false,
    cropComposeWarningText: '',
    hasPending: false,
    hasActive: false
  }
)

const emit = defineEmits<{
  startAll: []
  audioFormatChange: [v: AudioFormat]
  audioBitrateChange: [v: string]
  presetChange: [id: PresetId]
  encoderChange: [v: EncoderId]
  concurrencyChange: [n: number]
  nameTemplateChange: [v: string]
  customNameTemplateInput: [v: string]
  outputDirModeChange: [v: OutputDirMode]
  selectOutput: []
  targetSizeMbChange: [v: number]
  twoPassChange: [v: boolean]
  trimStartChange: [v: number]
  trimEndChange: [v: number]
  rotate90Change: [v: Rotate90]
  muteAudioChange: [v: boolean]
  compatProfileChange: [v: CompatProfile]
  videoAudioBitrateChange: [v: string]
  fpsChange: [v: FpsMode]
  encodePresetChange: [v: EncodePreset]
  watermarkModeChange: [v: WatermarkMode]
  watermarkImagePathChange: [v: string]
  watermarkTextChange: [v: string]
  watermarkPositionChange: [v: WatermarkPosition]
  watermarkOpacityChange: [v: number]
  watermarkScalePercentChange: [v: number]
  watermarkFontSizeChange: [v: number]
  watermarkMarginChange: [v: number]
  selectWatermarkImage: []
  imageFormatChange: [v: 'jpeg' | 'png' | 'webp' | 'keep']
  imageQualityChange: [v: number]
  imageMaxEdgeChange: [v: number]
  imageStripChange: [v: boolean]
  imageLayoutChange: [v: 'horizontal' | 'vertical' | 'grid']
  imageGridColsChange: [v: number]
  imageGapChange: [v: number]
  imageBackgroundChange: [v: string]
  cropXChange: [v: number]
  cropYChange: [v: number]
  cropWChange: [v: number]
  cropHChange: [v: number]
  concatPreferCopyChange: [v: boolean]
  mosaicFrameByFrameChange: [v: boolean]
  gifOutputKindChange: [v: GifOutputKind]
  gifFpsChange: [v: number]
  gifMaxEdgeChange: [v: number]
  gifLoopChange: [v: number]
  gifColorsChange: [v: number]
  gifDitherChange: [v: GifDither]
  gifWebpQualityChange: [v: number]
  composeIntroPathChange: [v: string]
  composeIntroDurationChange: [v: number]
  composeOutroPathChange: [v: string]
  composeOutroDurationChange: [v: number]
  composeOverlayPathChange: [v: string]
  composeOverlayPositionChange: [v: WatermarkPosition]
  composeOverlayOpacityChange: [v: number]
  composeOverlayScalePercentChange: [v: number]
  composeOverlayMarginChange: [v: number]
  composeOverlayStartSecChange: [v: number]
  composeOverlayEndSecChange: [v: number]
  composeFitIntroOutroChange: [v: boolean]
  selectComposeIntroImage: []
  selectComposeOutroImage: []
  selectComposeOverlayImage: []
  scaleModeChange: [v: ScaleMode]
  outWidthChange: [v: number]
  outHeightChange: [v: number]
  aspectRatioChange: [v: AspectRatioId]
  scalePadChange: [v: ScalePadMode]
  applyToPending: []
}>()

/** 高级参数抽屉 */
const advancedOpen = ref(false)
/** 视频画面裁切折叠（抽屉内） */
const videoCropOpen = ref(false)

watch(
  () => props.taskMode,
  () => {
    advancedOpen.value = false
    videoCropOpen.value = false
  }
)

/** 质量滑块本地值：拖动即时跟手，松手再 emit 持久化 */
const imageQualityDraft = ref(props.imageQuality)
watch(
  () => props.imageQuality,
  (v) => {
    imageQualityDraft.value = v
  }
)

const isImageCompressMode = computed(() => props.taskMode === 'image')
const isImageCropMode = computed(() => props.taskMode === 'image-crop')
const isImageStitchMode = computed(() => props.taskMode === 'image-stitch')

/** 是否展示高级折叠区（打码/GIF 参数区简化，无高级折叠） */
const showAdvancedSection = computed(
  () => !props.isVideoMosaicMode && !props.isGifEncodeMode
)

const advancedSummary = computed(() => {
  if (props.isAudioMode) return '命名 · 并发 · 其它'
  if (isImageCompressMode.value) return '输出目录 · 命名 · 并发'
  if (isImageCropMode.value) return '输出格式 · 目录 · 命名'
  if (isImageStitchMode.value) return '输出格式 · 最长边 · 目录 · 命名'
  if (props.isVideoConcatMode) return '回退编码器 · 命名 · 并发'
  if (props.isMediaComposeMode) return '叠加层 · 位置 · 透明度 · 编码器'
  if (props.isVideoCompressMode) return 'CRF · 水印 · 时段 · 画面'
  return '高级参数'
})

const nameTemplatePlaceholder = computed(() => {
  if (props.isAudioMode) return '{name}_audio'
  if (props.isImageMode) return '{name}_img'
  if (props.isVideoConcatMode) return '{name}_concat'
  if (props.isMediaComposeMode) return '{name}_compose'
  if (props.isVideoMosaicMode) return '{name}_mosaic'
  if (props.isGifEncodeMode) {
    if (props.taskMode === 'gif-optimize') return '{name}_opt'
    return props.gifOutputKind === 'webp' ? '{name}_webp' : '{name}_gif'
  }
  return '{name}_{preset}'
})

const gifLoopLabel = computed(() => {
  const n = props.gifLoop
  if (n === 0) return '无限循环'
  if (n === -1) return '不循环'
  return `额外循环 ${n} 次`
})

function onImageQualityCommit(v: number | number[]): void {
  const n = Array.isArray(v) ? v[0] : v
  const next =
    typeof n === 'number' && Number.isFinite(n)
      ? Math.max(1, Math.min(100, Math.round(n)))
      : imageQualityDraft.value
  imageQualityDraft.value = next
  emit('imageQualityChange', next)
}

const modeTitle = computed(() => {
  const hit = TASK_MODE_OPTIONS.find((o) => o.value === props.taskMode)
  return hit?.label || '任务选项'
})

const startAllDisabled = computed(() => !props.hasPending)

/** 编码器探测简短 chips */
const encoderChips = computed(() => {
  const info = props.encoderInfo
  if (!info) return [] as Array<{ key: string; ok: boolean; label: string }>
  return [
    { key: 'nvenc', ok: !!info.nvenc, label: 'NVENC' },
    { key: 'qsv', ok: !!info.qsv, label: 'QSV' },
    { key: 'amf', ok: !!info.amf, label: 'AMF' },
    {
      key: 'vt',
      ok: !!info.videotoolbox,
      label: 'VT'
    }
  ]
})

const hasComposeAssets = computed(() => {
  const intro = (props.composeIntroPath || '').trim()
  const outro = (props.composeOutroPath || '').trim()
  const overlay = (props.composeOverlayPath || '').trim()
  return !!(intro || outro || overlay)
})

const composeAssetsSummary = computed(() => {
  const parts: string[] = []
  if ((props.composeIntroPath || '').trim()) parts.push('片头')
  if ((props.composeOutroPath || '').trim()) parts.push('片尾')
  if ((props.composeOverlayPath || '').trim()) parts.push('叠加层')
  return parts.length ? `已配置：${parts.join(' · ')}` : ''
})

const cropDialogOpen = ref(false)
const cropDialogPath = ref('')
const cropDialogHint = ref('')
const cropDialogTitle = ref('图片裁切')
/** 视频抽帧预加载（与 path 二选一） */
const cropDialogInitialDataUrl = ref('')
const cropDialogNaturalW = ref(0)
const cropDialogNaturalH = ref(0)
const cropDialogVideoPath = ref('')
const cropDialogTimeSec = ref(0)

const IMAGE_EXT_SET = new Set(
  (IMAGE_EXTENSIONS as string[]).map((e) => e.toLowerCase())
)
const VIDEO_EXT_SET = new Set(
  (VIDEO_EXTENSIONS as string[]).map((e) => e.toLowerCase())
)

function extOf(p: string): string {
  const i = p.lastIndexOf('.')
  return i >= 0 ? p.slice(i).toLowerCase() : ''
}

function isImagePath(p: string): boolean {
  return IMAGE_EXT_SET.has(extOf(p))
}

function isVideoPath(p: string): boolean {
  return VIDEO_EXT_SET.has(extOf(p))
}

const cropModel = computed(
  (): CropRect => ({
    x: props.cropX,
    y: props.cropY,
    w: props.cropW,
    h: props.cropH
  })
)

function resetCropDialogPreload(): void {
  cropDialogInitialDataUrl.value = ''
  cropDialogNaturalW.value = 0
  cropDialogNaturalH.value = 0
  cropDialogVideoPath.value = ''
  cropDialogTimeSec.value = 0
}

async function openVisualCrop(): Promise<void> {
  let path = (props.cropPreviewPath || '').trim()
  let hint = ''
  let title = '图片裁切'
  resetCropDialogPreload()

  if (path && isVideoPath(path)) {
    // 优先从视频抽帧预览
    try {
      if (!window.electronAPI?.extractVideoFrame) {
        throw new Error('抽帧接口不可用')
      }
      ElMessage.info('正在从视频抽取预览帧…')
      const res = await window.electronAPI.extractVideoFrame({
        path,
        timeSec: 0,
        maxEdge: 1600
      })
      if (res.ok && res.dataUrl && res.width && res.height) {
        cropDialogPath.value = path
        cropDialogInitialDataUrl.value = res.dataUrl
        cropDialogNaturalW.value = res.width
        cropDialogNaturalH.value = res.height
        cropDialogVideoPath.value = path
        cropDialogTimeSec.value = 0
        cropDialogHint.value =
          '视频帧预览 · 坐标基于源分辨率；可改时间点重新抽帧'
        cropDialogTitle.value = '图片裁切'
        cropDialogOpen.value = true
        return
      }
      ElMessage.warning(res.error || '视频抽帧失败，请选择参考截图')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      ElMessage.warning(msg || '视频抽帧失败，请选择参考截图')
    }
    const picked = await window.electronAPI.selectImage()
    if (!picked?.path) return
    path = picked.path
    hint = '参考图定框 · 请与视频分辨率一致'
    title = '图片裁切'
  } else if (!path || !isImagePath(path)) {
    const picked = await window.electronAPI.selectImage()
    if (!picked?.path) {
      ElMessage.warning('请先添加任务图片或选择一张预览图')
      return
    }
    path = picked.path
    if (props.taskMode === 'compress') {
      hint = '参考图定框 · 请与视频分辨率一致'
      title = '图片裁切'
    }
  }

  cropDialogPath.value = path
  cropDialogHint.value = hint
  cropDialogTitle.value = title
  cropDialogOpen.value = true
}

function onCropDialogConfirm(rect: CropRect): void {
  emit('cropXChange', rect.x)
  emit('cropYChange', rect.y)
  emit('cropWChange', rect.w)
  emit('cropHChange', rect.h)
}

function modeDesc(): string {
  if (props.isAudioMode) return '格式与码率外露；命名等进高级'
  if (props.taskMode === 'image') return '格式 / 质量 / 最长边外露；目录与命名折叠'
  if (props.taskMode === 'image-crop') return '像素框外露；精细拖拽用裁切画布'
  if (props.taskMode === 'image-stitch') return '布局参数外露；顺序在任务表调整'
  if (props.taskMode === 'video-concat') return 'Copy 优先与输出目录外露；顺序在任务表调整'
  if (props.taskMode === 'media-compose') return '片头 / 片尾外露；叠加层与编码器折叠'
  if (props.taskMode === 'video-mosaic')
    return '单任务工作台：选文件后在下方打码台框选区域'
  if (props.taskMode === 'video-to-gif')
    return '输出 GIF；建议短片段，可用时段裁剪控制时长'
  if (props.taskMode === 'images-to-gif')
    return '多选静图按顺序成帧；顺序在任务表调整；默认约 10fps（100ms）'
  if (props.taskMode === 'gif-optimize')
    return '重编码已有 GIF/动图 WebP；默认最长边 480、约 10fps 轻量优化'
  return props.presetDescription || '常用参数置顶；高级编码器与水印折叠'
}

/** 下拉展示值：自定义时用哨兵 */
function nameSelectValue(nameTemplate: string, isCustom: boolean): string {
  if (isCustom) return '__custom__'
  const known = NAME_TEMPLATE_OPTIONS.find(
    (o) => o.id !== 'custom' && o.value === nameTemplate
  )
  return known ? known.value : '__custom__'
}

function encoderTitle(isWebm: boolean, info: EncoderDetectResult | null): string {
  if (isWebm) return 'WebM 强制软件 VP9'
  const base = '优先使用 GPU 编码降低 CPU；失败自动回退软编'
  if (!info) return base
  const found: string[] = []
  if (info.nvenc) found.push('NVENC')
  if (info.qsv) found.push('QSV')
  if (info.amf) found.push('AMF')
  if (info.videotoolbox) found.push('VT')
  if (info.codecs?.h264_mf) found.push('MF')
  if (info.codecs?.hevc_nvenc) found.push('HEVC')
  const hw = found.length ? `硬件: ${found.join(' ')}` : '硬件: 未检测到'
  return `${base}。${hw}`
}

/** 某 EncoderId 是否可用（无探测信息时默认可用） */
function isEncoderOptionAvailable(id: EncoderId): boolean {
  if (id === 'auto' || id === 'software' || id === 'libx264') return true
  const info = props.encoderInfo
  if (!info) return true
  if (info.availability?.length) {
    const row = info.availability.find((a) => a.id === id)
    if (row) return row.available
  }
  if (info.codecs) {
    const map: Partial<Record<EncoderId, keyof typeof info.codecs>> = {
      h264_nvenc: 'h264_nvenc',
      h264_qsv: 'h264_qsv',
      h264_amf: 'h264_amf',
      h264_videotoolbox: 'h264_videotoolbox',
      h264_mf: 'h264_mf',
      hevc_nvenc: 'hevc_nvenc',
      hevc_qsv: 'hevc_qsv',
      hevc_amf: 'hevc_amf',
      hevc_videotoolbox: 'hevc_videotoolbox',
      hevc_mf: 'hevc_mf',
      libx265: 'libx265',
      nvenc: 'h264_nvenc',
      qsv: 'h264_qsv',
      amf: 'h264_amf',
      videotoolbox: 'h264_videotoolbox'
    }
    const codec = map[id]
    if (codec && codec in info.codecs) return !!info.codecs[codec]
  }
  // 旧字段回退
  if (id === 'nvenc' || id === 'h264_nvenc') return info.nvenc
  if (id === 'qsv' || id === 'h264_qsv') return info.qsv
  if (id === 'amf' || id === 'h264_amf') return info.amf
  if (id === 'videotoolbox' || id === 'h264_videotoolbox') return !!info.videotoolbox
  return true
}

function encoderOptionLabel(opt: { value: EncoderId; label: string }): string {
  if (isEncoderOptionAvailable(opt.value)) return opt.label
  return `${opt.label}（不可用）`
}

</script>

<template>
  <div class="panel options-panel">
    <el-scrollbar class="options-scroll" max-height="min(42vh, calc(100vh - 280px))">
    <div class="options-header">
      <div class="options-header-left">
        <div class="options-title-block">
          <span class="options-title">{{ modeTitle }}</span>
          <span class="options-desc">{{ modeDesc() }}</span>
        </div>
      </div>
      <div class="options-header-actions">
        <el-button
          v-if="!isVideoMosaicMode"
          plain
          size="small"
          @click="emit('applyToPending')"
        >
          应用到待处理
        </el-button>
        <el-button
          v-if="!isVideoMosaicMode"
          :disabled="startAllDisabled"
          size="small"
          type="primary"
          @click="emit('startAll')"
        >
          全部开始
        </el-button>
      </div>
    </div>

    <el-alert
      v-if="showCropComposeWarning"
      class="crop-compose-alert"
      type="warning"
      :closable="false"
      show-icon
      :title="cropComposeWarningText || '当前裁切/混剪参数将应用于全部待处理任务'"
    />

    <!-- 常用参数（按模式外露 3–5 项） -->
    <div class="opt-common">
      <!-- compress -->
      <template v-if="isVideoCompressMode">
        <div class="opt-row opt-row-wrap">
          <div class="opt-item">
            <span class="label">预设</span>
            <el-radio-group
              :model-value="presetId"
              size="small"
              @change="(v: string | number | boolean | undefined) => emit('presetChange', v as PresetId)"
            >
              <el-radio-button v-for="p in DEFAULT_PRESETS" :key="p.id" :value="p.id">
                {{ p.name }}
              </el-radio-button>
            </el-radio-group>
          </div>
          <div class="opt-item">
            <span class="label">目标体积</span>
            <el-input-number
              :max="10240"
              :min="0"
              :model-value="targetSizeMb"
              :precision="1"
              :step="1"
              class="w-lg"
              controls-position="right"
              size="small"
              @change="(v: number | undefined) => emit('targetSizeMbChange', typeof v === 'number' ? v : 0)"
            />
            <span class="hint-inline hint-inline--tight">MB，0=不限制</span>
          </div>
          <el-tooltip
            v-if="targetSizeMb > 0"
            :show-after="400"
            content="仅软件 x264/VP9；硬件自动单遍"
            placement="top"
          >
            <div class="opt-item">
              <span class="label">两遍编码</span>
              <el-switch
                :model-value="twoPass"
                size="small"
                @change="(v: string | number | boolean) => emit('twoPassChange', Boolean(v))"
              />
              <span class="hint-inline hint-inline--tight">更准更慢</span>
            </div>
          </el-tooltip>
          <el-tooltip :content="encoderTitle(isWebm, encoderInfo)" :show-after="400" placement="top">
            <div class="opt-item">
              <span class="label">编码器</span>
              <el-select
                :disabled="isWebm"
                :model-value="encoder"
                class="w-4xl"
                size="small"
                @change="(v: EncoderId) => emit('encoderChange', v)"
              >
                <el-option
                  v-for="opt in ENCODER_OPTIONS"
                  :key="opt.value"
                  :disabled="!isEncoderOptionAvailable(opt.value)"
                  :label="encoderOptionLabel(opt)"
                  :value="opt.value"
                />
              </el-select>
              <span v-if="encoderChips.length" class="encoder-chips">
                <span
                  v-for="c in encoderChips"
                  :key="c.key"
                  :class="{ ok: c.ok, bad: !c.ok }"
                  class="encoder-chip"
                >
                  {{ c.label }}{{ c.ok ? '✓' : '–' }}
                </span>
              </span>
            </div>
          </el-tooltip>
        </div>
        <div class="opt-row opt-row-output">
          <div class="opt-item opt-output">
            <span class="label">输出目录</span>
            <el-select
              :model-value="outputDirMode"
              class="w-2xl"
              size="small"
              @change="(v: OutputDirMode) => emit('outputDirModeChange', v)"
            >
              <el-option
                v-for="opt in OUTPUT_DIR_MODE_OPTIONS"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
            <template v-if="outputDirMode !== 'sidecar'">
              <el-button :icon="Folder" size="small" @click="emit('selectOutput')">
                选择目录
              </el-button>
              <el-tooltip :content="outputDir || '未选择输出目录'" :show-after="400" placement="top">
                <span class="path-text output-path">
                  {{ outputDir || '未选择输出目录' }}
                </span>
              </el-tooltip>
            </template>
            <span v-else class="hint-inline">与源文件同目录</span>
          </div>
        </div>
      </template>

      <!-- audio -->
      <template v-else-if="isAudioMode">
        <div class="opt-row opt-row-wrap">
          <div class="opt-item">
            <span class="label">输出格式</span>
            <el-select
              :model-value="audioFormat"
              class="w-3xl"
              size="small"
              @change="(v: AudioFormat) => emit('audioFormatChange', v)"
            >
              <el-option
                v-for="opt in AUDIO_FORMAT_OPTIONS"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </div>
          <div class="opt-item">
            <span class="label">码率</span>
            <el-select
              :model-value="audioBitrate"
              class="w-md"
              size="small"
              @change="(v: string) => emit('audioBitrateChange', v)"
            >
              <el-option
                v-for="br in AUDIO_BITRATE_OPTIONS"
                :key="br"
                :label="br"
                :value="br"
              />
            </el-select>
          </div>
          <el-tooltip :show-after="400" content="0 = 不裁剪 / 到结尾" placement="top">
            <div class="opt-item">
              <span class="label">抽取时段</span>
              <span class="hint-inline hint-inline--tight">开始(秒)</span>
              <el-input-number
                :max="86400"
                :min="0"
                :model-value="trimStart"
                :precision="1"
                :step="1"
                class="w-lg"
                controls-position="right"
                size="small"
                @change="(v: number | undefined) => emit('trimStartChange', typeof v === 'number' ? v : 0)"
              />
              <span class="hint-inline hint-inline--tight">结束(秒)</span>
              <el-input-number
                :max="86400"
                :min="0"
                :model-value="trimEnd"
                :precision="1"
                :step="1"
                class="w-lg"
                controls-position="right"
                size="small"
                @change="(v: number | undefined) => emit('trimEndChange', typeof v === 'number' ? v : 0)"
              />
            </div>
          </el-tooltip>
        </div>
        <div class="opt-row opt-row-output">
          <div class="opt-item opt-output">
            <span class="label">输出目录</span>
            <el-select
              :model-value="outputDirMode"
              class="w-2xl"
              size="small"
              @change="(v: OutputDirMode) => emit('outputDirModeChange', v)"
            >
              <el-option
                v-for="opt in OUTPUT_DIR_MODE_OPTIONS"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
            <template v-if="outputDirMode !== 'sidecar'">
              <el-button :icon="Folder" size="small" @click="emit('selectOutput')">
                选择目录
              </el-button>
              <el-tooltip :content="outputDir || '未选择输出目录'" :show-after="400" placement="top">
                <span class="path-text output-path">
                  {{ outputDir || '未选择输出目录' }}
                </span>
              </el-tooltip>
            </template>
            <span v-else class="hint-inline">与源文件同目录</span>
          </div>
        </div>
      </template>

      <!-- image compress -->
      <template v-else-if="isImageCompressMode">
        <div class="opt-row opt-row-wrap">
          <div class="opt-item">
            <span class="label">输出格式</span>
            <el-select
              :model-value="imageFormat"
              class="w-3xl"
              size="small"
              @change="(v: 'jpeg' | 'png' | 'webp' | 'keep') => emit('imageFormatChange', v)"
            >
              <el-option
                v-for="opt in IMAGE_FORMAT_OPTIONS"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </div>
          <div class="opt-item">
            <el-tooltip :show-after="400" content="JPEG / WebP 有效" placement="top">
              <span class="label">质量</span>
            </el-tooltip>
            <el-slider
              v-model="imageQualityDraft"
              :max="100"
              :min="1"
              :step="1"
              class="w-quality"
              size="small"
              @change="onImageQualityCommit"
            />
            <span class="hint-inline hint-inline--tight">{{ imageQualityDraft }}</span>
          </div>
          <el-tooltip :show-after="400" content="0 = 不限制" placement="top">
            <div class="opt-item">
              <span class="label">最长边</span>
              <el-input-number
                :max="7680"
                :min="0"
                :model-value="imageMaxEdge"
                :step="10"
                class="w-lg"
                controls-position="right"
                size="small"
                @change="(v: number | undefined) => emit('imageMaxEdgeChange', typeof v === 'number' ? v : 0)"
              />
            </div>
          </el-tooltip>
          <el-tooltip :show-after="400" content="去掉 EXIF 等元数据" placement="top">
            <div class="opt-item">
              <span class="label">去元数据</span>
              <el-switch
                :model-value="imageStrip"
                size="small"
                @change="(v: string | number | boolean) => emit('imageStripChange', Boolean(v))"
              />
            </div>
          </el-tooltip>
        </div>
      </template>

      <!-- image-crop -->
      <template v-else-if="isImageCropMode">
        <div class="opt-row opt-row-wrap">
          <el-tooltip :show-after="400" content="原图像素坐标，宽高须 > 0" placement="top">
            <div class="opt-item">
              <span class="label">X</span>
              <el-input-number
                :max="20000"
                :min="0"
                :model-value="cropX"
                :step="1"
                class="w-lg"
                controls-position="right"
                size="small"
                @change="(v: number | undefined) => emit('cropXChange', typeof v === 'number' ? v : 0)"
              />
            </div>
          </el-tooltip>
          <div class="opt-item">
            <span class="label">Y</span>
            <el-input-number
              :max="20000"
              :min="0"
              :model-value="cropY"
              :step="1"
              class="w-lg"
              controls-position="right"
              size="small"
              @change="(v: number | undefined) => emit('cropYChange', typeof v === 'number' ? v : 0)"
            />
          </div>
          <div class="opt-item">
            <span class="label">宽</span>
            <el-input-number
              :max="20000"
              :min="0"
              :model-value="cropW"
              :step="1"
              class="w-lg"
              controls-position="right"
              size="small"
              @change="(v: number | undefined) => emit('cropWChange', typeof v === 'number' ? v : 0)"
            />
          </div>
          <div class="opt-item">
            <span class="label">高</span>
            <el-input-number
              :max="20000"
              :min="0"
              :model-value="cropH"
              :step="1"
              class="w-lg"
              controls-position="right"
              size="small"
              @change="(v: number | undefined) => emit('cropHChange', typeof v === 'number' ? v : 0)"
            />
          </div>
          <div class="opt-item opt-entry">
            <el-button plain size="small" type="primary" @click="openVisualCrop">
              打开裁切画布
            </el-button>
          </div>
        </div>
      </template>

      <!-- image-stitch -->
      <template v-else-if="isImageStitchMode">
        <div class="opt-row opt-row-wrap">
          <span class="hint-inline opt-hint-block">
            调整顺序：在任务表行内点「编辑拼接顺序」；下方为新建任务默认布局
          </span>
          <div class="opt-item">
            <span class="label">布局</span>
            <el-select
              :model-value="imageLayout"
              class="w-2xl"
              size="small"
              @change="(v: 'horizontal' | 'vertical' | 'grid') => emit('imageLayoutChange', v)"
            >
              <el-option
                v-for="opt in IMAGE_LAYOUT_OPTIONS"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </div>
          <div v-if="imageLayout === 'grid'" class="opt-item">
            <span class="label">列数</span>
            <el-input-number
              :max="20"
              :min="1"
              :model-value="imageGridCols"
              :step="1"
              class="w-lg"
              controls-position="right"
              size="small"
              @change="(v: number | undefined) => emit('imageGridColsChange', typeof v === 'number' ? v : 2)"
            />
          </div>
          <div class="opt-item">
            <span class="label">间距</span>
            <el-input-number
              :max="500"
              :min="0"
              :model-value="imageGap"
              :step="1"
              class="w-lg"
              controls-position="right"
              size="small"
              @change="(v: number | undefined) => emit('imageGapChange', typeof v === 'number' ? v : 0)"
            />
            <span class="hint-inline hint-inline--tight">px</span>
          </div>
          <div class="opt-item">
            <span class="label">背景</span>
            <el-input
              :model-value="imageBackground"
              class="w-3xl"
              placeholder="#000000"
              size="small"
              @update:model-value="(v: string) => emit('imageBackgroundChange', v)"
            />
          </div>
        </div>
      </template>

      <!-- video-concat -->
      <template v-else-if="isVideoConcatMode">
        <div class="opt-row opt-row-wrap">
          <span class="hint-inline opt-hint-block">
            调整顺序：在任务表行内点「编辑拼接顺序」，弹窗内可拖拽
          </span>
          <el-tooltip :show-after="400" content="编码参数一致时可流复制，更快；失败则按高级区回退编码器重编码" placement="top">
            <div class="opt-item">
              <span class="label">优先流复制</span>
              <el-switch
                :model-value="concatPreferCopy"
                size="small"
                @change="(v: string | number | boolean) => emit('concatPreferCopyChange', Boolean(v))"
              />
              <span class="hint-inline hint-inline--tight">更快，要求编码一致</span>
            </div>
          </el-tooltip>
          <span class="hint-inline">无独立「输出容器 / 对齐」字段；现有逻辑随源自动处理</span>
        </div>
        <div class="opt-row opt-row-output">
          <div class="opt-item opt-output">
            <span class="label">输出目录</span>
            <el-select
              :model-value="outputDirMode"
              class="w-2xl"
              size="small"
              @change="(v: OutputDirMode) => emit('outputDirModeChange', v)"
            >
              <el-option
                v-for="opt in OUTPUT_DIR_MODE_OPTIONS"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
            <template v-if="outputDirMode !== 'sidecar'">
              <el-button :icon="Folder" size="small" @click="emit('selectOutput')">
                选择目录
              </el-button>
              <el-tooltip :content="outputDir || '未选择输出目录'" :show-after="400" placement="top">
                <span class="path-text output-path">
                  {{ outputDir || '未选择输出目录' }}
                </span>
              </el-tooltip>
            </template>
            <span v-else class="hint-inline">与源文件同目录</span>
          </div>
        </div>
      </template>

      <!-- media-compose -->
      <template v-else-if="isMediaComposeMode">
        <el-alert
          v-if="!hasComposeAssets"
          :closable="false"
          class="compose-empty-alert"
          show-icon
          title="先选片头 / 片尾 / 叠加图，再添加主视频"
          type="info"
        />
        <p v-else class="compose-summary">
          {{ composeAssetsSummary }} · 无独立时间线预览，启动后按参数合成
        </p>
        <div class="opt-row opt-row-wrap">
          <div class="opt-item opt-item-fill">
            <span class="label">片头图</span>
            <el-input
              :model-value="composeIntroPath"
              class="w-5xl"
              placeholder="可选：片头静图路径"
              size="small"
              @update:model-value="(v: string) => emit('composeIntroPathChange', v)"
            />
            <el-button size="small" @click="emit('selectComposeIntroImage')">浏览</el-button>
          </div>
          <div class="opt-item">
            <span class="label">片头时长</span>
            <el-input-number
              :max="3600"
              :min="0.1"
              :model-value="composeIntroDuration"
              :precision="1"
              :step="0.5"
              class="w-lg"
              controls-position="right"
              size="small"
              @change="(v: number | undefined) => emit('composeIntroDurationChange', typeof v === 'number' ? v : 3)"
            />
            <span class="hint-inline hint-inline--tight">秒</span>
          </div>
        </div>
        <div class="opt-row opt-row-wrap">
          <div class="opt-item opt-item-fill">
            <span class="label">片尾图</span>
            <el-input
              :model-value="composeOutroPath"
              class="w-5xl"
              placeholder="可选：片尾静图路径"
              size="small"
              @update:model-value="(v: string) => emit('composeOutroPathChange', v)"
            />
            <el-button size="small" @click="emit('selectComposeOutroImage')">浏览</el-button>
          </div>
          <div class="opt-item">
            <span class="label">片尾时长</span>
            <el-input-number
              :max="3600"
              :min="0.1"
              :model-value="composeOutroDuration"
              :precision="1"
              :step="0.5"
              class="w-lg"
              controls-position="right"
              size="small"
              @change="(v: number | undefined) => emit('composeOutroDurationChange', typeof v === 'number' ? v : 3)"
            />
            <span class="hint-inline hint-inline--tight">秒</span>
          </div>
        </div>
        <div class="opt-row opt-row-wrap">
          <el-tooltip :show-after="400" content="片头尾静图缩放到主视频尺寸并黑边填充" placement="top">
            <div class="opt-item">
              <span class="label">匹配主视频尺寸</span>
              <el-switch
                :model-value="composeFitIntroOutro"
                size="small"
                @change="(v: string | number | boolean) => emit('composeFitIntroOutroChange', Boolean(v))"
              />
              <span class="hint-inline">主视频从任务列表添加</span>
            </div>
          </el-tooltip>
        </div>
      </template>

      <!-- video-mosaic -->
      <template v-else-if="isVideoMosaicMode">
        <div class="opt-row opt-row-wrap">
          <span class="hint-inline opt-hint-block">
            打码为单任务工作台：拖入单个视频，编辑区域后开始打码。「全部开始」不适用。
          </span>
          <el-tooltip
            :show-after="400"
            content="关闭：FFmpeg 滤镜一次编码（推荐）。开启：抽出全部帧为 JPEG，用 Sharp 打码后再封装——更慢、临时盘占用大，适合对照或特殊需求。"
            placement="top"
          >
            <div class="opt-item">
              <span class="label">逐帧流水线</span>
              <el-switch
                :model-value="mosaicFrameByFrame"
                size="small"
                @change="(v: string | number | boolean) => emit('mosaicFrameByFrameChange', Boolean(v))"
              />
              <span class="hint-inline hint-inline--tight">
                {{ mosaicFrameByFrame ? '抽帧→打码→封装' : '滤镜一次编码' }}
              </span>
            </div>
          </el-tooltip>
          <span class="hint-inline">接近原画导出（CRF 18 · 原分辨率 · MP4 · 软件编码）</span>
        </div>
        <div class="opt-row opt-row-output">
          <div class="opt-item opt-output">
            <span class="label">输出目录</span>
            <el-select
              :model-value="outputDirMode"
              class="w-2xl"
              size="small"
              @change="(v: OutputDirMode) => emit('outputDirModeChange', v)"
            >
              <el-option
                v-for="opt in OUTPUT_DIR_MODE_OPTIONS"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
            <template v-if="outputDirMode !== 'sidecar'">
              <el-button :icon="Folder" size="small" @click="emit('selectOutput')">
                选择目录
              </el-button>
              <el-tooltip :content="outputDir || '未选择输出目录'" :show-after="400" placement="top">
                <span class="path-text output-path">
                  {{ outputDir || '未选择输出目录' }}
                </span>
              </el-tooltip>
            </template>
            <span v-else class="hint-inline">与源文件同目录</span>
          </div>
          <div aria-hidden="true" class="opt-divider" />
          <div class="opt-item opt-item-fill">
            <span class="label">输出命名</span>
            <el-select
              :model-value="nameSelectValue(nameTemplate, nameTemplateCustom)"
              class="w-4xl"
              size="small"
              @change="(v: string) => emit('nameTemplateChange', v)"
            >
              <el-option
                v-for="opt in NAME_TEMPLATE_OPTIONS"
                :key="opt.id"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
            <el-input
              v-if="nameTemplateCustom || nameSelectValue(nameTemplate, nameTemplateCustom) === '__custom__'"
              :model-value="nameTemplate === '__custom__' ? '' : nameTemplate"
              :placeholder="nameTemplatePlaceholder"
              class="w-4xl name-template-input"
              size="small"
              @update:model-value="(v: string) => emit('customNameTemplateInput', v)"
            />
          </div>
        </div>
      </template>

      <!-- video-to-gif / images-to-gif / gif-optimize / 动图 WebP -->
      <template v-else-if="isGifEncodeMode">
        <div class="opt-row opt-row-wrap">
          <span class="hint-inline opt-hint-block">
            <template v-if="taskMode === 'gif-optimize'">
              <template v-if="gifOutputKind === 'webp'">
                对已有 GIF / 动图 WebP 重编码为动图 WebP（降分辨率 / 帧率）。不依赖 gifsicle。
              </template>
              <template v-else>
                对已有 GIF / 动图 WebP 重编码为 GIF（调色板 + 可选降色）。默认轻量：最长边 480、约 10fps。
              </template>
            </template>
            <template v-else-if="isImagesToGifMode">
              <template v-if="gifOutputKind === 'webp'">
                多张静图按任务顺序合成动图 WebP。至少 2 张；帧率决定每帧停留时间。
              </template>
              <template v-else>
                多张静图按任务顺序合成 GIF。至少 2 张；顺序在任务表可调整。
              </template>
            </template>
            <template v-else-if="gifOutputKind === 'webp'">
              输出动图 WebP（体积通常更小，部分旧环境兼容性略差）。建议用「时段」截取短片段。
            </template>
            <template v-else>
              输出 GIF（调色板两遍编码）。长视频体积会很大，建议用「时段」截取短片段。
            </template>
          </span>
        </div>
        <div class="opt-row opt-row-wrap">
          <div class="opt-item">
            <span class="label">输出格式</span>
            <el-select
              :model-value="gifOutputKind"
              class="w-2xl"
              size="small"
              @change="(v: GifOutputKind) => emit('gifOutputKindChange', v)"
            >
              <el-option
                v-for="opt in GIF_OUTPUT_KIND_OPTIONS"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </div>
          <div class="opt-item">
            <span class="label">帧率</span>
            <el-select
              :model-value="gifFps"
              class="w-md"
              size="small"
              @change="(v: number) => emit('gifFpsChange', v)"
            >
              <el-option
                v-for="n in GIF_FPS_PRESETS"
                :key="n"
                :label="`${n} fps`"
                :value="n"
              />
            </el-select>
          </div>
          <el-tooltip :show-after="400" content="0 = 不限制（文件更大）" placement="top">
            <div class="opt-item">
              <span class="label">最长边</span>
              <el-input-number
                :max="4096"
                :min="0"
                :model-value="gifMaxEdge"
                :step="80"
                class="w-lg"
                controls-position="right"
                size="small"
                @change="(v: number | undefined) => emit('gifMaxEdgeChange', typeof v === 'number' ? v : 480)"
              />
            </div>
          </el-tooltip>
          <el-tooltip
            :show-after="400"
            content="0=无限循环；-1=播一次不循环；正数为额外循环次数"
            placement="top"
          >
            <div class="opt-item">
              <span class="label">循环</span>
              <el-input-number
                :max="100"
                :min="-1"
                :model-value="gifLoop"
                :step="1"
                class="w-lg"
                controls-position="right"
                size="small"
                @change="(v: number | undefined) => emit('gifLoopChange', typeof v === 'number' ? v : 0)"
              />
              <span class="hint-inline hint-inline--tight">{{ gifLoopLabel }}</span>
            </div>
          </el-tooltip>
        </div>
        <div class="opt-row opt-row-wrap">
          <el-tooltip
            v-if="isVideoToGifMode"
            :show-after="400"
            content="0 = 不裁剪 / 到结尾"
            placement="top"
          >
            <div class="opt-item">
              <span class="label">时段</span>
              <span class="hint-inline hint-inline--tight">开始(秒)</span>
              <el-input-number
                :max="86400"
                :min="0"
                :model-value="trimStart"
                :precision="1"
                :step="1"
                class="w-lg"
                controls-position="right"
                size="small"
                @change="(v: number | undefined) => emit('trimStartChange', typeof v === 'number' ? v : 0)"
              />
              <span class="hint-inline hint-inline--tight">结束(秒)</span>
              <el-input-number
                :max="86400"
                :min="0"
                :model-value="trimEnd"
                :precision="1"
                :step="1"
                class="w-lg"
                controls-position="right"
                size="small"
                @change="(v: number | undefined) => emit('trimEndChange', typeof v === 'number' ? v : 0)"
              />
            </div>
          </el-tooltip>
          <template v-if="gifOutputKind === 'gif'">
            <div class="opt-item">
              <span class="label">颜色数</span>
              <el-input-number
                :max="256"
                :min="2"
                :model-value="gifColors"
                :step="16"
                class="w-lg"
                controls-position="right"
                size="small"
                @change="(v: number | undefined) => emit('gifColorsChange', typeof v === 'number' ? v : 256)"
              />
            </div>
            <div class="opt-item">
              <span class="label">抖动</span>
              <el-select
                :model-value="gifDither"
                class="w-3xl"
                size="small"
                @change="(v: GifDither) => emit('gifDitherChange', v)"
              >
                <el-option
                  v-for="opt in GIF_DITHER_OPTIONS"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </div>
          </template>
          <el-tooltip
            v-else
            :show-after="400"
            content="libwebp 质量，数值越高体积越大"
            placement="top"
          >
            <div class="opt-item">
              <span class="label">质量</span>
              <el-input-number
                :max="100"
                :min="0"
                :model-value="gifWebpQuality"
                :step="5"
                class="w-lg"
                controls-position="right"
                size="small"
                @change="(v: number | undefined) => emit('gifWebpQualityChange', typeof v === 'number' ? v : 75)"
              />
            </div>
          </el-tooltip>
        </div>
        <div class="opt-row opt-row-output">
          <div class="opt-item opt-output">
            <span class="label">输出目录</span>
            <el-select
              :model-value="outputDirMode"
              class="w-2xl"
              size="small"
              @change="(v: OutputDirMode) => emit('outputDirModeChange', v)"
            >
              <el-option
                v-for="opt in OUTPUT_DIR_MODE_OPTIONS"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
            <template v-if="outputDirMode !== 'sidecar'">
              <el-button :icon="Folder" size="small" @click="emit('selectOutput')">
                选择目录
              </el-button>
              <el-tooltip :content="outputDir || '未选择输出目录'" :show-after="400" placement="top">
                <span class="path-text output-path">
                  {{ outputDir || '未选择输出目录' }}
                </span>
              </el-tooltip>
            </template>
            <span v-else class="hint-inline">与源文件同目录</span>
          </div>
          <div aria-hidden="true" class="opt-divider" />
          <div class="opt-item opt-item-fill">
            <span class="label">输出命名</span>
            <el-select
              :model-value="nameSelectValue(nameTemplate, nameTemplateCustom)"
              class="w-4xl"
              size="small"
              @change="(v: string) => emit('nameTemplateChange', v)"
            >
              <el-option
                v-for="opt in NAME_TEMPLATE_OPTIONS"
                :key="opt.id"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
            <el-input
              v-if="nameTemplateCustom || nameSelectValue(nameTemplate, nameTemplateCustom) === '__custom__'"
              :model-value="nameTemplate === '__custom__' ? '' : nameTemplate"
              :placeholder="nameTemplatePlaceholder"
              class="w-4xl name-template-input"
              size="small"
              @update:model-value="(v: string) => emit('customNameTemplateInput', v)"
            />
          </div>
        </div>
      </template>
    </div>

    <!-- 高级参数：右侧抽屉，避免挤占任务表 -->
    <div v-if="showAdvancedSection" class="opt-advanced">
      <button
        :aria-expanded="advancedOpen"
        aria-controls="opt-advanced-drawer"
        class="opt-advanced-toggle"
        type="button"
        @click="advancedOpen = true"
      >
        <span>高级参数</span>
        <span class="muted">{{ advancedSummary }}</span>
      </button>
    </div>
    </el-scrollbar>

    <el-drawer
      v-if="showAdvancedSection"
      id="opt-advanced-drawer"
      v-model="advancedOpen"
      append-to-body
      class="opt-advanced-drawer"
      size="min(440px, 96%)"
    >
      <template #header>
        <div class="adv-drawer-head">
          <div class="adv-drawer-title">高级参数</div>
          <div class="adv-drawer-sub">{{ modeTitle }} · {{ advancedSummary }}</div>
        </div>
      </template>
      <div class="opt-advanced-body">
        <!-- audio 高级：命名 · 并发 -->
        <template v-if="isAudioMode">
          <div class="opt-row opt-row-wrap">
            <div class="opt-item opt-item-fill">
              <span class="label">输出命名</span>
              <el-select
                :model-value="nameSelectValue(nameTemplate, nameTemplateCustom)"
                class="w-4xl"
                size="small"
                @change="(v: string) => emit('nameTemplateChange', v)"
              >
                <el-option
                  v-for="opt in NAME_TEMPLATE_OPTIONS"
                  :key="opt.id"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
              <el-input
                v-if="nameTemplateCustom || nameSelectValue(nameTemplate, nameTemplateCustom) === '__custom__'"
                :model-value="nameTemplate === '__custom__' ? '' : nameTemplate"
                :placeholder="nameTemplatePlaceholder"
                class="w-4xl name-template-input"
                size="small"
                @update:model-value="(v: string) => emit('customNameTemplateInput', v)"
              />
            </div>
            <el-tooltip :content="CONCURRENCY_HINT" :show-after="400" placement="top">
              <div class="opt-item">
                <span class="label">并发数</span>
                <el-select
                  :model-value="concurrency"
                  class="w-xs"
                  size="small"
                  @change="(v: number) => emit('concurrencyChange', v)"
                >
                  <el-option
                    v-for="n in CONCURRENCY_OPTIONS"
                    :key="n"
                    :label="String(n)"
                    :value="n"
                  />
                </el-select>
              </div>
            </el-tooltip>
          </div>
        </template>

        <!-- image 压缩高级：输出目录 · 命名 · 并发 -->
        <template v-else-if="isImageCompressMode">
          <div class="opt-row opt-row-output">
            <div class="opt-item opt-output">
              <span class="label">输出目录</span>
              <el-select
                :model-value="outputDirMode"
                class="w-2xl"
                size="small"
                @change="(v: OutputDirMode) => emit('outputDirModeChange', v)"
              >
                <el-option
                  v-for="opt in OUTPUT_DIR_MODE_OPTIONS"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
              <template v-if="outputDirMode !== 'sidecar'">
                <el-button :icon="Folder" size="small" @click="emit('selectOutput')">
                  选择目录
                </el-button>
                <el-tooltip :content="outputDir || '未选择输出目录'" :show-after="400" placement="top">
                  <span class="path-text output-path">
                    {{ outputDir || '未选择输出目录' }}
                  </span>
                </el-tooltip>
              </template>
              <span v-else class="hint-inline">与源文件同目录</span>
            </div>
            <div aria-hidden="true" class="opt-divider" />
            <div class="opt-item opt-item-fill">
              <span class="label">输出命名</span>
              <el-select
                :model-value="nameSelectValue(nameTemplate, nameTemplateCustom)"
                class="w-4xl"
                size="small"
                @change="(v: string) => emit('nameTemplateChange', v)"
              >
                <el-option
                  v-for="opt in NAME_TEMPLATE_OPTIONS"
                  :key="opt.id"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
              <el-input
                v-if="nameTemplateCustom || nameSelectValue(nameTemplate, nameTemplateCustom) === '__custom__'"
                :model-value="nameTemplate === '__custom__' ? '' : nameTemplate"
                :placeholder="nameTemplatePlaceholder"
                class="w-4xl name-template-input"
                size="small"
                @update:model-value="(v: string) => emit('customNameTemplateInput', v)"
              />
            </div>
          </div>
          <div class="opt-row">
            <el-tooltip :content="CONCURRENCY_HINT" :show-after="400" placement="top">
              <div class="opt-item">
                <span class="label">并发数</span>
                <el-select
                  :model-value="concurrency"
                  class="w-xs"
                  size="small"
                  @change="(v: number) => emit('concurrencyChange', v)"
                >
                  <el-option
                    v-for="n in CONCURRENCY_OPTIONS"
                    :key="n"
                    :label="String(n)"
                    :value="n"
                  />
                </el-select>
              </div>
            </el-tooltip>
          </div>
        </template>

        <!-- image-crop 高级：格式 · 目录 · 命名 · 并发 -->
        <template v-else-if="isImageCropMode">
          <div class="opt-row opt-row-wrap">
            <div class="opt-item">
              <span class="label">输出格式</span>
              <el-select
                :model-value="imageFormat"
                class="w-3xl"
                size="small"
                @change="(v: 'jpeg' | 'png' | 'webp' | 'keep') => emit('imageFormatChange', v)"
              >
                <el-option
                  v-for="opt in IMAGE_FORMAT_OPTIONS"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </div>
            <div class="opt-item opt-entry">
              <el-button plain size="small" type="primary" @click="openVisualCrop">
                打开裁切画布
              </el-button>
            </div>
          </div>
          <div class="opt-row opt-row-output">
            <div class="opt-item opt-output">
              <span class="label">输出目录</span>
              <el-select
                :model-value="outputDirMode"
                class="w-2xl"
                size="small"
                @change="(v: OutputDirMode) => emit('outputDirModeChange', v)"
              >
                <el-option
                  v-for="opt in OUTPUT_DIR_MODE_OPTIONS"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
              <template v-if="outputDirMode !== 'sidecar'">
                <el-button :icon="Folder" size="small" @click="emit('selectOutput')">
                  选择目录
                </el-button>
                <el-tooltip :content="outputDir || '未选择输出目录'" :show-after="400" placement="top">
                  <span class="path-text output-path">
                    {{ outputDir || '未选择输出目录' }}
                  </span>
                </el-tooltip>
              </template>
              <span v-else class="hint-inline">与源文件同目录</span>
            </div>
            <div aria-hidden="true" class="opt-divider" />
            <div class="opt-item opt-item-fill">
              <span class="label">输出命名</span>
              <el-select
                :model-value="nameSelectValue(nameTemplate, nameTemplateCustom)"
                class="w-4xl"
                size="small"
                @change="(v: string) => emit('nameTemplateChange', v)"
              >
                <el-option
                  v-for="opt in NAME_TEMPLATE_OPTIONS"
                  :key="opt.id"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
              <el-input
                v-if="nameTemplateCustom || nameSelectValue(nameTemplate, nameTemplateCustom) === '__custom__'"
                :model-value="nameTemplate === '__custom__' ? '' : nameTemplate"
                :placeholder="nameTemplatePlaceholder"
                class="w-4xl name-template-input"
                size="small"
                @update:model-value="(v: string) => emit('customNameTemplateInput', v)"
              />
            </div>
          </div>
          <div class="opt-row">
            <el-tooltip :content="CONCURRENCY_HINT" :show-after="400" placement="top">
              <div class="opt-item">
                <span class="label">并发数</span>
                <el-select
                  :model-value="concurrency"
                  class="w-xs"
                  size="small"
                  @change="(v: number) => emit('concurrencyChange', v)"
                >
                  <el-option
                    v-for="n in CONCURRENCY_OPTIONS"
                    :key="n"
                    :label="String(n)"
                    :value="n"
                  />
                </el-select>
              </div>
            </el-tooltip>
          </div>
        </template>

        <!-- image-stitch 高级：格式 · 最长边 · 目录 · 命名 · 并发 -->
        <template v-else-if="isImageStitchMode">
          <div class="opt-row opt-row-wrap">
            <div class="opt-item">
              <span class="label">输出格式</span>
              <el-select
                :model-value="imageFormat"
                class="w-3xl"
                size="small"
                @change="(v: 'jpeg' | 'png' | 'webp' | 'keep') => emit('imageFormatChange', v)"
              >
                <el-option
                  v-for="opt in IMAGE_FORMAT_OPTIONS"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </div>
            <el-tooltip :show-after="400" content="0 = 不限制" placement="top">
              <div class="opt-item">
                <span class="label">最长边</span>
                <el-input-number
                  :max="7680"
                  :min="0"
                  :model-value="imageMaxEdge"
                  :step="10"
                  class="w-lg"
                  controls-position="right"
                  size="small"
                  @change="(v: number | undefined) => emit('imageMaxEdgeChange', typeof v === 'number' ? v : 0)"
                />
              </div>
            </el-tooltip>
          </div>
          <div class="opt-row opt-row-output">
            <div class="opt-item opt-output">
              <span class="label">输出目录</span>
              <el-select
                :model-value="outputDirMode"
                class="w-2xl"
                size="small"
                @change="(v: OutputDirMode) => emit('outputDirModeChange', v)"
              >
                <el-option
                  v-for="opt in OUTPUT_DIR_MODE_OPTIONS"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
              <template v-if="outputDirMode !== 'sidecar'">
                <el-button :icon="Folder" size="small" @click="emit('selectOutput')">
                  选择目录
                </el-button>
                <el-tooltip :content="outputDir || '未选择输出目录'" :show-after="400" placement="top">
                  <span class="path-text output-path">
                    {{ outputDir || '未选择输出目录' }}
                  </span>
                </el-tooltip>
              </template>
              <span v-else class="hint-inline">与源文件同目录</span>
            </div>
            <div aria-hidden="true" class="opt-divider" />
            <div class="opt-item opt-item-fill">
              <span class="label">输出命名</span>
              <el-select
                :model-value="nameSelectValue(nameTemplate, nameTemplateCustom)"
                class="w-4xl"
                size="small"
                @change="(v: string) => emit('nameTemplateChange', v)"
              >
                <el-option
                  v-for="opt in NAME_TEMPLATE_OPTIONS"
                  :key="opt.id"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
              <el-input
                v-if="nameTemplateCustom || nameSelectValue(nameTemplate, nameTemplateCustom) === '__custom__'"
                :model-value="nameTemplate === '__custom__' ? '' : nameTemplate"
                :placeholder="nameTemplatePlaceholder"
                class="w-4xl name-template-input"
                size="small"
                @update:model-value="(v: string) => emit('customNameTemplateInput', v)"
              />
            </div>
          </div>
          <div class="opt-row">
            <el-tooltip :content="CONCURRENCY_HINT" :show-after="400" placement="top">
              <div class="opt-item">
                <span class="label">并发数</span>
                <el-select
                  :model-value="concurrency"
                  class="w-xs"
                  size="small"
                  @change="(v: number) => emit('concurrencyChange', v)"
                >
                  <el-option
                    v-for="n in CONCURRENCY_OPTIONS"
                    :key="n"
                    :label="String(n)"
                    :value="n"
                  />
                </el-select>
              </div>
            </el-tooltip>
          </div>
        </template>

        <!-- video-concat 高级：回退编码器 · 命名 · 并发 -->
        <template v-else-if="isVideoConcatMode">
          <div class="opt-row opt-row-wrap">
            <el-tooltip :show-after="400" content="流复制失败时按此编码器重编码" placement="top">
              <div class="opt-item">
                <span class="label">回退编码器</span>
                <el-select
                  :model-value="encoder"
                  class="w-4xl"
                  size="small"
                  @change="(v: EncoderId) => emit('encoderChange', v)"
                >
                  <el-option
                    v-for="opt in ENCODER_OPTIONS"
                    :key="opt.value"
                    :disabled="!isEncoderOptionAvailable(opt.value)"
                    :label="encoderOptionLabel(opt)"
                    :value="opt.value"
                  />
                </el-select>
                <span v-if="encoderChips.length" class="encoder-chips">
                  <span
                    v-for="c in encoderChips"
                    :key="c.key"
                    :class="{ ok: c.ok, bad: !c.ok }"
                    class="encoder-chip"
                  >
                    {{ c.label }}{{ c.ok ? '✓' : '–' }}
                  </span>
                </span>
              </div>
            </el-tooltip>
            <div class="opt-item opt-item-fill">
              <span class="label">输出命名</span>
              <el-select
                :model-value="nameSelectValue(nameTemplate, nameTemplateCustom)"
                class="w-4xl"
                size="small"
                @change="(v: string) => emit('nameTemplateChange', v)"
              >
                <el-option
                  v-for="opt in NAME_TEMPLATE_OPTIONS"
                  :key="opt.id"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
              <el-input
                v-if="nameTemplateCustom || nameSelectValue(nameTemplate, nameTemplateCustom) === '__custom__'"
                :model-value="nameTemplate === '__custom__' ? '' : nameTemplate"
                :placeholder="nameTemplatePlaceholder"
                class="w-4xl name-template-input"
                size="small"
                @update:model-value="(v: string) => emit('customNameTemplateInput', v)"
              />
            </div>
            <el-tooltip :content="CONCURRENCY_HINT" :show-after="400" placement="top">
              <div class="opt-item">
                <span class="label">并发数</span>
                <el-select
                  :model-value="concurrency"
                  class="w-xs"
                  size="small"
                  @change="(v: number) => emit('concurrencyChange', v)"
                >
                  <el-option
                    v-for="n in CONCURRENCY_OPTIONS"
                    :key="n"
                    :label="String(n)"
                    :value="n"
                  />
                </el-select>
              </div>
            </el-tooltip>
          </div>
          <span class="hint-inline">现有字段无「过渡」选项</span>
        </template>

        <!-- media-compose 高级：叠加层 · 编码器 · 命名 · 输出 · 并发 -->
        <template v-else-if="isMediaComposeMode">
          <div class="opt-row opt-row-wrap">
            <div class="opt-item opt-item-fill">
              <span class="label">叠加图</span>
              <el-input
                :model-value="composeOverlayPath"
                class="w-5xl"
                placeholder="可选：叠到主视频上的图片"
                size="small"
                @update:model-value="(v: string) => emit('composeOverlayPathChange', v)"
              />
              <el-button size="small" @click="emit('selectComposeOverlayImage')">浏览</el-button>
            </div>
            <div class="opt-item">
              <span class="label">位置</span>
              <el-select
                :model-value="composeOverlayPosition"
                class="w-2xl"
                size="small"
                @change="(v: WatermarkPosition) => emit('composeOverlayPositionChange', v)"
              >
                <el-option
                  v-for="opt in WATERMARK_POSITION_OPTIONS"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </div>
            <el-tooltip :show-after="400" content="0–1" placement="top">
              <div class="opt-item">
                <span class="label">透明度</span>
                <el-input-number
                  :max="1"
                  :min="0"
                  :model-value="composeOverlayOpacity"
                  :precision="2"
                  :step="0.1"
                  class="w-lg"
                  controls-position="right"
                  size="small"
                  @change="(v: number | undefined) => emit('composeOverlayOpacityChange', typeof v === 'number' ? v : 0.8)"
                />
              </div>
            </el-tooltip>
            <el-tooltip :show-after="400" content="相对视频短边宽度 %" placement="top">
              <div class="opt-item">
                <span class="label">缩放%</span>
                <el-input-number
                  :max="100"
                  :min="1"
                  :model-value="composeOverlayScalePercent"
                  :step="1"
                  class="w-lg"
                  controls-position="right"
                  size="small"
                  @change="(v: number | undefined) => emit('composeOverlayScalePercentChange', typeof v === 'number' ? v : 15)"
                />
              </div>
            </el-tooltip>
            <div class="opt-item">
              <span class="label">边距</span>
              <el-input-number
                :max="500"
                :min="0"
                :model-value="composeOverlayMargin"
                :step="1"
                class="w-lg"
                controls-position="right"
                size="small"
                @change="(v: number | undefined) => emit('composeOverlayMarginChange', typeof v === 'number' ? v : 16)"
              />
            </div>
            <el-tooltip :show-after="400" content="0 表示从开头" placement="top">
              <div class="opt-item">
                <span class="label">起秒</span>
                <el-input-number
                  :max="86400"
                  :min="0"
                  :model-value="composeOverlayStartSec"
                  :precision="1"
                  :step="0.5"
                  class="w-lg"
                  controls-position="right"
                  size="small"
                  @change="(v: number | undefined) => emit('composeOverlayStartSecChange', typeof v === 'number' ? v : 0)"
                />
              </div>
            </el-tooltip>
            <el-tooltip :show-after="400" content="0 表示到结尾" placement="top">
              <div class="opt-item">
                <span class="label">止秒</span>
                <el-input-number
                  :max="86400"
                  :min="0"
                  :model-value="composeOverlayEndSec"
                  :precision="1"
                  :step="0.5"
                  class="w-lg"
                  controls-position="right"
                  size="small"
                  @change="(v: number | undefined) => emit('composeOverlayEndSecChange', typeof v === 'number' ? v : 0)"
                />
              </div>
            </el-tooltip>
          </div>
          <div class="opt-row opt-row-wrap">
            <el-tooltip :content="encoderTitle(false, encoderInfo)" :show-after="400" placement="top">
              <div class="opt-item">
                <span class="label">编码器</span>
                <el-select
                  :model-value="encoder"
                  class="w-4xl"
                  size="small"
                  @change="(v: EncoderId) => emit('encoderChange', v)"
                >
                  <el-option
                    v-for="opt in ENCODER_OPTIONS"
                    :key="opt.value"
                    :disabled="!isEncoderOptionAvailable(opt.value)"
                    :label="encoderOptionLabel(opt)"
                    :value="opt.value"
                  />
                </el-select>
                <span v-if="encoderChips.length" class="encoder-chips">
                  <span
                    v-for="c in encoderChips"
                    :key="c.key"
                    :class="{ ok: c.ok, bad: !c.ok }"
                    class="encoder-chip"
                  >
                    {{ c.label }}{{ c.ok ? '✓' : '–' }}
                  </span>
                </span>
              </div>
            </el-tooltip>
          </div>
          <div class="opt-row opt-row-output">
            <div class="opt-item opt-output">
              <span class="label">输出目录</span>
              <el-select
                :model-value="outputDirMode"
                class="w-2xl"
                size="small"
                @change="(v: OutputDirMode) => emit('outputDirModeChange', v)"
              >
                <el-option
                  v-for="opt in OUTPUT_DIR_MODE_OPTIONS"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
              <template v-if="outputDirMode !== 'sidecar'">
                <el-button :icon="Folder" size="small" @click="emit('selectOutput')">
                  选择目录
                </el-button>
                <el-tooltip :content="outputDir || '未选择输出目录'" :show-after="400" placement="top">
                  <span class="path-text output-path">
                    {{ outputDir || '未选择输出目录' }}
                  </span>
                </el-tooltip>
              </template>
              <span v-else class="hint-inline">与源文件同目录</span>
            </div>
            <div aria-hidden="true" class="opt-divider" />
            <div class="opt-item opt-item-fill">
              <span class="label">输出命名</span>
              <el-select
                :model-value="nameSelectValue(nameTemplate, nameTemplateCustom)"
                class="w-4xl"
                size="small"
                @change="(v: string) => emit('nameTemplateChange', v)"
              >
                <el-option
                  v-for="opt in NAME_TEMPLATE_OPTIONS"
                  :key="opt.id"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
              <el-input
                v-if="nameTemplateCustom || nameSelectValue(nameTemplate, nameTemplateCustom) === '__custom__'"
                :model-value="nameTemplate === '__custom__' ? '' : nameTemplate"
                :placeholder="nameTemplatePlaceholder"
                class="w-4xl name-template-input"
                size="small"
                @update:model-value="(v: string) => emit('customNameTemplateInput', v)"
              />
            </div>
          </div>
          <div class="opt-row">
            <el-tooltip :content="CONCURRENCY_HINT" placement="top" :show-after="400">
              <div class="opt-item">
                <span class="label">并发数</span>
                <el-select
                  :model-value="concurrency"
                  size="small"
                  class="w-xs"
                  @change="(v: number) => emit('concurrencyChange', v)"
                >
                  <el-option
                    v-for="n in CONCURRENCY_OPTIONS"
                    :key="n"
                    :label="String(n)"
                    :value="n"
                  />
                </el-select>
              </div>
            </el-tooltip>
          </div>
        </template>

        <!-- compress 高级：CRF · 水印 · 时段 · 画面等 -->
        <template v-else-if="isVideoCompressMode">
          <div class="opt-row">
            <el-tooltip :content="isWebm ? 'WebM 不适用' : 'Main@L4 利于旧设备/微信'" :show-after="400" placement="top">
              <div class="opt-item">
                <span class="label">兼容档</span>
                <el-select
                  :disabled="isWebm"
                  :model-value="compatProfile"
                  class="w-4xl"
                  size="small"
                  @change="(v: CompatProfile) => emit('compatProfileChange', v)"
                >
                  <el-option
                    v-for="opt in COMPAT_PROFILE_OPTIONS"
                    :key="opt.value"
                    :label="opt.label"
                    :value="opt.value"
                  />
                </el-select>
              </div>
            </el-tooltip>

            <el-tooltip :show-after="400" content="仅软件 x264/x265 生效；越慢越好" placement="top">
              <div class="opt-item">
                <span class="label">编码速度</span>
                <el-select
                  :model-value="encodePreset"
                  class="w-2xl"
                  size="small"
                  @change="(v: EncodePreset) => emit('encodePresetChange', v)"
                >
                  <el-option
                    v-for="opt in ENCODE_PRESET_OPTIONS"
                    :key="opt.value"
                    :label="opt.label"
                    :value="opt.value"
                  />
                </el-select>
              </div>
            </el-tooltip>

            <el-tooltip :content="CONCURRENCY_HINT" :show-after="400" placement="top">
              <div class="opt-item">
                <span class="label">并发数</span>
                <el-select
                  :model-value="concurrency"
                  class="w-xs"
                  size="small"
                  @change="(v: number) => emit('concurrencyChange', v)"
                >
                  <el-option
                    v-for="n in CONCURRENCY_OPTIONS"
                    :key="n"
                    :label="String(n)"
                    :value="n"
                  />
                </el-select>
              </div>
            </el-tooltip>
          </div>

          <div class="opt-row">
            <el-tooltip content="90° 竖→横；180° 上下颠倒" placement="top" :show-after="400">
              <div class="opt-item">
                <span class="label">旋转</span>
                <el-select
                  :model-value="rotate90"
                  size="small"
                  class="w-5xl"
                  @change="(v: Rotate90) => emit('rotate90Change', v)"
                >
                  <el-option
                    v-for="opt in ROTATE90_OPTIONS"
                    :key="opt.value"
                    :label="opt.label"
                    :value="opt.value"
                  />
                </el-select>
              </div>
            </el-tooltip>

            <div class="opt-item">
              <span class="label">帧率</span>
              <el-select
                :model-value="fps"
                size="small"
                class="w-2xl"
                @change="(v: FpsMode) => emit('fpsChange', v)"
              >
                <el-option
                  v-for="opt in FPS_OPTIONS"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </div>

            <template v-if="isCustom">
              <div class="opt-divider" aria-hidden="true" />

              <div class="opt-item">
                <span class="label">缩放模式</span>
                <el-select
                  :model-value="scaleMode"
                  size="small"
                  class="w-2xl"
                  @change="(v: ScaleMode) => emit('scaleModeChange', v)"
                >
                  <el-option
                    v-for="opt in SCALE_MODE_OPTIONS"
                    :key="opt.value"
                    :label="opt.label"
                    :value="opt.value"
                  />
                </el-select>
              </div>
              <div class="opt-item">
                <span class="label">CRF</span>
                <el-input-number v-model="custom.crf" :max="51" :min="0" :step="1" size="small" />
              </div>
              <div v-if="scaleMode === 'maxEdge'" class="opt-item">
                <span class="label">最长边</span>
                <el-input-number
                  v-model="custom.maxEdge"
                  :max="7680"
                  :min="0"
                  :step="2"
                  size="small"
                />
                <span class="hint-inline hint-inline--tight">0 = 不缩放</span>
              </div>
              <template v-if="scaleMode === 'fixed'">
                <div class="opt-item">
                  <span class="label">宽</span>
                  <el-input-number
                    :model-value="outWidth"
                    :min="2"
                    :max="7680"
                    :step="2"
                    size="small"
                    controls-position="right"
                    class="w-lg"
                    @change="(v: number | undefined) => emit('outWidthChange', typeof v === 'number' && v > 0 ? v : 1920)"
                  />
                </div>
                <div class="opt-item">
                  <span class="label">高</span>
                  <el-input-number
                    :model-value="outHeight"
                    :min="2"
                    :max="7680"
                    :step="2"
                    size="small"
                    controls-position="right"
                    class="w-lg"
                    @change="(v: number | undefined) => emit('outHeightChange', typeof v === 'number' && v > 0 ? v : 1080)"
                  />
                </div>
              </template>
              <template v-if="scaleMode === 'aspect'">
                <div class="opt-item">
                  <span class="label">比例</span>
                  <el-select
                    :model-value="aspectRatio"
                    size="small"
                    class="w-2xl"
                    @change="(v: AspectRatioId) => emit('aspectRatioChange', v)"
                  >
                    <el-option
                      v-for="opt in ASPECT_RATIO_OPTIONS"
                      :key="opt.value"
                      :label="opt.label"
                      :value="opt.value"
                    />
                  </el-select>
                </div>
                <div class="opt-item">
                  <span class="label">目标宽</span>
                  <el-input-number
                    :model-value="outWidth"
                    :min="0"
                    :max="7680"
                    :step="2"
                    size="small"
                    controls-position="right"
                    class="w-lg"
                    @change="(v: number | undefined) => emit('outWidthChange', typeof v === 'number' ? Math.max(0, v) : 0)"
                  />
                  <span class="hint-inline">优先；0 时用最长边</span>
                </div>
                <div class="opt-item">
                  <span class="label">最长边</span>
                  <el-input-number
                    v-model="custom.maxEdge"
                    :max="7680"
                    :min="0"
                    :step="2"
                    size="small"
                  />
                  <span class="hint-inline">宽未设时作长边</span>
                </div>
              </template>
              <div
                v-if="scaleMode === 'fixed' || scaleMode === 'aspect'"
                class="opt-item"
              >
                <span class="label">填充</span>
                <el-select
                  :model-value="scalePad"
                  size="small"
                  class="w-2xl"
                  @change="(v: ScalePadMode) => emit('scalePadChange', v)"
                >
                  <el-option
                    v-for="opt in SCALE_PAD_OPTIONS"
                    :key="opt.value"
                    :label="opt.label"
                    :value="opt.value"
                  />
                </el-select>
              </div>
              <div class="opt-item">
                <span class="label">格式</span>
                <el-select v-model="custom.format" size="small" class="w-5xl">
                  <el-option
                    v-for="opt in OUTPUT_FORMAT_OPTIONS"
                    :key="opt.value"
                    :label="opt.label"
                    :value="opt.value"
                  />
                </el-select>
              </div>
            </template>
          </div>

          <div class="opt-row opt-row-wrap">
            <div class="opt-item">
              <span class="label">水印</span>
              <el-select
                :model-value="watermarkMode"
                size="small"
                class="w-2xl"
                @change="(v: WatermarkMode) => emit('watermarkModeChange', v)"
              >
                <el-option
                  v-for="opt in WATERMARK_MODE_OPTIONS"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </div>

            <template v-if="watermarkMode === 'image'">
              <div class="opt-item opt-item-fill">
                <el-input
                  :model-value="watermarkImagePath"
                  size="small"
                  placeholder="图片路径"
                  class="w-5xl"
                  @update:model-value="(v: string) => emit('watermarkImagePathChange', v)"
                />
                <el-button size="small" @click="emit('selectWatermarkImage')">浏览</el-button>
              </div>
              <el-tooltip content="相对视频短边宽度 %" placement="top" :show-after="400">
                <div class="opt-item">
                  <span class="label">缩放%</span>
                  <el-input-number
                    :model-value="watermarkScalePercent"
                    :min="1"
                    :max="100"
                    :step="1"
                    size="small"
                    controls-position="right"
                    class="w-lg"
                    @change="(v: number | undefined) => emit('watermarkScalePercentChange', typeof v === 'number' ? v : 15)"
                  />
                </div>
              </el-tooltip>
            </template>

            <template v-if="watermarkMode === 'text'">
              <div class="opt-item opt-item-fill">
                <el-input
                  :model-value="watermarkText"
                  size="small"
                  placeholder="水印文字"
                  class="w-5xl"
                  @update:model-value="(v: string) => emit('watermarkTextChange', v)"
                />
              </div>
              <div class="opt-item">
                <span class="label">字号</span>
                <el-input-number
                  :model-value="watermarkFontSize"
                  :min="8"
                  :max="200"
                  :step="1"
                  size="small"
                  controls-position="right"
                  class="w-lg"
                  @change="(v: number | undefined) => emit('watermarkFontSizeChange', typeof v === 'number' ? v : 24)"
                />
              </div>
            </template>

            <template v-if="watermarkMode !== 'none'">
              <div class="opt-item">
                <span class="label">位置</span>
                <el-select
                  :model-value="watermarkPosition"
                  size="small"
                  class="w-2xl"
                  @change="(v: WatermarkPosition) => emit('watermarkPositionChange', v)"
                >
                  <el-option
                    v-for="opt in WATERMARK_POSITION_OPTIONS"
                    :key="opt.value"
                    :label="opt.label"
                    :value="opt.value"
                  />
                </el-select>
              </div>
              <el-tooltip content="0–1" placement="top" :show-after="400">
                <div class="opt-item">
                  <span class="label">透明度</span>
                  <el-input-number
                    :model-value="watermarkOpacity"
                    :min="0"
                    :max="1"
                    :step="0.1"
                    :precision="2"
                    size="small"
                    controls-position="right"
                    class="w-lg"
                    @change="(v: number | undefined) => emit('watermarkOpacityChange', typeof v === 'number' ? v : 0.8)"
                  />
                </div>
              </el-tooltip>
              <div class="opt-item">
                <span class="label">边距</span>
                <el-input-number
                  :model-value="watermarkMargin"
                  :min="0"
                  :max="500"
                  :step="1"
                  size="small"
                  controls-position="right"
                  class="w-lg"
                  @change="(v: number | undefined) => emit('watermarkMarginChange', typeof v === 'number' ? v : 16)"
                />
              </div>
            </template>
          </div>

          <div class="opt-row">
            <el-tooltip content="去掉音轨" placement="top" :show-after="400">
              <div class="opt-item">
                <span class="label">静音</span>
                <el-switch
                  :model-value="muteAudio"
                  size="small"
                  @change="(v: string | number | boolean) => emit('muteAudioChange', Boolean(v))"
                />
              </div>
            </el-tooltip>

            <div v-if="!muteAudio" class="opt-item">
              <span class="label">音轨码率</span>
              <el-select
                :model-value="videoAudioBitrate"
                size="small"
                class="w-md"
                @change="(v: string) => emit('videoAudioBitrateChange', v)"
              >
                <el-option
                  v-for="br in AUDIO_BITRATE_OPTIONS"
                  :key="br"
                  :label="br"
                  :value="br"
                />
              </el-select>
            </div>

            <div class="opt-divider" aria-hidden="true" />

            <el-tooltip content="0 = 不裁剪 / 到结尾" placement="top" :show-after="400">
              <div class="opt-item">
                <span class="label">时间裁剪</span>
                <span class="hint-inline hint-inline--tight">开始(秒)</span>
                <el-input-number
                  :model-value="trimStart"
                  :min="0"
                  :max="86400"
                  :step="1"
                  :precision="1"
                  size="small"
                  controls-position="right"
                  class="w-lg"
                  @change="(v: number | undefined) => emit('trimStartChange', typeof v === 'number' ? v : 0)"
                />
                <span class="hint-inline hint-inline--tight">结束(秒)</span>
                <el-input-number
                  :model-value="trimEnd"
                  :min="0"
                  :max="86400"
                  :step="1"
                  :precision="1"
                  size="small"
                  controls-position="right"
                  class="w-lg"
                  @change="(v: number | undefined) => emit('trimEndChange', typeof v === 'number' ? v : 0)"
                />
              </div>
            </el-tooltip>
          </div>

          <div class="opt-row opt-row-wrap">
            <button
              type="button"
              class="opt-advanced-toggle crop-toggle"
              :aria-expanded="videoCropOpen"
              @click="videoCropOpen = !videoCropOpen"
            >
              <span class="opt-advanced-chevron" :class="{ open: videoCropOpen }">▸</span>
              <span>画面裁切</span>
              <span class="muted">原图像素，宽高为 0 表示不裁切</span>
            </button>
          </div>
          <div v-show="videoCropOpen" class="opt-row opt-row-wrap">
            <div class="opt-item">
              <span class="hint-inline hint-inline--tight">X</span>
              <el-input-number
                :model-value="cropX"
                :min="0"
                :max="20000"
                :step="1"
                size="small"
                controls-position="right"
                class="w-lg"
                @change="(v: number | undefined) => emit('cropXChange', typeof v === 'number' ? v : 0)"
              />
              <span class="hint-inline hint-inline--tight">Y</span>
              <el-input-number
                :model-value="cropY"
                :min="0"
                :max="20000"
                :step="1"
                size="small"
                controls-position="right"
                class="w-lg"
                @change="(v: number | undefined) => emit('cropYChange', typeof v === 'number' ? v : 0)"
              />
              <span class="hint-inline hint-inline--tight">宽</span>
              <el-input-number
                :model-value="cropW"
                :min="0"
                :max="20000"
                :step="1"
                size="small"
                controls-position="right"
                class="w-lg"
                @change="(v: number | undefined) => emit('cropWChange', typeof v === 'number' ? v : 0)"
              />
              <span class="hint-inline hint-inline--tight">高</span>
              <el-input-number
                :model-value="cropH"
                :min="0"
                :max="20000"
                :step="1"
                size="small"
                controls-position="right"
                class="w-lg"
                @change="(v: number | undefined) => emit('cropHChange', typeof v === 'number' ? v : 0)"
              />
              <el-button size="small" type="primary" plain @click="openVisualCrop">
                图片裁切
              </el-button>
            </div>
          </div>

          <div class="opt-row opt-row-wrap">
            <div class="opt-item opt-item-fill">
              <span class="label">输出命名</span>
              <el-select
                :model-value="nameSelectValue(nameTemplate, nameTemplateCustom)"
                class="w-4xl"
                size="small"
                @change="(v: string) => emit('nameTemplateChange', v)"
              >
                <el-option
                  v-for="opt in NAME_TEMPLATE_OPTIONS"
                  :key="opt.id"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
              <el-input
                v-if="nameTemplateCustom || nameSelectValue(nameTemplate, nameTemplateCustom) === '__custom__'"
                :model-value="nameTemplate === '__custom__' ? '' : nameTemplate"
                :placeholder="nameTemplatePlaceholder"
                class="w-4xl name-template-input"
                size="small"
                @update:model-value="(v: string) => emit('customNameTemplateInput', v)"
              />
            </div>
          </div>
        </template>
      </div>
    </el-drawer>

    <ImageCropDialog
      v-model="cropDialogOpen"
      :image-path="cropDialogPath"
      :crop="cropModel"
      :title="cropDialogTitle"
      :hint="cropDialogHint"
      :initial-data-url="cropDialogInitialDataUrl"
      :natural-width="cropDialogNaturalW"
      :natural-height="cropDialogNaturalH"
      :video-path="cropDialogVideoPath"
      :frame-time-sec="cropDialogTimeSec"
      @confirm="onCropDialogConfirm"
    />
  </div>
</template>

<style scoped>
.options-scroll {
  height: auto;
}

.options-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: 10px;
  min-width: 0;
}

.crop-compose-alert,
.compose-empty-alert {
  margin-bottom: 10px;
}

.compose-summary {
  margin: 0 0 10px;
  font-size: 12px;
  color: var(--app-fg-muted);
  line-height: 1.45;
}

.encoder-chips {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  margin-left: 2px;
}

.encoder-chip {
  display: inline-block;
  padding: 0 5px;
  border-radius: 3px;
  font-size: 11px;
  line-height: 18px;
  background: color-mix(in srgb, var(--app-fg) 8%, transparent);
  color: var(--app-fg-muted);
}

.encoder-chip.ok {
  color: var(--status-ok, var(--el-color-success));
  background: color-mix(in srgb, var(--el-color-success) 14%, transparent);
}

.encoder-chip.bad {
  opacity: 0.65;
}

.options-header-left {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
  flex: 1;
}

.options-title-block {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.options-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.options-title {
  font-size: var(--fs-lg);
  font-weight: 600;
  color: var(--app-fg);
  white-space: nowrap;
  line-height: 1.4;
}

.options-desc {
  font-size: var(--fs-sm);
  color: var(--app-fg-muted);
  white-space: normal;
  line-height: 1.4;
  min-width: 0;
}

.opt-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 14px;
  min-width: 0;
}

.opt-row + .opt-row {
  margin-top: 10px;
  padding-top: 10px;
  box-shadow: inset 0 1px 0 0 color-mix(in srgb, var(--panel-border) 80%, transparent);
}

.opt-row-wrap {
  flex-wrap: wrap;
}

.opt-row-output {
  flex-wrap: wrap;
}

.opt-divider {
  width: 1px;
  height: 22px;
  flex-shrink: 0;
  align-self: center;
  background: color-mix(in srgb, var(--panel-border) 90%, transparent);
}

.opt-common {
  min-width: 0;
}

.opt-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: nowrap;
  min-height: 32px;
  min-width: 0;
}

.opt-item :deep(.label),
.opt-item > .label {
  color: var(--app-fg-muted);
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
  min-width: 4em;
  flex-shrink: 0;
}

.opt-item-fill {
  flex: 1 1 auto;
}

.opt-entry {
  flex: 0 0 auto;
}

.opt-hint-block {
  flex: 1 1 100%;
  margin: 0;
}

.opt-output {
  flex: 1 1 42%;
  min-width: 0;
}

.opt-output .output-path {
  flex: 1 1 120px;
  min-width: 0;
  max-width: 420px;
}

.opt-advanced {
  margin-top: 10px;
  padding-top: 6px;
  box-shadow: inset 0 1px 0 0 color-mix(in srgb, var(--panel-border) 80%, transparent);
}

.opt-advanced-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  margin: 0;
  padding: 6px 8px;
  border: none;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--app-fg-secondary);
  font-size: var(--fs-md);
  font-weight: 500;
  cursor: pointer;
  text-align: left;
  transition:
    background 0.15s,
    color 0.15s;
}

.opt-advanced-toggle:hover {
  background: color-mix(in srgb, var(--app-fg) var(--overlay-soft), transparent);
  color: var(--app-fg);
}

.opt-advanced-toggle:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 1px;
}

.opt-advanced-toggle .muted {
  font-weight: 400;
  font-size: var(--fs-sm);
  color: var(--app-fg-muted);
}

.opt-advanced-chevron {
  display: inline-block;
  width: 1em;
  font-size: var(--fs-sm);
  color: var(--app-fg-muted);
  transition: transform 0.15s ease;
}

.opt-advanced-chevron.open {
  transform: rotate(90deg);
}

.opt-advanced-body {
  padding: 4px 0 8px;
}

.opt-advanced-body .opt-row + .opt-row {
  margin-top: 14px;
  padding-top: 12px;
  box-shadow: inset 0 1px 0 0 color-mix(in srgb, var(--panel-border) 70%, transparent);
}

.adv-drawer-head {
  min-width: 0;
}

.adv-drawer-title {
  font-size: var(--fs-lg);
  font-weight: 600;
  color: var(--app-fg);
  line-height: 1.3;
}

.adv-drawer-sub {
  margin-top: 2px;
  font-size: var(--fs-sm);
  color: var(--app-fg-muted);
  line-height: 1.4;
}

.name-template-input {
  min-width: 140px;
}

.w-quality {
  width: 120px;
  margin: 0 8px;
}

.crop-toggle {
  width: auto;
  padding-left: 0;
}

/* 分隔线在换行后无意义：中等宽度起隐藏 */
@media (max-width: 1280px) {
  .opt-divider {
    display: none;
  }

  .opt-output,
  .opt-item-fill {
    flex: 1 1 100%;
  }

  .opt-output .output-path {
    max-width: none;
  }
}
</style>
