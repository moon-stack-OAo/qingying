<script lang="ts" setup>
import { computed } from 'vue'
import { type CompressTask, formatFileSize } from '@shared/types'
import { formatEta, statusLabel, statusType } from '../utils/taskUi'
import DropZone from './DropZone.vue'

const props = defineProps<{
  /** 当前唯一打码任务；无视频时为 null */
  task: CompressTask | null
  dragging: boolean
  mosaicRegionCount: number
  mosaicEditable: boolean
}>()

const emit = defineEmits<{
  add: []
  editMosaics: []
  start: [task: CompressTask]
  cancel: [taskId: string]
  open: [task: CompressTask]
  showInFolder: [task: CompressTask]
  clear: []
}>()

const canStart = computed(() => {
  const t = props.task
  return !!(
    t &&
    (t.status === 'pending' || t.status === 'failed' || t.status === 'cancelled')
  )
})

const isActive = computed(() => {
  const t = props.task
  return !!(t && (t.status === 'running' || t.status === 'queued'))
})

const isCompleted = computed(
  () => props.task?.status === 'completed' && !!props.task.outputPath
)

const regionHint = computed(() =>
  props.mosaicRegionCount > 0
    ? `已设置 ${props.mosaicRegionCount} 个打码区域`
    : '尚未设置打码区域'
)
</script>

<template>
  <div class="mosaic-workbench">
    <!-- 无视频：大 DropZone -->
    <DropZone
      v-if="!task"
      :dragging="dragging"
      task-mode="video-mosaic"
      @click="emit('add')"
    />

    <!-- 有视频：单卡片状态条 -->
    <div v-else class="panel mosaic-card">
      <div class="mosaic-card-main">
        <div class="mosaic-card-title-row">
          <span class="mosaic-file-name" :title="task.fileName">{{
            task.fileName
          }}</span>
          <el-tag :type="statusType(task.status)" size="small">
            {{ statusLabel(task.status) }}
          </el-tag>
        </div>

        <div class="mosaic-card-meta">
          <span>{{ formatFileSize(task.inputSize) }}</span>
          <span class="mosaic-sep">·</span>
          <span>{{ regionHint }}</span>
          <template v-if="task.status === 'completed' && task.outputSize != null">
            <span class="mosaic-sep">·</span>
            <span>输出 {{ formatFileSize(task.outputSize) }}</span>
          </template>
          <template v-if="task.time">
            <span class="mosaic-sep">·</span>
            <span>{{ task.time }}<template v-if="task.speed"> / {{ task.speed }}</template></span>
          </template>
          <template v-if="task.status === 'running' && task.etaSec != null">
            <span class="mosaic-sep">·</span>
            <span class="mosaic-muted">{{ formatEta(task.etaSec) }}</span>
          </template>
        </div>

        <el-progress
          class="mosaic-progress"
          :percentage="Number(task.progress || 0)"
          :status="
            task.status === 'completed'
              ? 'success'
              : task.status === 'failed'
                ? 'exception'
                : undefined
          "
          :stroke-width="10"
        />

        <el-tooltip
          v-if="task.error"
          :content="task.error"
          placement="top"
          :show-after="300"
        >
          <div class="mosaic-error">{{ task.error }}</div>
        </el-tooltip>
      </div>

      <div class="mosaic-card-actions">
        <el-button
          size="small"
          type="primary"
          plain
          :disabled="!mosaicEditable"
          @click="emit('editMosaics')"
        >
          编辑打码区域
        </el-button>

        <el-button
          v-if="canStart"
          size="small"
          type="success"
          @click="emit('start', task)"
        >
          开始导出
        </el-button>
        <el-button
          v-else-if="isActive"
          size="small"
          type="warning"
          @click="emit('cancel', task.id)"
        >
          取消
        </el-button>
        <template v-else-if="isCompleted">
          <el-button size="small" type="primary" @click="emit('open', task)">
            打开文件
          </el-button>
          <el-button size="small" @click="emit('showInFolder', task)">
            在文件夹中显示
          </el-button>
        </template>

        <el-button size="small" plain type="danger" @click="emit('clear')">
          清除 / 换视频
        </el-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mosaic-workbench {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.mosaic-workbench :deep(.drop-zone) {
  flex: 1;
}

.mosaic-card {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3) var(--space-4);
}

.mosaic-card-main {
  flex: 1;
  min-width: 220px;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.mosaic-card-title-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}

.mosaic-file-name {
  font-size: var(--fs-lg);
  font-weight: 600;
  color: var(--app-fg);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.mosaic-card-meta {
  font-size: var(--fs-sm);
  color: var(--app-fg-muted);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 0;
}

.mosaic-sep {
  margin: 0 6px;
  opacity: 0.6;
}

.mosaic-muted {
  color: var(--app-fg-hint);
}

.mosaic-progress {
  max-width: 420px;
}

.mosaic-error {
  font-size: var(--fs-sm);
  color: var(--el-color-danger);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 520px;
  cursor: default;
}

.mosaic-card-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}
</style>
