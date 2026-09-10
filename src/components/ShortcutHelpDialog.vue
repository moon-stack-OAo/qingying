<script lang="ts" setup>
import {computed, ref} from 'vue'
import {PRODUCT_NAME, PRODUCT_TAGLINE} from '@shared/brand'

const visible = defineModel<boolean>({ default: false })

const activeTab = ref<'guide' | 'shortcuts'>('shortcuts')

/** 是否 macOS 风格修饰键展示 */
const isMac = computed(() => {
  if (typeof navigator === 'undefined') return false
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent)
})

const mod = computed(() => (isMac.value ? '⌘' : 'Ctrl'))

const globalRows = computed(() => [
  { keys: [`${mod.value}`, ','], action: '打开设置' },
  { keys: ['F1'], altKeys: [`${mod.value}`, '/'], action: '打开帮助' },
  { keys: [`${mod.value}`, 'D'], action: '切换主题' },
  { keys: [`${mod.value}`, 'O'], action: '添加文件' },
  { keys: [`${mod.value}`, 'Enter'], action: '开始全部' }
])

const taskRows = computed(() => [
  { keys: [`${mod.value}`, 'Shift', 'Enter'], action: '全部取消' },
  { keys: [`${mod.value}`, 'Esc'], action: '全部取消' },
  { keys: [`${mod.value}`, 'Shift', 'O'], action: '选择输出目录' },
  { keys: [`${mod.value}`, 'L'], action: '清除已完成' }
])

const guideSteps = [
  {
    title: '添加文件',
    desc: '拖拽视频到窗口，或使用「添加视频」；支持文件夹递归添加。'
  },
  {
    title: '选择模式与参数',
    desc: '视频压缩、抽音频、拼接或打码；预设、输出目录、命名模板可在任务选项中调整。'
  },
  {
    title: '开始处理',
    desc: '点击全部开始或使用快捷键；可并行多个任务，支持取消与查看进度。'
  },
  {
    title: '查看结果',
    desc: '完成后可打开文件或在文件夹中显示；任务详情含参数摘要与完整命令行。'
  }
]

const tips = [
  '关闭窗口可最小化到托盘或退出（设置中可改默认行为）。',
  '设置中可切换主题、开机自启、FFmpeg 路径、图片引擎，并检查更新。',
  '打包安装后支持自动更新；下载完成后需点「安装并重启」。'
]
</script>

<template>
  <el-dialog
    v-model="visible"
    class="help-dialog"
    width="min(720px, 96vw)"
    destroy-on-close
    append-to-body
    align-center
  >
    <template #header>
      <div class="dlg-head-text">
        <div class="dlg-title">帮助中心</div>
        <div class="dlg-sub">{{ PRODUCT_NAME }} · {{ PRODUCT_TAGLINE }}</div>
      </div>
    </template>

    <div class="help-body">
      <div aria-label="帮助分区" class="help-tabs" role="tablist">
        <button
          type="button"
          :aria-selected="activeTab === 'shortcuts'"
          :class="{ active: activeTab === 'shortcuts' }"
          class="help-tab"
          role="tab"
          @click="activeTab = 'shortcuts'"
        >
          快捷键
        </button>
        <button
          class="help-tab"
          type="button"
          :class="{ active: activeTab === 'guide' }"
          role="tab"
          :aria-selected="activeTab === 'guide'"
          @click="activeTab = 'guide'"
        >
          使用说明
        </button>
      </div>

      <el-scrollbar
        v-show="activeTab === 'shortcuts'"
        class="help-panel"
        max-height="min(420px, 54vh)"
      >
        <div class="help-grid">
          <div>
            <div class="section-label">全局</div>
            <div
              v-for="(row, i) in globalRows"
              :key="`g-${i}`"
              class="shortcut"
            >
              <span class="action">{{ row.action }}</span>
              <span class="keys">
                <template v-for="(k, j) in row.keys" :key="`gk-${j}`">
                  <kbd class="kbd">{{ k }}</kbd>
                </template>
                <template v-if="row.altKeys">
                  <span class="key-or">或</span>
                  <template v-for="(k, j) in row.altKeys" :key="`ga-${j}`">
                    <kbd class="kbd">{{ k }}</kbd>
                  </template>
                </template>
              </span>
            </div>
          </div>
          <div>
            <div class="section-label">任务</div>
            <div
              v-for="(row, i) in taskRows"
              :key="`t-${i}`"
              class="shortcut"
            >
              <span class="action">{{ row.action }}</span>
              <span class="keys">
                <template v-for="(k, j) in row.keys" :key="`tk-${j}`">
                  <kbd class="kbd">{{ k }}</kbd>
                </template>
              </span>
            </div>
          </div>
        </div>
      </el-scrollbar>

      <el-scrollbar
        v-show="activeTab === 'guide'"
        class="help-panel"
        max-height="min(420px, 54vh)"
      >
        <div class="help-list">
          <div v-for="(step, i) in guideSteps" :key="i" class="help-item">
            <strong>{{ i + 1 }}. {{ step.title }}</strong>
            <span>{{ step.desc }}</span>
          </div>
        </div>
        <div class="section-label">小提示</div>
        <ul class="help-tips">
          <li v-for="(t, i) in tips" :key="i">{{ t }}</li>
        </ul>
      </el-scrollbar>
    </div>

    <template #footer>
      <div class="dlg-foot">
        <span class="dlg-foot-hint">本地帮助</span>
        <el-button type="primary" @click="visible = false">关闭</el-button>
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

.help-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
}

.help-tabs {
  display: flex;
  gap: 2px;
  padding: 2px;
  width: fit-content;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg);
}

.help-tab {
  height: 28px;
  padding: 0 12px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--muted);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}

.help-tab:hover {
  color: var(--fg);
}

.help-tab.active {
  background: var(--surface);
  color: var(--fg);
  box-shadow: 0 0 0 1px var(--border);
}

.help-tab:focus-visible {
  outline: 2px solid var(--accent-soft);
  outline-offset: 1px;
}

.help-panel {
  flex: 1 1 auto;
  min-height: min(220px, 30vh);
  height: auto;
}

.help-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

@media (max-width: 640px) {
  .help-grid {
    grid-template-columns: 1fr;
  }
}

.section-label {
  margin: 0 0 8px;
  font-size: 11px;
  font-weight: 600;
  font-family: var(--font-mono);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted);
}

.shortcut {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
}

.shortcut:last-child {
  border-bottom: 0;
}

.action {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: var(--fg);
}

.keys {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: center;
}

.kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 22px;
  padding: 0 6px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg);
  color: var(--fg);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
}

.key-or {
  margin: 0 2px;
  font-size: 11px;
  color: var(--muted);
}

.help-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.help-item {
  display: block;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg);
}

.help-item strong {
  display: block;
  font-size: 13px;
  margin-bottom: 2px;
  color: var(--fg);
}

.help-item span {
  font-size: 12px;
  color: var(--muted);
  line-height: 1.5;
}

.help-tips {
  margin: 0;
  padding-left: 1.15em;
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.5;
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
  color: var(--muted);
}
</style>
