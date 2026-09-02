<script lang="ts" setup>
import {computed} from 'vue'
import {CircleCheckFilled, Download, InfoFilled, Loading, WarningFilled} from '@element-plus/icons-vue'
import type {UpdateStatusPayload} from '@shared/types'
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
}>()

const state = computed(() => props.updateInfo.state)
const isInstalling = computed(() => state.value === 'installing')

function close(): void {
  if (isInstalling.value) return
  emit('update:modelValue', false)
}

function onBeforeClose(done: () => void): void {
  if (isInstalling.value) return
  done()
}

function onModelUpdate(v: boolean): void {
  if (!v && isInstalling.value) return
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

/** 无版本对比时的空态（已最新 / 检查中 / 失败 / 开发模式等） */
const isIdleLayout = computed(() => !showVersionCompare.value)

const idleTitle = computed(() => {
  switch (state.value) {
    case 'checking':
      return '正在检查更新'
    case 'installing':
      return '正在安装更新'
    case 'not-available':
      return '已是最新版本'
    case 'error':
      return '更新失败'
    default:
      return !props.isPackaged ? '开发模式' : '软件更新'
  }
})

const idleHint = computed(() => {
  if (state.value === 'installing') {
    return props.updateInfo.message || '正在静默安装并准备重启，请勿关闭本窗口'
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
      return '立即安装并重启'
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

const footerHint = computed(() => {
  switch (state.value) {
    case 'available':
      return '也可稍后从标题栏更新提示进入'
    case 'downloading':
      return '下载在后台进行，可继续处理当前任务'
    case 'downloaded':
      return '安装前请确认无进行中任务'
    case 'installing':
      return '请勿关闭本窗口'
    case 'error':
      return props.updateInfo.message || '请检查网络后重试'
    default:
      return `当前 ${props.appVersion}`
  }
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

const showPrimary = computed(() => true)

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
</script>

<template>
  <el-dialog
    :before-close="onBeforeClose"
    :close-on-click-modal="false"
    :close-on-press-escape="!isInstalling"
    :model-value="modelValue"
    :show-close="!isInstalling"
    align-center
    append-to-body
    class="update-dialog"
    destroy-on-close
    width="min(560px, 96vw)"
    @update:model-value="onModelUpdate"
  >
    <template #header>
      <div class="dlg-head-text">
        <div class="dlg-title">软件更新</div>
        <div class="dlg-sub">
          当前 {{ appVersion }}
          <template v-if="!isPackaged"> · 开发态</template>
          <template v-else> · {{ PRODUCT_NAME }}</template>
        </div>
      </div>
    </template>

    <div class="update-body" :class="{ 'is-idle': isIdleLayout }">
      <template v-if="showVersionCompare">
        <div class="ver">
          <strong v-if="state === 'downloading'">正在下载 {{ updateInfo.version }}</strong>
          <strong v-else-if="state === 'downloaded'">下载完成</strong>
          <strong v-else>{{ updateInfo.version }}</strong>
          <span v-if="state === 'downloaded'" class="num">{{ updateInfo.version }}</span>
          <span v-else-if="downloadDetail && state === 'downloading'" class="num">
            {{ downloadPercent }}%
          </span>
          <span v-else class="num">v{{ appVersion }} →</span>
        </div>

        <div
          v-if="state === 'available'"
          class="banner ok"
        >
          <strong>发现新版本。</strong>
          {{ updateInfo.message || '建议在空闲时更新；进行中的任务会先完成。' }}
        </div>

        <div
          v-else-if="state === 'downloaded'"
          class="banner warn"
        >
          <strong>需要重启应用以完成安装。</strong>
          {{ updateInfo.message || '未保存的参数会保留；进行中任务请先结束或取消。' }}
        </div>

        <div
          v-else-if="updateInfo.message && state !== 'downloading'"
          :class="{ danger: state === 'error' }"
          class="banner"
        >
          {{ updateInfo.message }}
        </div>

        <div v-if="state === 'downloading'" class="download-block">
          <div class="meter-row">
            <span>{{ downloadDetail || '正在下载…' }}</span>
            <span class="num">{{ downloadPercent }}%</span>
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
          <p class="banner soft">下载在后台进行，可继续处理当前任务。</p>
        </div>

        <div v-if="notesBlocks.length && state !== 'downloading'" class="notes-wrap">
          <div class="notes-scroll thin-scrollbar">
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
        </div>
      </template>

      <div v-else class="update-idle" :class="`is-${statusMeta.type}`">
        <div class="update-idle-icon" aria-hidden="true">
          <el-icon
            :class="{
              'update-status-spin': state === 'checking' || state === 'installing'
            }"
            :size="26"
          >
            <component :is="statusMeta.icon" />
          </el-icon>
        </div>
        <div class="update-idle-title">{{ idleTitle }}</div>
        <div class="update-idle-ver">
          <span>当前版本</span>
          <span class="num">v{{ appVersion }}</span>
        </div>
        <p class="update-idle-hint">{{ idleHint }}</p>
      </div>
    </div>

    <template #footer>
      <div class="dlg-foot">
        <span class="dlg-foot-hint">{{ footerHint }}</span>
        <el-button
          v-if="state === 'downloading'"
          @click="emit('cancelDownload')"
        >
          取消下载
        </el-button>
        <el-button
          v-else-if="state !== 'installing'"
          @click="close"
        >
          {{ state === 'downloaded' ? '稍后重启' : state === 'available' ? '稍后' : '关闭' }}
        </el-button>
        <el-button
          v-if="showPrimary"
          :disabled="primaryDisabled"
          :loading="primaryLoading"
          type="primary"
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

.update-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: min(200px, 28vh);
  font-size: 13px;
  color: var(--app-fg-secondary);
  line-height: 1.5;
}

.update-body.is-idle {
  min-height: min(180px, 24vh);
  justify-content: center;
}

.ver {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 0;
}

.ver strong {
  font-size: 18px;
  font-family: var(--font-display);
  font-weight: 600;
  color: var(--fg);
  letter-spacing: -0.01em;
}

.ver .num,
.num {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-size: 12px;
  color: var(--muted);
}

.banner {
  margin: 0;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface-2);
  font-size: 12px;
  color: var(--muted);
  line-height: 1.5;
}

.banner strong {
  color: var(--fg);
  font-weight: 600;
}

.banner.ok {
  border-color: color-mix(in oklch, var(--ok) 40%, var(--border));
  background: var(--ok-soft);
  color: var(--fg);
}

.banner.warn {
  border-color: color-mix(in oklch, var(--warn) 40%, var(--border));
  background: var(--warn-soft);
  color: var(--fg);
}

.banner.danger {
  border-color: color-mix(in oklch, var(--danger) 40%, var(--border));
  background: var(--danger-soft);
  color: var(--fg);
}

.banner.soft {
  margin-top: 12px;
}

.download-block {
  display: flex;
  flex-direction: column;
}

.meter-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin: 0 0 6px;
  font-size: 12px;
  color: var(--muted);
}

.progress {
  height: 6px;
  border-radius: 999px;
  background: var(--bg);
  border: 1px solid var(--border);
  overflow: hidden;
}

.progress > i {
  display: block;
  height: 100%;
  background: var(--accent);
  border-radius: inherit;
  transition: width 0.25s ease;
}

.notes {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.notes li {
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  background: var(--bg);
  border: 1px solid var(--border);
  font-size: 13px;
  color: var(--fg);
}

.notes-h {
  font-weight: 600;
}

.notes-wrap {
  min-height: 0;
}

.notes-scroll {
  max-height: min(220px, 32vh);
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.notes-heading {
  font-size: 13px;
  font-weight: 600;
  color: var(--fg);
}

.notes-p {
  margin: 0;
  font-size: 13px;
  color: var(--app-fg-secondary);
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

.update-idle {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 8px;
  padding: 20px 16px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg);
}

.update-idle-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--fg-soft);
  color: var(--muted);
}

.update-idle.is-ok .update-idle-icon {
  background: var(--ok-soft);
  color: var(--ok);
}

.update-idle.is-danger .update-idle-icon {
  background: var(--danger-soft);
  color: var(--danger);
}

.update-idle.is-accent .update-idle-icon,
.update-idle.is-info .update-idle-icon {
  background: var(--accent-soft);
  color: var(--accent);
}

.update-idle.is-warn .update-idle-icon {
  background: var(--warn-soft);
  color: var(--warn);
}

.update-idle-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--fg);
}

.update-idle-ver {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--muted);
}

.update-idle-hint {
  margin: 0;
  max-width: 36em;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.5;
}

.dlg-foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
  width: 100%;
}

.dlg-foot-hint {
  margin-right: auto;
  font-size: 12px;
  color: var(--muted);
  max-width: 55%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
