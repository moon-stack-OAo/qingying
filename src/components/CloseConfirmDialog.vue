<script lang="ts" setup>
import {ref, watch} from 'vue'

const visible = defineModel<boolean>({ default: false })

const emit = defineEmits<{
  decide: [action: 'tray' | 'quit', remember: boolean]
  cancel: []
}>()

const remember = ref(false)
const submitting = ref(false)
/** 是否已做出选择（托盘/退出），避免关闭时误触发 cancel */
let decided = false

watch(visible, (v) => {
  if (v) {
    remember.value = false
    submitting.value = false
    decided = false
  }
})

function decide(action: 'tray' | 'quit'): void {
  if (submitting.value) return
  submitting.value = true
  decided = true
  emit('decide', action, remember.value)
  visible.value = false
}

function onClosed(): void {
  if (!decided) emit('cancel')
}
</script>

<template>
  <el-dialog
    v-model="visible"
    align-center
    width="min(420px, 92vw)"
    :close-on-click-modal="false"
    :close-on-press-escape="true"
    append-to-body
    destroy-on-close
    class="close-confirm-dialog"
    @closed="onClosed"
  >
    <template #header>
      <div class="dlg-head-text">
        <div class="dlg-title">关闭应用</div>
        <div class="dlg-sub">选择关闭窗口后的行为</div>
      </div>
    </template>

    <div class="close-banner">
      <strong>最小化到托盘</strong>可继续后台运行；
      <strong>退出应用</strong>会结束任务并完全退出。
    </div>

    <label class="close-remember">
      <el-checkbox v-model="remember">记住选择，下次不再询问</el-checkbox>
    </label>

    <template #footer>
      <div class="dlg-foot">
        <el-button :disabled="submitting" @click="visible = false">继续等待</el-button>
        <el-button
          :disabled="submitting"
          type="primary"
          @click="decide('tray')"
        >
          最小化到托盘
        </el-button>
        <el-button
          :disabled="submitting"
          class="btn-danger-outline"
          @click="decide('quit')"
        >
          退出应用
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

.close-banner {
  margin: 0 0 16px;
  padding: 12px;
  border-radius: var(--radius-sm);
  border: 1px solid color-mix(in oklch, var(--warn) 40%, var(--border));
  background: var(--warn-soft);
  font-size: 13px;
  color: var(--app-fg);
  line-height: 1.5;
}

.close-banner strong {
  font-weight: 500;
}

.close-remember {
  display: block;
  margin: 0;
}

.dlg-foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
  width: 100%;
}
</style>

<style>
.close-confirm-dialog .btn-danger-outline,
.close-confirm-dialog .btn-danger-outline:focus,
.close-confirm-dialog .btn-danger-outline:hover,
.close-confirm-dialog .btn-danger-outline:active {
  color: var(--danger) !important;
  background: transparent !important;
  border-color: var(--border) !important;
}

.close-confirm-dialog .btn-danger-outline:hover {
  background: var(--danger-soft) !important;
  border-color: color-mix(in oklch, var(--danger) 35%, var(--border)) !important;
}
</style>
