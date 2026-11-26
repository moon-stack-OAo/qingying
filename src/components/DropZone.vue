<script lang="ts" setup>
import {computed} from 'vue'
import {UploadFilled} from '@element-plus/icons-vue'
import type {TaskMode} from '@shared/types'

const props = defineProps<{
  dragging: boolean
  /** 有任务时压缩高度，把空间留给任务列表 */
  compact?: boolean
  taskMode?: TaskMode
  /** 多任务时提示可选中任务单独编辑裁切 */
  showTaskEditHint?: boolean
}>()

const emit = defineEmits<{
  click: []
}>()

const title = computed(() => {
  const m = props.taskMode || 'compress'
  if (props.compact) {
    if (m === 'image' || m === 'image-crop') return '拖入追加 · 或点击添加图片'
    if (m === 'image-stitch') return '拖入追加 · 多选即一组拼接'
    if (m === 'images-to-gif') return '拖入追加 · 多选即一组动图'
    if (m === 'video-concat') return '拖入追加 · 多选即一组拼接'
    if (m === 'media-compose') return '拖入追加主视频'
    if (m === 'video-mosaic') return '打码仅支持单个视频'
    if (m === 'gif-optimize') return '拖入追加 · 或点击添加动图'
    if (m === 'video-to-gif') return '拖入追加 · 或点击添加视频'
    if (m === 'audio') return '拖入追加 · 或点击添加视频'
    return '拖入追加 · 或点击添加视频'
  }
  if (m === 'image' || m === 'image-crop') return '拖入图片到此处'
  if (m === 'image-stitch') return '拖入多张图片到此处'
  if (m === 'images-to-gif') return '拖入多张图片到此处（合成动图）'
  if (m === 'gif-optimize') return '拖入 GIF / 动图 WebP 到此处（优化体积）'
  if (m === 'video-concat') return '拖入多段视频到此处'
  if (m === 'media-compose') return '拖入主视频到此处'
  if (m === 'video-mosaic') return '拖入单个视频到此处'
  if (m === 'video-to-gif') return '拖入视频到此处（转 GIF / 动图 WebP）'
  if (m === 'audio') return '拖入视频到此处'
  return '拖入视频到此处'
})

const hint = computed(() => {
  const m = props.taskMode || 'compress'
  let base =
    m === 'image' ||
    m === 'image-crop' ||
    m === 'image-stitch' ||
    m === 'images-to-gif'
      ? '支持 JPG / PNG / WebP / BMP / TIFF · 可拖到窗口任意位置'
      : '支持 MP4 / MKV / MOV / AVI / WebM · 可拖到窗口任意位置'
  if (m === 'video-mosaic') {
    base = '仅支持单个视频 · 可拖到窗口任意位置'
  } else if (m === 'gif-optimize') {
    base =
      '仅 GIF / 动图 WebP · 默认最长边 480、约 10fps · 可拖到窗口任意位置'
  } else if (m === 'video-to-gif') {
    base =
      '输出 GIF 或动图 WebP（WebP 通常更小，兼容性略差）· 建议短片段 · 可拖到窗口任意位置'
  } else if (m === 'images-to-gif') {
    base =
      '至少 2 张图 · 按添加顺序成帧 · 输出 GIF / 动图 WebP · 可拖到窗口任意位置'
  } else if (m === 'media-compose') {
    base += ' · 片头/片尾/叠加图在选项中设置'
  } else if (props.showTaskEditHint) {
    base += ' · 选中任务可单独编辑裁切/混剪'
  }
  return base
})

const step1 = computed(() => {
  const m = props.taskMode || 'compress'
  if (
    m === 'image' ||
    m === 'image-crop' ||
    m === 'image-stitch' ||
    m === 'images-to-gif'
  ) {
    return '添加图片'
  }
  if (m === 'gif-optimize') return '添加动图'
  return '添加视频'
})

const step2 = computed(() => {
  const m = props.taskMode || 'compress'
  if (m === 'video-mosaic') return '编辑区域'
  return '确认选项 / 输出'
})

const step3 = computed(() => {
  const m = props.taskMode || 'compress'
  if (m === 'video-mosaic') return '开始打码'
  if (m === 'gif-optimize') return '全部开始（优化）'
  if (m === 'video-to-gif' || m === 'images-to-gif') return '全部开始（转动图）'
  return '全部开始'
})

/** 仅视频相关大空态显示淡时间线刻度（剪辑台气质） */
const showTimeline = computed(() => {
  if (props.compact) return false
  const m = props.taskMode || 'compress'
  return (
    m === 'compress' ||
    m === 'audio' ||
    m === 'video-concat' ||
    m === 'media-compose' ||
    m === 'video-mosaic' ||
    m === 'video-to-gif'
  )
})

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    emit('click')
  }
}
</script>

<template>
  <div
    :class="{ active: dragging, compact: compact }"
    class="drop-zone"
    role="button"
    tabindex="0"
    @click="emit('click')"
    @keydown="onKeydown"
  >
    <el-icon class="drop-icon" :size="compact ? 22 : 40">
      <UploadFilled />
    </el-icon>

    <template v-if="compact">
      <div class="drop-title">{{ title }}</div>
      <div class="hint">
        {{ hint }}
      </div>
    </template>

    <template v-else>
      <div
        v-if="showTimeline"
        class="drop-timeline"
        aria-hidden="true"
      >
        <span
          v-for="i in 17"
          :key="i"
          class="drop-tick"
          :class="{ major: (i - 1) % 4 === 0 }"
        />
      </div>
      <div class="drop-title">{{ title }}</div>
      <ol class="drop-steps">
        <li><span class="step-num">①</span>{{ step1 }}</li>
        <li><span class="step-num">②</span>{{ step2 }}</li>
        <li><span class="step-num">③</span>{{ step3 }}</li>
      </ol>
      <div class="hint">
        {{ hint }}
      </div>
    </template>
  </div>
</template>
