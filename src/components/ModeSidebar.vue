<script lang="ts" setup>
import {computed} from 'vue'
import {TASK_MODE_OPTIONS, type TaskMode, TOOL_GROUP_MODES, TOOL_GROUP_OPTIONS, type ToolGroup} from '@shared/types'

const props = defineProps<{
  taskMode: TaskMode
  appVersion: string
  concurrency: number
}>()

const emit = defineEmits<{
  'task-mode-change': [mode: TaskMode]
}>()

const GROUP_LABEL: Record<ToolGroup, string> = {
  video: '视频',
  image: '图片',
  compose: '合成'
}

const modeLabelMap = computed(() => {
  const map = new Map<TaskMode, string>()
  for (const opt of TASK_MODE_OPTIONS) {
    map.set(opt.value, opt.label)
  }
  return map
})

const groups = computed(() =>
  TOOL_GROUP_OPTIONS.map((g) => ({
    value: g.value,
    label: GROUP_LABEL[g.value] || g.label,
    modes: (TOOL_GROUP_MODES[g.value] || []).map((mode) => ({
      value: mode,
      label: modeLabelMap.value.get(mode) || mode,
      badge: mode === 'video-mosaic' ? '单任务' : ''
    }))
  }))
)

function selectMode(mode: TaskMode): void {
  if (mode === props.taskMode) return
  emit('task-mode-change', mode)
}
</script>

<template>
  <aside aria-label="任务模式" class="mode-sidebar">
    <el-scrollbar class="mode-sidebar-nav">
      <nav aria-label="模式列表">
        <div v-for="group in groups" :key="group.value" class="nav-group">
          <div class="nav-label">{{ group.label }}</div>
          <button
            v-for="mode in group.modes"
            :key="mode.value"
            :aria-current="taskMode === mode.value ? 'page' : undefined"
            :class="{ active: taskMode === mode.value }"
            class="nav-item"
            type="button"
            @click="selectMode(mode.value)"
          >
            <span class="nav-item-label">{{ mode.label }}</span>
            <span v-if="mode.badge" class="nav-badge">{{ mode.badge }}</span>
          </button>
        </div>
      </nav>
    </el-scrollbar>
    <div class="sidebar-foot">
      v{{ appVersion }} · 并发 {{ concurrency }}
    </div>
  </aside>
</template>

<style scoped>
.mode-sidebar {
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  background: var(--panel-bg);
  border-right: 1px solid var(--panel-border);
  color: var(--app-fg);
}

.mode-sidebar-nav {
  flex: 1;
  min-height: 0;
  height: auto;
}

.mode-sidebar-nav :deep(.el-scrollbar__view) {
  padding: 8px 0 4px;
}

.nav-group {
  padding: 8px 10px 4px;
}

.nav-label {
  padding: 4px 8px 8px;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--app-fg-muted);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  text-align: left;
  padding: 8px 10px;
  margin-bottom: 2px;
  border: 0;
  border-radius: var(--radius-sm, 6px);
  background: transparent;
  color: var(--app-fg);
  font: inherit;
  font-size: var(--fs-sm);
  cursor: pointer;
  transition:
    background 0.12s,
    color 0.12s;
}

.nav-item:hover {
  background: var(--fg-soft, color-mix(in oklch, var(--app-fg) 5%, transparent));
}

.nav-item.active {
  background: var(--accent-soft);
  color: var(--app-fg);
  box-shadow: inset 2px 0 0 var(--accent, var(--primary));
}

.nav-item:focus-visible {
  outline: 2px solid var(--accent-soft, color-mix(in oklch, var(--primary) 28%, transparent));
  outline-offset: 1px;
}

.nav-item-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nav-badge {
  margin-left: auto;
  flex-shrink: 0;
  font-size: 10px;
  color: var(--app-fg-muted);
  font-family: var(--font-mono);
}

.sidebar-foot {
  margin-top: auto;
  padding: 12px;
  border-top: 1px solid var(--panel-border);
  color: var(--app-fg-muted);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  font-family: var(--font-mono);
}
</style>
