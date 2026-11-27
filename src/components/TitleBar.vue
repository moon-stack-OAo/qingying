<script lang="ts" setup>
import {computed, onMounted, onUnmounted, ref} from 'vue'
import {Close, FullScreen, Minus, Moon, QuestionFilled, Setting, Sunny} from '@element-plus/icons-vue'
import type {FfmpegStatus, ThemeMode} from '@shared/types'
import {PRODUCT_NAME} from '@shared/brand'

const props = defineProps<{
  appVersion: string
  ffmpegStatus: FfmpegStatus
  /** 有可用更新时在版本旁显示提示 */
  updateAvailable?: boolean
  /** 远端版本号，用于 tooltip */
  updateVersion?: string
  /** 已下载待安装 */
  updateDownloaded?: boolean
  /** 当前主题偏好（light / dark / system） */
  theme?: ThemeMode
  /** 解析后的暗色态（system 时按系统偏好） */
  isDark?: boolean
}>()

const ffmpegReady = computed(() => Boolean(props.ffmpegStatus?.ready))
const ffmpegTip = computed(() => {
  if (ffmpegReady.value) {
    return props.ffmpegStatus.ffmpegPath
      ? `FFmpeg 就绪\n${props.ffmpegStatus.ffmpegPath}`
      : 'FFmpeg 就绪'
  }
  return props.ffmpegStatus?.error || 'FFmpeg 未就绪'
})

const showUpdateBadge = computed(
  () => Boolean(props.updateAvailable || props.updateDownloaded)
)
const updateBadgeLabel = computed(() =>
  props.updateDownloaded ? '就绪' : '更新'
)
const updateBadgeTip = computed(() => {
  const ver = props.updateVersion ? ` v${props.updateVersion}` : ''
  if (props.updateDownloaded) return `更新已下载${ver}，点击安装并重启`
  return `发现新版本${ver}，点击查看`
})

const themeToggleTip = computed(() =>
  props.isDark ? '切换浅色' : '切换深色'
)

const emit = defineEmits<{
  openSettings: []
  showShortcuts: []
  openUpdate: []
  'toggle-theme': []
}>()

const maximized = ref(false)
let offMaximized: (() => void) | undefined

onMounted(async () => {
  try {
    maximized.value = await window.electronAPI.windowIsMaximized()
  } catch {
    maximized.value = false
  }
  offMaximized = window.electronAPI.onWindowMaximizedChanged((v) => {
    maximized.value = v
  })
})

onUnmounted(() => {
  offMaximized?.()
})

async function minimize(): Promise<void> {
  await window.electronAPI.windowMinimize()
}

async function toggleMaximize(): Promise<void> {
  maximized.value = await window.electronAPI.windowMaximizeToggle()
}

async function close(): Promise<void> {
  await window.electronAPI.windowClose()
}
</script>

<template>
  <header class="title-bar" @dblclick="toggleMaximize">
    <div class="title-bar-left">
      <el-tooltip
        :content="`${PRODUCT_NAME} v${appVersion}`"
        placement="top"
        :show-after="400"
      >
        <div class="title-bar-brand">
          <img class="title-bar-icon" src="../favicon.png" alt="" draggable="false" />
          <div class="title-bar-text">
            <span class="title-bar-name">{{ PRODUCT_NAME }}</span>
            <span class="title-bar-ver">v{{ appVersion }}</span>
          </div>
        </div>
      </el-tooltip>
      <el-tooltip
        v-if="showUpdateBadge"
        :content="updateBadgeTip"
        placement="top"
        :show-after="400"
      >
        <button
          type="button"
          class="title-bar-new"
          :class="{ 'is-ready': updateDownloaded }"
          @click.stop="emit('openUpdate')"
        >
          {{ updateBadgeLabel }}
        </button>
      </el-tooltip>
      <el-tooltip
        :content="ffmpegTip"
        placement="top"
        :show-after="400"
        popper-class="tooltip-pre-line"
      >
        <span
          class="title-bar-status"
          :class="ffmpegReady ? 'is-ready' : 'is-bad'"
        >
          <span class="title-bar-status-dot" aria-hidden="true" />
          {{ ffmpegReady ? 'FFmpeg 就绪' : 'FFmpeg 未就绪' }}
        </span>
      </el-tooltip>
    </div>

    <div class="title-bar-drag" aria-hidden="true" />

    <div class="title-bar-actions">
      <el-tooltip :content="themeToggleTip" :show-after="400" placement="top">
        <button
          :aria-label="themeToggleTip"
          class="tb-btn"
          type="button"
          @click="emit('toggle-theme')"
        >
          <el-icon :size="15">
            <Sunny v-if="isDark" />
            <Moon v-else />
          </el-icon>
        </button>
      </el-tooltip>
      <el-tooltip content="帮助 (F1)" placement="top" :show-after="400">
        <button type="button" class="tb-btn" @click="emit('showShortcuts')">
          <el-icon :size="15"><QuestionFilled /></el-icon>
        </button>
      </el-tooltip>
      <el-tooltip content="设置" placement="top" :show-after="400">
        <button type="button" class="tb-btn" @click="emit('openSettings')">
          <el-icon :size="15"><Setting /></el-icon>
        </button>
      </el-tooltip>
      <el-tooltip content="最小化" placement="top" :show-after="400">
        <button type="button" class="tb-btn" @click="minimize">
          <el-icon :size="14"><Minus /></el-icon>
        </button>
      </el-tooltip>
      <el-tooltip
        :content="maximized ? '还原' : '最大化'"
        placement="top"
        :show-after="400"
      >
        <button type="button" class="tb-btn" @click="toggleMaximize">
          <el-icon v-if="!maximized" :size="13"><FullScreen /></el-icon>
          <span v-else class="tb-restore" aria-hidden="true" />
        </button>
      </el-tooltip>
      <el-tooltip content="关闭" placement="top" :show-after="400">
        <button type="button" class="tb-btn tb-close" @click="close">
          <el-icon :size="15"><Close /></el-icon>
        </button>
      </el-tooltip>
    </div>
  </header>
</template>

<style scoped>
.title-bar {
  display: flex;
  align-items: stretch;
  height: 36px;
  flex-shrink: 0;
  background: color-mix(in srgb, var(--panel-bg) 92%, var(--app-bg));
  box-shadow: inset 0 -1px 0 0 var(--panel-border);
  user-select: none;
  z-index: 20;
}

.title-bar-left {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 8px 0 12px;
  min-width: 0;
  -webkit-app-region: drag;
}

.title-bar-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  /* 需接收悬停以显示 tooltip，不可整块 drag */
  -webkit-app-region: no-drag;
}

.title-bar-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  border-radius: 4px;
  pointer-events: none;
}

.title-bar-text {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.title-bar-name {
  font-size: var(--fs-md);
  font-weight: 500;
  letter-spacing: 0;
  color: var(--app-fg);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.2;
}

.title-bar-ver {
  font-size: var(--fs-xs);
  font-weight: 500;
  color: var(--app-fg-muted);
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
  opacity: 0.9;
}

.title-bar-new {
  margin: 0 0 0 2px;
  padding: 0 6px;
  height: 18px;
  border: 1px solid color-mix(in oklch, var(--accent) 35%, var(--panel-border));
  border-radius: 4px;
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0;
  line-height: 1;
  color: var(--accent);
  background: var(--accent-soft);
  cursor: pointer;
  -webkit-app-region: no-drag;
  transition:
    background 0.15s cubic-bezier(0.22, 1, 0.36, 1),
    border-color 0.15s cubic-bezier(0.22, 1, 0.36, 1),
    color 0.15s cubic-bezier(0.22, 1, 0.36, 1);
}

.title-bar-new:hover {
  background: color-mix(in oklch, var(--accent) 22%, transparent);
  border-color: color-mix(in oklch, var(--accent) 45%, var(--panel-border));
}

.title-bar-new:active {
  background: color-mix(in oklch, var(--accent) 28%, transparent);
}

.title-bar-new:focus-visible {
  outline: 2px solid var(--accent, var(--primary));
  outline-offset: 1px;
}

.title-bar-new.is-ready {
  color: var(--status-ok, #16a34a);
  background: var(--ok-soft);
  border-color: color-mix(in oklch, var(--status-ok, #16a34a) 35%, var(--panel-border));
}

.title-bar-status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  margin-left: 2px;
  padding: 0;
  border-radius: 0;
  font-size: var(--fs-xs);
  font-weight: 400;
  line-height: 1.2;
  white-space: nowrap;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--app-fg-muted);
  background: transparent;
  /* 需接收悬停以显示路径 tooltip */
  -webkit-app-region: no-drag;
}

.title-bar-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  background: currentColor;
}

.title-bar-status.is-ready {
  color: var(--app-fg-muted);
}

.title-bar-status.is-ready .title-bar-status-dot {
  color: var(--el-color-success);
  background: var(--el-color-success);
}

.title-bar-status.is-bad {
  color: var(--el-color-danger);
}

.title-bar-status.is-bad .title-bar-status-dot {
  background: currentColor;
}

.title-bar-drag {
  flex: 1 1 auto;
  min-width: 24px;
  -webkit-app-region: drag;
}

.title-bar-actions {
  display: flex;
  align-items: stretch;
  flex-shrink: 0;
  -webkit-app-region: no-drag;
}

/* el-tooltip 触发器保持标题栏按钮拉伸高度 */
.title-bar-actions :deep(.el-tooltip__trigger) {
  display: inline-flex;
  align-self: stretch;
}

.title-bar-actions :deep(.el-tooltip__trigger) .tb-btn {
  height: 100%;
}

.tb-btn {
  width: 46px;
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--app-fg-secondary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition:
    background 0.12s,
    color 0.12s;
}

.tb-btn:hover {
  background: color-mix(in srgb, var(--app-fg) 8%, transparent);
  color: var(--app-fg);
}

.tb-btn:active {
  background: color-mix(in srgb, var(--app-fg) 12%, transparent);
}

.tb-btn:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: -2px;
  z-index: 1;
}

.tb-close:hover {
  background: #e81123;
  color: #fff;
}

.tb-close:active {
  background: #c50f1f;
  color: #fff;
}

/* 还原：双框图标 */
.tb-restore {
  width: 10px;
  height: 10px;
  position: relative;
  box-shadow:
    inset 0 0 0 1.2px currentColor,
    2px -2px 0 -0.2px transparent,
    2px -2px 0 0 currentColor;
  border-radius: 1px;
}
</style>
