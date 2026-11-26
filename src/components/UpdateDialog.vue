<script lang="ts" setup>
import {computed} from 'vue'
import {CircleCheckFilled, Download, InfoFilled, Loading, WarningFilled} from '@element-plus/icons-vue'
import type {UpdateState, UpdateStatusPayload} from '@shared/types'
import {PRODUCT_NAME} from '@shared/brand'

const props = defineProps<{
  modelValue: boolean
  appVersion: string
  isPackaged: boolean
  updateInfo: UpdateStatusPayload
  updateChecking: boolean
  updateDownloading: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  checkUpdate: []
  downloadUpdate: []
  cancelDownload: []
  installUpdate: []
  previewState: [state: UpdateState]
}>()

const state = computed(() => props.updateInfo.state)
const isInstalling = computed(() => state.value === 'installing')
/** 开发态预览安装中时允许关闭，避免卡死 */
const lockClose = computed(() => isInstalling.value && props.isPackaged)

const previewStates: { value: UpdateState; label: string }[] = [
  { value: 'idle', label: '空闲' },
  { value: 'checking', label: '检查中' },
  { value: 'available', label: '有更新' },
  { value: 'downloading', label: '下载中' },
  { value: 'downloaded', label: '已下载' },
  { value: 'installing', label: '安装中' },
  { value: 'not-available', label: '已最新' },
  { value: 'error', label: '失败' }
]

function close(): void {
  if (lockClose.value) return
  emit('update:modelValue', false)
}

function onBeforeClose(done: () => void): void {
  if (lockClose.value) return
  done()
}

function onModelUpdate(v: boolean): void {
  if (!v && lockClose.value) return
  emit('update:modelValue', v)
}

const statusMeta = computed(() => {
  switch (state.value) {
    case 'checking':
      return { type: 'info' as const, label: '正在检查更新', icon: Loading }
    case 'available':
      return { type: 'ok' as const, label: '发现新版本', icon: Download }
    case 'downloading':
      return { type: 'accent' as const, label: '正在下载更新', icon: Download }
    case 'downloaded':
      return { type: 'warn' as const, label: '更新已就绪', icon: CircleCheckFilled }
    case 'installing':
      return { type: 'info' as const, label: '正在安装更新', icon: Loading }
    case 'not-available':
      return { type: 'ok' as const, label: '已是最新版本', icon: CircleCheckFilled }
    case 'error':
      return { type: 'danger' as const, label: '更新失败', icon: WarningFilled }
    default:
      return { type: 'info' as const, label: '软件更新', icon: InfoFilled }
  }
})

const showVersionCompare = computed(() => {
  const s = state.value
  return Boolean(
    props.updateInfo.version &&
      (s === 'available' || s === 'downloading' || s === 'downloaded')
  )
})

const heroTitle = computed(() => {
  switch (state.value) {
    case 'checking':
      return '正在检查更新'
    case 'available':
      return '有可用更新'
    case 'downloading':
      return '正在下载更新'
    case 'downloaded':
      return '准备安装更新'
    case 'installing':
      return '正在安装更新'
    case 'not-available':
      return '已是最新版本'
    case 'error':
      return '更新失败'
    default:
      return !props.isPackaged ? '开发模式' : '检查软件更新'
  }
})

const heroHint = computed(() => {
  if (state.value === 'installing') {
    return props.updateInfo.message || '正在静默安装并准备重启，请勿关闭本窗口'
  }
  if (state.value === 'available') {
    return props.updateInfo.message || '建议在空闲时更新；进行中的任务会先完成。'
  }
  if (state.value === 'downloaded') {
    return props.updateInfo.message || '重启后完成安装；未保存参数会保留。'
  }
  if (state.value === 'downloading') {
    return '下载在后台进行，可继续处理当前任务'
  }
  if (props.updateInfo.message) return props.updateInfo.message
  if (!props.isPackaged) return '开发模式不检查更新，请使用打包后的安装包验证'
  if (state.value === 'checking') return '正在连接更新服务器…'
  return '点击下方按钮检查是否有新版本'
})

const downloadPercent = computed(() =>
  Math.min(100, Math.max(0, Math.round(props.updateInfo.percent || 0)))
)

const downloadDetail = computed(() => {
  const { transferred, total, bytesPerSecond } = props.updateInfo
  if (transferred == null && total == null) return ''
  const parts: string[] = []
  if (transferred != null && total != null && total > 0) {
    parts.push(`${formatBytes(transferred)} / ${formatBytes(total)}`)
  } else if (transferred != null) {
    parts.push(formatBytes(transferred))
  }
  if (bytesPerSecond != null && bytesPerSecond > 0) {
    parts.push(`${formatBytes(bytesPerSecond)}/s`)
  }
  return parts.join(' · ')
})

const notesBlocks = computed(() => parseReleaseNotes(props.updateInfo.releaseNotes))

const primaryLabel = computed(() => {
  switch (state.value) {
    case 'available':
      return '立即下载'
    case 'downloading':
      return '下载中'
    case 'downloaded':
      return '安装并重启'
    case 'installing':
      return '正在安装…'
    case 'error':
      return props.updateInfo.version ? '重试下载' : '重新检查'
    case 'not-available':
    case 'idle':
      return '检查更新'
    default:
      return '检查更新'
  }
})

const secondaryLabel = computed(() => {
  if (state.value === 'downloading') return '取消下载'
  if (state.value === 'downloaded') return '稍后重启'
  if (state.value === 'available') return '稍后'
  return '关闭'
})

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '—'
  if (n < 1024) return `${Math.round(n)} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

type NotesBlock =
  | { type: 'h'; level: 2 | 3 | 4; text: string }
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] }

/** 轻量解析 Release 说明（Markdown 子集 / 纯文本） */
function parseReleaseNotes(raw?: string): NotesBlock[] {
  if (!raw?.trim()) return []

  let text = raw.replace(/\r\n/g, '\n').trim()
  if (/<[a-z][\s\S]*>/i.test(text)) {
    text = text
      .replace(/<\/(h[1-6]|p|div|li|tr)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/?(ul|ol|table|thead|tbody)>/gi, '\n')
      .replace(/<li[^>]*>/gi, '- ')
      .replace(/<h([1-6])[^>]*>/gi, (_, lv) => `${'#'.repeat(Number(lv))} `)
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
  }

  text = text.replace(/^#\s+(?:轻影|FFmpeg)[^\n]*\n+/i, '')

  const lines = text.split('\n')
  const blocks: NotesBlock[] = []
  let listItems: string[] = []
  let para: string[] = []

  const flushList = () => {
    if (listItems.length) {
      blocks.push({ type: 'ul', items: listItems })
      listItems = []
    }
  }
  const flushPara = () => {
    if (para.length) {
      blocks.push({ type: 'p', text: para.join(' ').trim() })
      para = []
    }
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      flushList()
      flushPara()
      continue
    }

    const heading = /^(#{1,4})\s+(.+)$/.exec(trimmed)
    if (heading) {
      flushList()
      flushPara()
      const level = Math.min(4, Math.max(2, heading[1].length)) as 2 | 3 | 4
      blocks.push({ type: 'h', level, text: heading[2].trim() })
      continue
    }

    const bullet = /^[-*+]\s+(.+)$/.exec(trimmed)
    if (bullet) {
      flushPara()
      listItems.push(bullet[1].trim())
      continue
    }

    flushList()
    para.push(trimmed)
  }
  flushList()
  flushPara()
  return blocks
}

function inlineHtml(text: string): string {
  const esc = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return esc
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
}

function onPrimary(): void {
  // 开发态：主按钮只推进预览态，不走真实更新
  if (!props.isPackaged) {
    switch (state.value) {
      case 'available':
        emit('previewState', 'downloading')
        break
      case 'downloading':
        emit('previewState', 'downloaded')
        break
      case 'downloaded':
        emit('previewState', 'installing')
        break
      case 'installing':
        emit('previewState', 'not-available')
        break
      case 'error':
        emit('previewState', props.updateInfo.version ? 'downloading' : 'checking')
        break
      case 'checking':
        emit('previewState', 'available')
        break
      default:
        emit('previewState', 'checking')
    }
    return
  }

  switch (state.value) {
    case 'available':
      emit('downloadUpdate')
      break
    case 'downloaded':
      emit('installUpdate')
      break
    case 'error':
      if (props.updateInfo.version) emit('downloadUpdate')
      else emit('checkUpdate')
      break
    case 'not-available':
    case 'idle':
    case 'checking':
      emit('checkUpdate')
      break
    default:
      break
  }
}

function onSecondary(): void {
  if (state.value === 'downloading') {
    if (!props.isPackaged) {
      emit('previewState', 'available')
      return
    }
    emit('cancelDownload')
    return
  }
  close()
}

const showPrimary = computed(() => true)
const showSecondary = computed(() => !lockClose.value)

const primaryLoading = computed(() => {
  if (state.value === 'available') return props.updateDownloading
  if (state.value === 'downloading' || state.value === 'installing') return true
  if (state.value === 'idle' || state.value === 'not-available' || state.value === 'checking') {
    return props.updateChecking
  }
  return false
})

const primaryDisabled = computed(() => {
  if (state.value === 'downloading' || state.value === 'installing') return true
  if (state.value === 'error' && !props.updateInfo.version && props.updateChecking) return true
  return false
})

const primaryButtonType = computed(() => {
  if (state.value === 'error') return 'danger' as const
  if (state.value === 'downloaded') return 'warning' as const
  return 'primary' as const
})
</script>

<template>
  <el-dialog
    :before-close="onBeforeClose"
    :close-on-click-modal="false"
    :close-on-press-escape="!lockClose"
    :model-value="modelValue"
    :show-close="!lockClose"
    align-center
    append-to-body
    class="update-dialog"
    destroy-on-close
    width="min(420px, 92vw)"
    @update:model-value="onModelUpdate"
  >
    <template #header>
      <div class="dlg-head-text">
        <div class="dlg-title">软件更新</div>
        <div class="dlg-sub">
          {{ PRODUCT_NAME }}
          <template v-if="!isPackaged"> · 开发态</template>
        </div>
      </div>
    </template>

    <div class="update-body">
      <div class="hero" :class="`is-${statusMeta.type}`">
        <div class="hero-icon" aria-hidden="true">
          <el-icon
            :class="{
              'update-status-spin': state === 'checking' || state === 'installing'
            }"
            :size="28"
          >
            <component :is="statusMeta.icon" />
          </el-icon>
        </div>
        <div class="hero-title">{{ heroTitle }}</div>
        <div v-if="showVersionCompare" class="hero-version">
          <span class="ver-chip muted">v{{ appVersion }}</span>
          <span class="ver-arrow" aria-hidden="true">→</span>
          <span class="ver-chip accent">{{ updateInfo.version }}</span>
        </div>
        <div v-else class="hero-version">
          <span class="ver-chip muted">当前 v{{ appVersion }}</span>
        </div>
        <p class="hero-hint">{{ heroHint }}</p>
      </div>

      <div v-if="state === 'downloading'" class="download-block">
        <div class="meter-row">
          <span class="meter-label">{{ downloadDetail || '正在下载…' }}</span>
          <span class="meter-pct num">{{ downloadPercent }}%</span>
        </div>
        <div
          :aria-valuenow="downloadPercent"
          aria-valuemax="100"
          aria-valuemin="0"
          class="progress"
          role="progressbar"
        >
          <i :style="{ width: `${downloadPercent}%` }" />
        </div>
      </div>

      <div
        v-if="notesBlocks.length && showVersionCompare && state !== 'downloading'"
        class="notes-wrap"
      >
        <div class="notes-label">更新说明</div>
        <el-scrollbar class="notes-scroll" max-height="min(160px, 24vh)">
          <div class="notes-inner">
            <template v-for="(block, i) in notesBlocks" :key="i">
              <div
                v-if="block.type === 'h'"
                class="notes-heading"
                v-html="inlineHtml(block.text)"
              />
              <p
                v-else-if="block.type === 'p'"
                class="notes-p"
                v-html="inlineHtml(block.text)"
              />
              <ul v-else-if="block.type === 'ul'" class="notes">
                <li
                  v-for="(item, j) in block.items"
                  :key="j"
                  v-html="inlineHtml(item)"
                />
              </ul>
            </template>
          </div>
        </el-scrollbar>
      </div>

      <div v-if="!isPackaged" class="preview-bar" aria-label="开发态 UI 预览">
        <span class="preview-label">预览</span>
        <div class="preview-chips">
          <button
            v-for="item in previewStates"
            :key="item.value"
            type="button"
            class="preview-chip"
            :class="{ active: state === item.value }"
            @click="emit('previewState', item.value)"
          >
            {{ item.label }}
          </button>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dlg-foot" :class="{ 'is-solo': lockClose || !showSecondary }">
        <el-button
          v-if="!lockClose"
          class="btn-secondary"
          @click="onSecondary"
        >
          {{ secondaryLabel }}
        </el-button>
        <el-button
          v-if="showPrimary"
          :disabled="isPackaged ? primaryDisabled : false"
          :loading="isPackaged ? primaryLoading : false"
          :type="primaryButtonType"
          class="btn-primary"
          @click="onPrimary"
        >
          {{ primaryLabel }}
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
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0;
  color: var(--app-fg);
  line-height: 1.3;
}

.dlg-sub {
  margin-top: 2px;
  font-size: 12px;
  color: var(--app-fg-muted);
  line-height: 1.4;
}

.update-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
}

.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 8px;
  padding: 8px 4px 4px;
}

.hero-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-soft);
  color: var(--accent);
  box-shadow: 0 0 0 1px color-mix(in oklch, var(--accent) 22%, var(--border));
}

.hero.is-ok .hero-icon {
  background: var(--ok-soft);
  color: var(--ok);
  box-shadow: 0 0 0 1px color-mix(in oklch, var(--ok) 28%, var(--border));
}

.hero.is-danger .hero-icon {
  background: var(--danger-soft);
  color: var(--danger);
  box-shadow: 0 0 0 1px color-mix(in oklch, var(--danger) 28%, var(--border));
}

.hero.is-warn .hero-icon {
  background: var(--warn-soft);
  color: var(--warn);
  box-shadow: 0 0 0 1px color-mix(in oklch, var(--warn) 28%, var(--border));
}

.hero.is-accent .hero-icon,
.hero.is-info .hero-icon {
  background: var(--accent-soft);
  color: var(--accent);
  box-shadow: 0 0 0 1px color-mix(in oklch, var(--accent) 22%, var(--border));
}

.hero-title {
  margin-top: 4px;
  font-size: 17px;
  font-weight: 500;
  font-family: var(--font-display);
  letter-spacing: 0;
  color: var(--fg);
  line-height: 1.25;
}

.hero-version {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: center;
}

.ver-chip {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  border-radius: 6px;
  font-family: var(--font-mono);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--muted);
}

.ver-chip.accent {
  color: var(--accent);
  border-color: color-mix(in oklch, var(--accent) 35%, var(--border));
  background: var(--accent-soft);
}

.ver-arrow {
  color: var(--muted);
  font-size: 12px;
}

.hero-hint {
  margin: 2px 0 0;
  max-width: 32em;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.55;
}

.download-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-radius: var(--radius);
  border: 1px solid color-mix(in oklch, var(--accent) 22%, var(--border));
  background: color-mix(in oklch, var(--accent) 6%, var(--surface-2, var(--bg)));
}

.meter-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  font-size: 12px;
}

.meter-label {
  min-width: 0;
  color: var(--app-fg-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meter-pct {
  flex-shrink: 0;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-weight: 500;
  color: var(--accent);
}

.progress {
  height: 8px;
  border-radius: 4px;
  background: color-mix(in oklch, var(--fg) 8%, var(--bg));
  border: 1px solid var(--border);
  overflow: hidden;
}

.progress > i {
  display: block;
  height: 100%;
  background: var(--accent);
  border-radius: inherit;
  transition: width 0.25s cubic-bezier(0.22, 1, 0.36, 1);
}

.notes-wrap {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.notes-label {
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: none;
  color: var(--muted);
}

.notes-scroll {
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--bg);
  height: auto;
}

.notes-inner {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
}

.notes {
  margin: 0;
  padding: 0 0 0 1.1em;
  display: flex;
  flex-direction: column;
  gap: 4px;
  list-style: disc;
}

.notes li {
  font-size: 12px;
  color: var(--fg);
  line-height: 1.5;
}

.notes-heading {
  font-size: 12px;
  font-weight: 500;
  color: var(--fg);
}

.notes-p {
  margin: 0;
  font-size: 12px;
  color: var(--app-fg-secondary);
  line-height: 1.5;
}

.notes :deep(code),
.notes-p :deep(code),
.notes-heading :deep(code) {
  font-family: var(--font-mono);
  font-size: 0.92em;
  padding: 0 4px;
  border-radius: 3px;
  background: var(--fg-soft);
  color: var(--fg);
}

.preview-bar {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 4px;
  border-top: 1px dashed var(--border);
}

.preview-label {
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: none;
  color: var(--muted);
}

.preview-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.preview-chip {
  height: 24px;
  padding: 0 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg);
  color: var(--muted);
  font-size: 11px;
  cursor: pointer;
}

.preview-chip:hover {
  color: var(--fg);
  border-color: color-mix(in oklch, var(--accent) 35%, var(--border));
}

.preview-chip.active {
  color: var(--accent);
  border-color: color-mix(in oklch, var(--accent) 40%, var(--border));
  background: var(--accent-soft);
  font-weight: 500;
}

.dlg-foot {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  width: 100%;
}

.dlg-foot.is-solo {
  grid-template-columns: 1fr;
}

.dlg-foot :deep(.el-button) {
  margin: 0;
  width: 100%;
  height: 36px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0;
}

.dlg-foot :deep(.btn-secondary) {
  --el-button-bg-color: color-mix(in oklch, var(--fg) 3%, var(--panel-bg));
  --el-button-border-color: var(--border);
  --el-button-text-color: var(--fg);
  --el-button-hover-bg-color: color-mix(in oklch, var(--fg) 6%, var(--panel-bg));
  --el-button-hover-border-color: color-mix(in oklch, var(--accent) 28%, var(--border));
  --el-button-hover-text-color: var(--fg);
  --el-button-active-bg-color: color-mix(in oklch, var(--fg) 8%, var(--panel-bg));
  --el-button-active-border-color: color-mix(in oklch, var(--accent) 35%, var(--border));
  --el-button-active-text-color: var(--fg);
}

.dlg-foot :deep(.btn-primary) {
  box-shadow: 0 1px 2px color-mix(in oklch, var(--fg) 8%, transparent);
}

.dlg-foot :deep(.btn-primary.is-disabled),
.dlg-foot :deep(.btn-primary.is-loading) {
  box-shadow: none;
}

.update-status-spin {
  animation: update-status-spin 0.9s linear infinite;
}

@keyframes update-status-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
