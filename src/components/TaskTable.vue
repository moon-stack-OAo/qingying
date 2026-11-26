<script lang="ts" setup>
import {ref, toRef} from 'vue'
import {ElMessage} from 'element-plus'
import {type CompressTask, formatFileSize} from '@shared/types'
import {
  formatEta,
  modeLabel as modeLabelText,
  optionsSummary,
  sizeCompareClass,
  sizeCompareText,
  statusLabel,
  statusPillClass
} from '../utils/taskUi'
import {useTaskThumbs} from '../composables/useTaskThumbs'

const props = defineProps<{
  tasks: CompressTask[]
  hasActive: boolean
  selectedTaskId?: string | null
}>()

const { thumbUrl, thumbLoading, isAudioMode, ensurePreview } = useTaskThumbs(
  toRef(props, 'tasks')
)

const previewVisible = ref(false)
const previewUrl = ref('')
const previewTitle = ref('')
const previewBusy = ref(false)

async function openThumbPreview(task: CompressTask, e?: Event): Promise<void> {
  e?.stopPropagation()
  if (isAudioMode(task.options?.mode)) return
  if (!thumbUrl(task.id) && !thumbLoading(task.id)) return
  previewTitle.value = task.fileName || task.id
  previewUrl.value = thumbUrl(task.id) || ''
  previewVisible.value = true
  previewBusy.value = true
  try {
    const hi = await ensurePreview(task.id)
    if (hi) previewUrl.value = hi
  } finally {
    previewBusy.value = false
  }
}

const emit = defineEmits<{
  startOne: [task: CompressTask]
  cancelOne: [taskId: string]
  removeOne: [taskId: string]
  openOutput: [task: CompressTask]
  showInFolder: [task: CompressTask]
  selectTask: [taskId: string]
  cancelAll: []
  clearFinished: []
  clearAll: []
  openStitchOrder: [task: CompressTask]
}>()

function onRowClick(row: CompressTask): void {
  emit('selectTask', row.id)
}

function rowClassName({ row }: { row: CompressTask }): string {
  return props.selectedTaskId && row.id === props.selectedTaskId
    ? 'task-row-selected'
    : ''
}

/** 任务模式简写 */
function modeLabel(task: CompressTask): string {
  return modeLabelText(task.options?.mode)
}

function modeTagType(
  task: CompressTask
): '' | 'success' | 'warning' | 'info' | 'danger' {
  const m = task.options?.mode
  if (m === 'audio') return 'warning'
  if (m === 'image' || m === 'image-crop' || m === 'image-stitch') return 'success'
  if (m === 'images-to-gif') return 'success'
  if (m === 'gif-optimize') return 'success'
  if (m === 'video-concat') return 'danger'
  if (m === 'media-compose') return 'warning'
  if (m === 'video-mosaic') return 'danger'
  if (m === 'video-to-gif') return 'warning'
  return 'info'
}

const detailVisible = ref(false)
const detailTask = ref<CompressTask | null>(null)

function openDetail(task: CompressTask): void {
  detailTask.value = task
  detailVisible.value = true
}

async function copyCommand(): Promise<void> {
  const cmd = detailTask.value?.commandLine
  if (!cmd) return
  try {
    await navigator.clipboard.writeText(cmd)
    ElMessage.success('已复制命令行')
  } catch {
    ElMessage.error('复制失败')
  }
}

function onActionCommand(cmd: string, row: CompressTask): void {
  if (cmd === 'folder') emit('showInFolder', row)
  else if (cmd === 'detail') openDetail(row)
  else if (cmd === 'remove') emit('removeOne', row.id)
}

function isStitchTask(task: CompressTask): boolean {
  const m = task.options?.mode
  return (
    m === 'image-stitch' || m === 'video-concat' || m === 'images-to-gif'
  )
}

function stitchPaths(task: CompressTask): string[] {
  const multi = (task.inputPaths || [])
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean)
  if (multi.length > 0) return multi
  const single =
    typeof task.inputPath === 'string' ? task.inputPath.trim() : ''
  return single ? [single] : []
}

function stitchCount(task: CompressTask): number {
  return stitchPaths(task).length
}

function isStitchEditable(task: CompressTask): boolean {
  return (
    isStitchTask(task) &&
    (task.status === 'pending' || task.status === 'failed')
  )
}

function stitchToggleLabel(task: CompressTask): string {
  const n = stitchCount(task)
  const m = task.options?.mode
  const unit = m === 'image-stitch' || m === 'images-to-gif' ? '张' : '段'
  const verb = m === 'images-to-gif' ? '编辑帧顺序' : '编辑拼接顺序'
  return `${verb} · ${n} ${unit}`
}

function stitchPreview(task: CompressTask): string {
  const paths = stitchPaths(task)
  const names = paths.slice(0, 3).map((p) => {
    const s = p.replace(/\\/g, '/')
    const i = s.lastIndexOf('/')
    return i >= 0 ? s.slice(i + 1) : s
  })
  if (paths.length > 3) names.push(`…共 ${paths.length}`)
  return names.join(' → ')
}
</script>

<template>
  <div class="panel task-table">
    <div class="panel-title">
      <div class="panel-title-left">
        <span>任务列表</span>
        <span class="muted">共 {{ tasks.length }} 项</span>
      </div>
      <div class="panel-title-actions">
        <el-button
          :disabled="!hasActive"
          size="small"
          type="warning"
          @click="emit('cancelAll')"
        >
          全部取消
        </el-button>
        <el-button size="small" @click="emit('clearFinished')">清除已完成</el-button>
        <el-button plain size="small" type="danger" @click="emit('clearAll')">
          清空列表
        </el-button>
      </div>
    </div>

    <div class="task-table-body">
    <el-table
      :data="tasks"
      :row-class-name="rowClassName"
      empty-text="暂无任务，请添加文件"
      height="100%"
      highlight-current-row
      stripe
      @row-click="onRowClick"
    >
      <el-table-column label="文件名" min-width="220">
        <template #default="{ row }">
          <div class="file-cell-row">
            <el-tooltip
              content="点击查看大图"
              placement="top"
              :show-after="400"
              :disabled="!thumbUrl(row.id)"
            >
              <button
                :class="{
                  'is-audio': isAudioMode(row.options?.mode),
                  'is-loading': thumbLoading(row.id),
                  'is-empty':
                    !thumbUrl(row.id) &&
                    !thumbLoading(row.id) &&
                    !isAudioMode(row.options?.mode),
                  'is-clickable': Boolean(thumbUrl(row.id))
                }"
                :disabled="!thumbUrl(row.id)"
                class="file-thumb"
                type="button"
                @click="openThumbPreview(row, $event)"
              >
                <img
                  v-if="thumbUrl(row.id)"
                  :src="thumbUrl(row.id)!"
                  alt=""
                  class="file-thumb-img"
                  draggable="false"
                />
              </button>
            </el-tooltip>
            <div class="file-cell">
            <el-tooltip
              :content="row.fileName"
              placement="top"
              :show-after="400"
              :disabled="!row.fileName"
            >
              <span class="file-name">{{ row.fileName }}</span>
            </el-tooltip>
            <template v-if="isStitchTask(row)">
              <div class="stitch-entry" @click.stop>
                <el-button
                  size="small"
                  :type="stitchCount(row) < 2 ? 'warning' : 'primary'"
                  plain
                  @click="emit('openStitchOrder', row)"
                >
                  {{ stitchToggleLabel(row) }}
                </el-button>
                <span
                  v-if="stitchPreview(row)"
                  class="stitch-preview"
                  :title="stitchPreview(row)"
                >
                  {{ stitchPreview(row) }}
                </span>
                <span v-if="stitchCount(row) < 2" class="stitch-warn">
                  至少 2 个才能启动
                </span>
                <span
                  v-else-if="!isStitchEditable(row)"
                  class="stitch-order-hint"
                >
                  运行中仅可查看
                </span>
              </div>
            </template>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="模式" width="64">
        <template #default="{ row }">
          <el-tag
            :type="modeTagType(row)"
            effect="plain"
            size="small"
          >
            {{ modeLabel(row) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="88">
        <template #default="{ row }">
          <span :class="statusPillClass(row.status)" class="status-pill">
            {{ statusLabel(row.status) }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="进度" min-width="130">
        <template #default="{ row }">
          <el-progress
            :percentage="Number(row.progress || 0)"
            :status="
              row.status === 'completed'
                ? 'success'
                : row.status === 'failed'
                  ? 'exception'
                  : undefined
            "
            :stroke-width="12"
          />
        </template>
      </el-table-column>
      <el-table-column label="原始" width="88">
        <template #default="{ row }">
          <span class="size-text">{{ formatFileSize(row.inputSize) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="输出" width="88">
        <template #default="{ row }">
          <span class="size-text">
            {{ row.status === 'completed' ? formatFileSize(row.outputSize) : '—' }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="节省" width="80">
        <template #default="{ row }">
          <span :class="sizeCompareClass(row)" class="size-text">
            {{ sizeCompareText(row) }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="时间/速度" width="140">
        <template #default="{ row }">
          <span class="meta-text">
            {{ row.time || '-' }}
            <template v-if="row.speed"> / {{ row.speed }}</template>
            <template v-if="row.status === 'running' && row.etaSec != null">
              <br />
              <span class="meta-muted">{{ formatEta(row.etaSec) }}</span>
            </template>
          </span>
        </template>
      </el-table-column>
      <el-table-column label="信息" min-width="110">
        <template #default="{ row }">
          <el-tooltip
            v-if="row.error"
            :content="row.error"
            placement="top"
            :show-after="400"
            :disabled="!row.error"
          >
            <span class="err-text">{{ row.error }}</span>
          </el-tooltip>
          <el-tooltip
            v-else-if="row.status === 'completed'"
            :content="row.resolvedEncoder || ''"
            placement="top"
            :show-after="400"
            :disabled="!row.resolvedEncoder"
          >
            <span class="meta-ok">
              完成{{ row.resolvedEncoder ? ` · ${row.resolvedEncoder}` : '' }}
            </span>
          </el-tooltip>
          <span v-else class="meta-muted">—</span>
        </template>
      </el-table-column>
      <el-table-column fixed="right" label="操作" width="130" class-name="task-actions-col">
        <template #default="{ row }">
          <div class="task-actions">
            <el-button
              v-if="
                row.status === 'pending' ||
                row.status === 'failed' ||
                row.status === 'cancelled'
              "
              link
              size="small"
              type="primary"
              @click="emit('startOne', row)"
            >
              开始
            </el-button>
            <el-button
              v-else-if="row.status === 'running' || row.status === 'queued'"
              link
              size="small"
              type="warning"
              @click="emit('cancelOne', row.id)"
            >
              取消
            </el-button>
            <el-button
              v-else-if="row.status === 'completed' && row.outputPath"
              link
              size="small"
              type="primary"
              @click="emit('openOutput', row)"
            >
              打开
            </el-button>

            <el-dropdown trigger="click" @command="(cmd: string) => onActionCommand(cmd, row)">
              <el-button link size="small">更多</el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item
                    v-if="row.status === 'completed' && row.outputPath"
                    command="folder"
                  >
                    文件夹
                  </el-dropdown-item>
                  <el-dropdown-item command="detail">详情</el-dropdown-item>
                  <el-dropdown-item command="remove" divided>
                    <span class="action-danger">移除</span>
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </template>
      </el-table-column>
    </el-table>
    </div>

    <el-drawer
      v-model="detailVisible"
      title="任务详情"
      size="480px"
      direction="rtl"
    >
      <template v-if="detailTask">
        <div class="detail-block">
          <div class="detail-label">输入</div>
          <div class="detail-value mono">{{ detailTask.inputPath }}</div>
        </div>
        <div class="detail-block">
          <div class="detail-label">输出</div>
          <div class="detail-value mono">{{ detailTask.outputPath || '—' }}</div>
        </div>
        <div class="detail-block">
          <div class="detail-label">状态</div>
          <div class="detail-value">
            {{ statusLabel(detailTask.status) }}
            <template v-if="detailTask.resolvedEncoder">
              · {{ detailTask.resolvedEncoder }}
            </template>
          </div>
        </div>
        <div class="detail-block">
          <div class="detail-label">参数摘要</div>
          <pre class="detail-pre">{{ optionsSummary(detailTask) }}</pre>
        </div>
        <div class="detail-block">
          <div class="detail-label">
            命令行
            <el-button
              v-if="detailTask.commandLine"
              link
              size="small"
              type="primary"
              @click="copyCommand"
            >
              复制
            </el-button>
          </div>
          <pre class="detail-pre mono">{{ detailTask.commandLine || '（任务结束后可查看）' }}</pre>
        </div>
        <div v-if="detailTask.error" class="detail-block">
          <div class="detail-label">错误</div>
          <pre class="detail-pre err">{{ detailTask.error }}</pre>
        </div>
      </template>
    </el-drawer>

    <el-dialog
      v-model="previewVisible"
      :title="previewTitle || '预览'"
      align-center
      class="thumb-preview-dialog"
      destroy-on-close
      width="min(920px, 94vw)"
      @closed="previewUrl = ''"
    >
       <div :class="{ 'is-loading': previewBusy }" class="thumb-preview-body">
         <span v-if="previewBusy" aria-hidden="true" class="thumb-preview-loading"></span>
         <img
          v-if="previewUrl"
          :alt="previewTitle"
          :src="previewUrl"
          class="thumb-preview-img"
        />
        <div v-else class="thumb-preview-empty muted">暂无预览</div>
      </div>
    </el-dialog>
  </div>
</template>

<style scoped>
.panel-title {
  flex-shrink: 0;
}

.panel-title-left {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.panel-title-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
  min-width: 0;
}

.task-table {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.task-table-body {
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
}

.meta-text {
  font-size: var(--fs-sm);
  color: var(--app-fg-secondary);
  font-variant-numeric: tabular-nums;
  font-family: var(--font-mono);
}

.meta-muted {
  font-size: var(--fs-sm);
  color: var(--app-fg-muted);
}

.meta-ok {
  font-size: var(--fs-sm);
  color: var(--status-ok);
}

.status-pill {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
  border: 1px solid transparent;
  white-space: nowrap;
}

.pill-ok {
  color: var(--ok);
  background: var(--ok-soft);
  border-color: color-mix(in oklch, var(--ok) 28%, var(--border));
}

.pill-warn {
  color: var(--warn);
  background: var(--warn-soft);
  border-color: color-mix(in oklch, var(--warn) 28%, var(--border));
}

.pill-danger {
  color: var(--danger);
  background: var(--danger-soft);
  border-color: color-mix(in oklch, var(--danger) 28%, var(--border));
}

.pill-accent {
  color: var(--accent);
  background: var(--accent-soft);
  border-color: color-mix(in oklch, var(--accent) 28%, var(--border));
}

.pill-muted {
  color: var(--muted);
  background: var(--fg-soft);
  border-color: var(--border);
}

.detail-block {
  margin-bottom: var(--space-4);
}

.detail-label {
  font-size: var(--fs-sm);
  color: var(--app-fg-muted);
  margin-bottom: var(--space-1);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.detail-value {
  font-size: var(--fs-md);
  color: var(--app-fg);
  word-break: break-all;
}

.detail-pre {
  margin: 0;
  padding: var(--space-2) 12px;
  background: var(--notes-bg);
  border-radius: var(--radius-xs);
  font-size: var(--fs-sm);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 200px;
  overflow: auto;
  color: var(--app-fg-secondary);
}

.detail-pre.mono,
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.detail-pre.err {
  color: var(--status-bad);
  background: color-mix(in srgb, var(--status-bad) 12%, transparent);
}

.task-actions {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  flex-wrap: nowrap;
}

.action-danger {
  color: var(--status-bad);
}

/* EP2 sticky 固定列：实底不透字 + 左侧阴影 */
:deep(th.el-table-fixed-column--right),
:deep(td.el-table-fixed-column--right) {
  background: var(--panel-bg) !important;
  background-clip: padding-box !important;
}

:deep(th.el-table-fixed-column--right.is-first-column::before),
:deep(td.el-table-fixed-column--right.is-first-column::before) {
  box-shadow: none !important;
  background-color: transparent !important;
}

:deep(.el-table__header th.el-table-fixed-column--right) {
  background: color-mix(in oklch, var(--fg) 3%, var(--panel-bg)) !important;
}

:deep(.el-table__body tr:hover > td.el-table-fixed-column--right) {
  background: color-mix(in oklch, var(--fg) 4%, var(--panel-bg)) !important;
}

:deep(.el-table__body tr.el-table__row--striped > td.el-table-fixed-column--right) {
  background: color-mix(in oklch, var(--fg) 2.5%, var(--panel-bg)) !important;
}

:deep(.el-table__body tr.el-table__row--striped:hover > td.el-table-fixed-column--right) {
  background: color-mix(in oklch, var(--fg) 5%, var(--panel-bg)) !important;
}

:deep(.el-table__body tr.task-row-selected > td.el-table-fixed-column--right) {
  background: color-mix(in oklch, var(--accent) 12%, var(--panel-bg)) !important;
}

:deep(.el-table__body tr.task-row-selected:hover > td.el-table-fixed-column--right) {
  background: color-mix(in oklch, var(--accent) 16%, var(--panel-bg)) !important;
}

:deep(.task-row-selected > td.el-table__cell:not(.el-table-fixed-column--right)) {
  background: color-mix(in oklch, var(--accent) 12%, var(--panel-bg)) !important;
}

:deep(.el-table__body tr.task-row-selected:hover > td.el-table__cell:not(.el-table-fixed-column--right)) {
  background: color-mix(in oklch, var(--accent) 16%, var(--panel-bg)) !important;
}

:deep(.el-table .el-table__cell) {
  padding: 4px 0;
}

:deep(.el-table .cell) {
  line-height: 1.35;
}

.file-cell-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 2px 0;
}

.file-thumb {
  width: 32px;
  height: 32px;
  padding: 0;
  border-radius: 6px;
  flex-shrink: 0;
  overflow: hidden;
  background: color-mix(in srgb, var(--app-fg-muted) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--app-fg-muted) 22%, transparent);
  cursor: default;
}

.file-thumb.is-clickable {
  cursor: zoom-in;
}

.file-thumb.is-clickable:hover {
  border-color: color-mix(in oklch, var(--accent) 55%, transparent);
  box-shadow: 0 0 0 2px color-mix(in oklch, var(--accent) 22%, transparent);
}

.file-thumb:disabled {
  cursor: default;
}

.file-thumb.is-audio {
  background: color-mix(in srgb, var(--el-color-warning) 16%, transparent);
  border-color: color-mix(in srgb, var(--el-color-warning) 28%, transparent);
}

.file-thumb.is-loading {
  background:
    linear-gradient(
      90deg,
      color-mix(in srgb, var(--app-fg-muted) 10%, transparent) 25%,
      color-mix(in srgb, var(--app-fg-muted) 18%, transparent) 37%,
      color-mix(in srgb, var(--app-fg-muted) 10%, transparent) 63%
    );
  background-size: 400% 100%;
  animation: thumb-shimmer 1.2s ease-in-out infinite;
}

.file-thumb.is-empty {
  background:
    linear-gradient(
      145deg,
      color-mix(in srgb, var(--app-fg-muted) 14%, transparent),
      color-mix(in srgb, var(--app-fg-muted) 6%, transparent)
    );
}

.file-thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  pointer-events: none;
}

.thumb-preview-body {
  position: relative;
  min-height: 240px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--app-fg-muted) 8%, transparent);
  border-radius: 10px;
  overflow: auto;
  max-height: min(78vh, 760px);
}

.thumb-preview-loading {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 24px;
  height: 24px;
  margin: -12px 0 0 -12px;
  border: 2px solid color-mix(in srgb, var(--app-fg-muted) 25%, transparent);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: thumb-preview-spin 0.8s linear infinite;
  pointer-events: none;
}

@keyframes thumb-preview-spin {
  to {
    transform: rotate(360deg);
  }
}

.thumb-preview-img {
  max-width: 100%;
  max-height: min(78vh, 760px);
  object-fit: contain;
  display: block;
}

.thumb-preview-empty {
  padding: 40px 16px;
  font-size: var(--fs-sm);
}

@keyframes thumb-shimmer {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: 0 0;
  }
}

.file-cell {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.file-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.stitch-entry {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  margin-top: 4px;
  max-width: 100%;
}

.stitch-preview {
  flex: 1 1 140px;
  min-width: 0;
  max-width: 360px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--fs-sm);
  color: var(--app-fg-muted);
  line-height: 1.3;
}

.stitch-order-hint {
  font-size: var(--fs-sm);
  color: var(--app-fg-hint, var(--app-fg-muted));
  line-height: 1.3;
}

.stitch-warn {
  font-size: var(--fs-sm);
  color: var(--el-color-warning);
}
</style>
