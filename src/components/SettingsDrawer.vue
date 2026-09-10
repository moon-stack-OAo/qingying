<script lang="ts" setup>
import {ref, watch} from 'vue'
import {ElMessage, ElMessageBox} from 'element-plus'
import {Folder} from '@element-plus/icons-vue'
import type {
  AppInfo,
  CloseAction,
  FfmpegStatus,
  ImageEngineId,
  ImageEngineStatus,
  LanStatus,
  ThemeMode
} from '@shared/types'
import {
  CLOSE_ACTION_OPTIONS,
  CONCURRENCY_HINT,
  CONCURRENCY_OPTIONS,
  IMAGE_ENGINE_OPTIONS,
  THEME_OPTIONS
} from '@shared/types'
import {PRODUCT_NAME, PRODUCT_TAGLINE} from '@shared/brand'

const props = defineProps<{
  visible: boolean
  theme: ThemeMode
  concurrency: number
  notifyOnComplete: boolean
  persistTasks: boolean
  closeAction: CloseAction
  openAtLogin: boolean
  startMinimizedToTray: boolean
  ffmpegBinDir: string
  ffmpegStatus: FfmpegStatus | null
  imageEngine: ImageEngineId
  imagemagickPath: string
  imageStatus: ImageEngineStatus | null
  appVersion: string
  isPackaged: boolean
  appInfo: AppInfo | null
  updateChecking: boolean
  lanStatus: LanStatus | null
  lanSaving: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  themeChange: [v: ThemeMode]
  concurrencyChange: [n: number]
  notifyOnCompleteChange: [v: boolean]
  persistTasksChange: [v: boolean]
  closeActionChange: [v: CloseAction]
  openAtLoginChange: [v: boolean]
  startMinimizedToTrayChange: [v: boolean]
  browseFfmpegDir: []
  clearFfmpegBinDir: []
  reDetectFfmpeg: []
  imageEngineChange: [v: ImageEngineId]
  browseMagickPath: []
  clearMagickPath: []
  reDetectImage: []
  testImageEngine: []
  openAppData: []
  changeDataDir: []
  clearStoredTasks: []
  resetSettings: []
  checkUpdate: []
  refreshLanStatus: []
  saveLanConfig: [
    config: {
      enabled?: boolean
      port?: number
      bindHost?: '0.0.0.0' | '127.0.0.1'
      username?: string
      password?: string
    }
  ]
}>()

const activeTab = ref('general')

/** 局域网密码最短长度（与主进程校验一致） */
const LAN_PASSWORD_MIN_LENGTH = 8

/** 远程访问表单（本地编辑，点保存后提交） */
const lanEnabled = ref(false)
const lanPort = ref(17890)
const lanBindHost = ref<'0.0.0.0' | '127.0.0.1'>('127.0.0.1')
const lanUsername = ref('admin')
const lanPassword = ref('')
const lanPassword2 = ref('')
const lanPairRefreshing = ref(false)

function syncLanFormFromProps(): void {
  const s = props.lanStatus
  if (!s) return
  lanEnabled.value = s.enabled
  lanPort.value = s.port || 17890
  lanBindHost.value = s.bindHost === '0.0.0.0' ? '0.0.0.0' : '127.0.0.1'
  lanUsername.value = s.username || 'admin'
  lanPassword.value = ''
  lanPassword2.value = ''
}

function formatPairExpires(ts: number | null | undefined): string {
  if (!ts) return ''
  try {
    return new Date(ts).toLocaleTimeString()
  } catch {
    return ''
  }
}

async function onRefreshPairCode(): Promise<void> {
  lanPairRefreshing.value = true
  try {
    const status = await window.electronAPI.refreshLanPairCode()
    emit('refreshLanStatus')
    if (status.pairCode) {
      ElMessage.success('配对码已刷新')
    } else {
      ElMessage.info('当前为仅本机绑定，无需配对码')
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    ElMessage.error(message || '刷新配对码失败')
  } finally {
    lanPairRefreshing.value = false
  }
}

async function copyPairCode(): Promise<void> {
  const code = props.lanStatus?.pairCode
  if (!code) return
  try {
    await navigator.clipboard.writeText(code)
    ElMessage.success('已复制配对码')
  } catch {
    ElMessage.error('复制失败')
  }
}

watch(
  () => props.visible,
  (v) => {
    if (v) {
      activeTab.value = 'general'
      syncLanFormFromProps()
      emit('refreshLanStatus')
    }
  }
)

watch(
  () => props.lanStatus,
  () => {
    if (props.visible) syncLanFormFromProps()
  }
)

async function onLanToggle(v: string | number | boolean): Promise<void> {
  const enabled = Boolean(v)
  // 开启时若无密码，阻止并强提示
  if (enabled && !props.lanStatus?.hasPassword && !lanPassword.value) {
    lanEnabled.value = false
    ElMessage.warning(
      `未设置密码，无法开启远程访问。请先填写至少 ${LAN_PASSWORD_MIN_LENGTH} 位强密码，再点击「保存远程设置」`
    )
    return
  }
  if (enabled && lanBindHost.value === '0.0.0.0') {
    try {
      await ElMessageBox.confirm(
        '即将绑定局域网（0.0.0.0）：同网段设备均可访问，通信为 HTTP 明文。登录除密码外还需桌面显示的配对码。确定继续？',
        '安全确认',
        {
          type: 'warning',
          confirmButtonText: '仍要开启局域网',
          cancelButtonText: '取消'
        }
      )
    } catch {
      lanEnabled.value = false
      return
    }
  }
  lanEnabled.value = enabled
  emit('saveLanConfig', {
    enabled,
    port: lanPort.value,
    bindHost: lanBindHost.value,
    username: lanUsername.value,
    ...(lanPassword.value ? { password: lanPassword.value } : {})
  })
}

async function onSaveLan(): Promise<void> {
  if (lanPassword.value || lanPassword2.value) {
    if (lanPassword.value.length < LAN_PASSWORD_MIN_LENGTH) {
      ElMessage.warning(`密码至少 ${LAN_PASSWORD_MIN_LENGTH} 位`)
      return
    }
    if (lanPassword.value !== lanPassword2.value) {
      ElMessage.warning('两次密码不一致')
      return
    }
  }
  if (lanEnabled.value && !props.lanStatus?.hasPassword && !lanPassword.value) {
    ElMessage.warning(
      `开启远程访问前必须设置至少 ${LAN_PASSWORD_MIN_LENGTH} 位密码（未设密码将拒绝启动服务）`
    )
    return
  }
  if (lanEnabled.value && lanBindHost.value === '0.0.0.0') {
    try {
      await ElMessageBox.confirm(
        '当前将绑定局域网地址：同网段可访问、HTTP 明文，登录需配对码。更安全可选「仅本机」127.0.0.1。确定保存？',
        '安全确认',
        {
          type: 'warning',
          confirmButtonText: '仍要保存',
          cancelButtonText: '取消'
        }
      )
    } catch {
      return
    }
  }
  const port = Math.max(1024, Math.min(65535, Math.floor(Number(lanPort.value) || 17890)))
  lanPort.value = port
  emit('saveLanConfig', {
    enabled: lanEnabled.value,
    port,
    bindHost: lanBindHost.value,
    username: lanUsername.value.trim() || 'admin',
    ...(lanPassword.value ? { password: lanPassword.value } : {})
  })
  lanPassword.value = ''
  lanPassword2.value = ''
}

async function copyLanUrl(url: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(url)
    ElMessage.success('已复制访问地址')
  } catch {
    ElMessage.error('复制失败')
  }
}

async function confirmClearTasks(): Promise<void> {
  try {
    await ElMessageBox.confirm(
      '将删除本地已持久化的任务记录，进行中的任务不受影响。确定清空吗？',
      '清空持久化任务',
      {
        type: 'warning',
        confirmButtonText: '清空',
        cancelButtonText: '取消'
      }
    )
    emit('clearStoredTasks')
  } catch {
    // 用户取消
  }
}

async function confirmReset(): Promise<void> {
  try {
    await ElMessageBox.confirm(
      '将恢复所有设置为默认值，包括主题、并发数与自定义 ffmpeg 目录。确定重置吗？',
      '重置全部设置',
      {
        type: 'warning',
        confirmButtonText: '重置',
        cancelButtonText: '取消'
      }
    )
    emit('resetSettings')
  } catch {
    // 用户取消
  }
}

async function copyUserDataPath(): Promise<void> {
  const p = props.appInfo?.userDataPath
  if (!p) return
  try {
    await navigator.clipboard.writeText(p)
    ElMessage.success('已复制数据目录路径')
  } catch {
    ElMessage.error('复制失败')
  }
}

function onPathKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    void copyUserDataPath()
  }
}
</script>

<template>
  <el-drawer
    :model-value="visible"
    class="settings-drawer"
    size="min(420px, 100%)"
    append-to-body
    @update:model-value="(v: boolean) => emit('update:visible', v)"
  >
    <template #header>
      <div class="dlg-head-text">
        <div class="dlg-title">设置</div>
        <div class="dlg-sub">偏好在本机保存，立即生效</div>
      </div>
    </template>

    <el-tabs v-model="activeTab" class="settings-tabs">
      <el-tab-pane label="通用" name="general" lazy>
        <el-scrollbar class="settings-scroll">
        <div class="setting-pane">
          <div class="section-label">外观</div>
          <div class="setting-row setting-row-meta">
            <div class="setting-meta">
              <strong>主题</strong>
              <span>跟随系统或手动锁定</span>
            </div>
            <div aria-label="主题" class="theme-seg" role="group">
              <button
                v-for="opt in THEME_OPTIONS"
                :key="opt.value"
                :aria-pressed="theme === opt.value"
                type="button"
                @click="emit('themeChange', opt.value)"
              >
                {{ opt.label === '跟随系统' ? '系统' : opt.label }}
              </button>
            </div>
          </div>

          <div class="section-label">任务</div>
          <div class="setting-row setting-row-meta">
            <div class="setting-meta">
              <strong>最大并发</strong>
              <span>{{ CONCURRENCY_HINT }}</span>
            </div>
            <el-select
              :model-value="concurrency"
              size="small"
              class="w-sm"
              aria-label="最大并发"
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
          <div class="setting-row setting-row-meta">
            <div class="setting-meta">
              <strong>完成后通知</strong>
              <span>系统托盘气泡提示</span>
            </div>
            <el-switch
              :model-value="notifyOnComplete"
              size="small"
              @change="(v: string | number | boolean) => emit('notifyOnCompleteChange', Boolean(v))"
            />
          </div>
          <div class="setting-row setting-row-meta">
            <div class="setting-meta">
              <strong>持久化任务</strong>
              <span>重启后保留任务列表</span>
            </div>
            <el-switch
              :model-value="persistTasks"
              size="small"
              @change="(v: string | number | boolean) => emit('persistTasksChange', Boolean(v))"
            />
          </div>
          <div class="setting-row setting-row-meta">
            <div class="setting-meta">
              <strong>关闭窗口</strong>
              <span>点击关闭按钮时的默认行为</span>
            </div>
            <el-select
              :model-value="closeAction"
              size="small"
              class="w-xl"
              @change="(v: CloseAction) => emit('closeActionChange', v)"
            >
              <el-option
                v-for="opt in CLOSE_ACTION_OPTIONS"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </div>
          <div class="setting-row setting-row-meta">
            <div class="setting-meta">
              <strong>开机自启</strong>
              <span>登录后自动打开（安装版更可靠）</span>
            </div>
            <el-switch
              :model-value="openAtLogin"
              size="small"
              @change="(v: string | number | boolean) => emit('openAtLoginChange', Boolean(v))"
            />
          </div>
          <div class="setting-row setting-row-meta">
            <div class="setting-meta">
              <strong>启动到托盘</strong>
              <span>开机后先进入托盘，不弹主窗</span>
            </div>
            <el-switch
              :disabled="!openAtLogin"
              :model-value="startMinimizedToTray"
              size="small"
              @change="(v: string | number | boolean) => emit('startMinimizedToTrayChange', Boolean(v))"
            />
          </div>
        </div>
        </el-scrollbar>
      </el-tab-pane>

      <el-tab-pane label="编码" name="ffmpeg" lazy>
        <el-scrollbar class="settings-scroll">
        <div class="setting-pane">
          <div class="section-label">引擎</div>
          <div class="setting-row setting-row-meta">
            <div class="setting-meta">
              <strong>FFmpeg 状态</strong>
              <span>{{ ffmpegStatus?.ffmpegPath || '内置自动探测' }}</span>
            </div>
            <el-tag
              :type="ffmpegStatus?.ready ? 'success' : 'danger'"
              effect="plain"
              size="small"
            >
              {{ ffmpegStatus?.ready ? '就绪' : '未就绪' }}
            </el-tag>
          </div>
          <div
            v-if="ffmpegStatus && !ffmpegStatus.ready && ffmpegStatus.error"
            class="setting-error-block"
          >
            {{ ffmpegStatus.error }}
          </div>
          <div class="setting-field">
            <label>自定义 bin 目录</label>
            <div class="path-row">
              <el-input
                :model-value="ffmpegBinDir"
                class="bin-dir-input"
                placeholder="留空=自动探测（ffmpeg-static）"
                readonly
                size="small"
              />
              <el-button :icon="Folder" size="small" @click="emit('browseFfmpegDir')">
                浏览
              </el-button>
            </div>
          </div>
          <div class="setting-row actions">
            <el-button size="small" @click="emit('clearFfmpegBinDir')">
              重置自动
            </el-button>
            <el-button size="small" @click="emit('reDetectFfmpeg')">
              重新检测
            </el-button>
          </div>

          <div class="section-label">图片</div>
          <div class="setting-field">
            <label>图片引擎</label>
            <el-select
              :model-value="imageEngine"
              size="small"
              class="control-full"
              @change="(v: ImageEngineId) => emit('imageEngineChange', v)"
            >
              <el-option
                v-for="opt in IMAGE_ENGINE_OPTIONS"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </div>
          <div class="setting-row setting-row-meta">
            <div class="setting-meta">
              <strong>Sharp</strong>
              <span>内置图片处理</span>
            </div>
            <el-tag
              :type="imageStatus?.sharpReady ? 'success' : 'danger'"
              effect="plain"
              size="small"
            >
              {{ imageStatus?.sharpReady ? '就绪' : '未就绪' }}
            </el-tag>
          </div>
          <div class="setting-row setting-row-meta">
            <div class="setting-meta">
              <strong>ImageMagick</strong>
              <span>{{ imageStatus?.magickPath || 'PATH 自动探测' }}</span>
            </div>
            <el-tag
              :type="imageStatus?.magickReady ? 'success' : 'info'"
              effect="plain"
              size="small"
            >
              {{ imageStatus?.magickReady ? '可用' : '未检测到' }}
            </el-tag>
          </div>
          <div v-if="imageStatus?.error" class="setting-error-block">
            {{ imageStatus.error }}
          </div>
          <div class="setting-field">
            <label>Magick 路径</label>
            <div class="path-row">
              <el-input
                :model-value="imagemagickPath"
                class="bin-dir-input"
                placeholder="留空=自动探测 PATH 中的 magick"
                readonly
                size="small"
              />
              <el-button :icon="Folder" size="small" @click="emit('browseMagickPath')">
                浏览
              </el-button>
            </div>
          </div>
          <div class="setting-row actions">
            <el-button size="small" @click="emit('clearMagickPath')">
              清除
            </el-button>
            <el-button size="small" @click="emit('reDetectImage')">
              重新检测
            </el-button>
            <el-button size="small" type="primary" plain @click="emit('testImageEngine')">
              测试引擎
            </el-button>
          </div>
          <p class="setting-hint">可指定 magick.exe 全路径，或含 magick 的安装目录</p>
        </div>
        </el-scrollbar>
      </el-tab-pane>

      <el-tab-pane label="远程访问" name="lan" lazy>
        <el-scrollbar class="settings-scroll">
        <div class="setting-pane">
          <div class="section-label">服务</div>
          <p class="setting-hint lan-intro">
            开启后可在浏览器访问本机服务。请设置至少
            {{ LAN_PASSWORD_MIN_LENGTH }} 位强密码，并仅在受信网络使用。
          </p>
          <div class="setting-row setting-row-meta">
            <div class="setting-meta">
              <strong>允许远程访问</strong>
              <span>共享本机处理能力</span>
            </div>
            <el-switch
              :model-value="lanEnabled"
              :disabled="lanSaving"
              size="small"
              @change="onLanToggle"
            />
          </div>
          <div class="setting-row setting-row-meta">
            <div class="setting-meta">
              <strong>服务状态</strong>
              <span v-if="lanStatus?.running">
                {{ lanStatus.bindHost }}:{{ lanStatus.port }}
              </span>
              <span v-else>未对外提供服务</span>
            </div>
            <el-tag
              :type="lanStatus?.running ? 'success' : lanStatus?.error ? 'danger' : 'info'"
              effect="plain"
              size="small"
            >
              {{
                lanStatus?.running
                  ? '运行中'
                  : lanStatus?.enabled
                    ? lanStatus?.error || '未运行'
                    : '已关闭'
              }}
            </el-tag>
          </div>
          <div v-if="lanStatus?.error" class="setting-error-block">
            {{ lanStatus.error }}
          </div>
          <div class="setting-field">
            <label>服务端口</label>
            <el-input-number
              v-model="lanPort"
              :min="1024"
              :max="65535"
              :step="1"
              size="small"
              controls-position="right"
              class="w-port"
            />
          </div>
          <div class="setting-field">
            <label>绑定网卡</label>
            <el-radio-group v-model="lanBindHost" size="small">
              <el-radio-button value="127.0.0.1">仅本机（推荐）</el-radio-button>
              <el-radio-button value="0.0.0.0">局域网</el-radio-button>
            </el-radio-group>
            <p class="setting-hint lan-bind-hint">
              「仅本机」适合本机调试；「局域网」同网段可访问，登录需配对码。
            </p>
          </div>
          <div
            v-if="lanBindHost === '0.0.0.0'"
            class="setting-warn-block"
            role="note"
          >
            <strong>安全提示</strong>
            同网段设备均可尝试访问，通信为 HTTP 明文。请使用强密码并核对配对码；勿在公共 Wi‑Fi 开启。
          </div>

          <div class="section-label">安全</div>
          <div
            v-if="lanStatus?.pairCodeRequired"
            class="setting-field lan-pair-block"
          >
            <label>登录配对码</label>
            <div class="lan-pair-row">
              <code class="lan-pair-code">{{ lanStatus?.pairCode || '—' }}</code>
              <el-button
                size="small"
                :disabled="!lanStatus?.pairCode"
                @click="copyPairCode"
              >
                复制
              </el-button>
              <el-button
                size="small"
                :loading="lanPairRefreshing"
                :disabled="!lanStatus?.running"
                @click="onRefreshPairCode"
              >
                刷新
              </el-button>
            </div>
            <p class="setting-hint">
              其他设备登录时需填写（约 10 分钟有效）。
              <template v-if="lanStatus?.pairCodeExpiresAt">
                过期：{{ formatPairExpires(lanStatus.pairCodeExpiresAt) }}
              </template>
              <template v-else-if="!lanStatus?.running">
                服务未运行时无有效配对码。
              </template>
            </p>
          </div>
          <div class="setting-field">
            <label>用户名</label>
            <el-input
              v-model="lanUsername"
              size="small"
              class="control-full"
              maxlength="64"
              placeholder="admin"
            />
          </div>
          <div class="setting-field">
            <label>
              新密码
              <span class="setting-field-extra">
                {{ lanStatus?.hasPassword ? '已设置' : '未设置' }}
              </span>
            </label>
            <el-input
              v-model="lanPassword"
              type="password"
              size="small"
              class="control-full"
              show-password
              :placeholder="
                lanStatus?.hasPassword
                  ? '留空则不修改'
                  : `首次开启必填，至少 ${LAN_PASSWORD_MIN_LENGTH} 位`
              "
              autocomplete="new-password"
            />
          </div>
          <div class="setting-field">
            <label>确认密码</label>
            <el-input
              v-model="lanPassword2"
              type="password"
              size="small"
              class="control-full"
              show-password
              placeholder="再次输入新密码"
              autocomplete="new-password"
            />
          </div>
          <div class="setting-row actions">
            <el-button
              size="small"
              type="primary"
              :loading="lanSaving"
              @click="onSaveLan"
            >
              保存远程设置
            </el-button>
            <el-button size="small" :disabled="lanSaving" @click="emit('refreshLanStatus')">
              刷新状态
            </el-button>
          </div>

          <template v-if="lanStatus?.urls?.length">
            <div class="section-label">访问</div>
            <div class="lan-urls">
              <el-tooltip
                v-for="url in lanStatus.urls"
                :key="url"
                :content="'点击复制 ' + url"
                :show-after="400"
                placement="top"
              >
                <button
                  class="path-copy-btn lan-url-btn"
                  type="button"
                  @click="copyLanUrl(url)"
                >
                  {{ url }}
                </button>
              </el-tooltip>
            </div>
            <p class="setting-hint">
              HTTP 明文传输；关闭远程或改密将清除会话。
            </p>
          </template>
        </div>
        </el-scrollbar>
      </el-tab-pane>

      <el-tab-pane label="数据" name="data" lazy>
        <el-scrollbar class="settings-scroll">
        <div class="setting-pane">
          <div class="section-label">存储</div>
          <div class="setting-field">
            <label>数据目录</label>
            <el-tooltip
              :content="appInfo?.userDataPath ? `点击复制\n${appInfo.userDataPath}` : ''"
              placement="top"
              :show-after="400"
              :disabled="!appInfo?.userDataPath"
              popper-class="tooltip-pre-line"
            >
              <button
                :disabled="!appInfo?.userDataPath"
                class="path-copy-btn path-block"
                type="button"
                @click="copyUserDataPath"
                @keydown="onPathKeydown"
              >
                {{ appInfo?.userDataPath || '—' }}
              </button>
            </el-tooltip>
          </div>
          <div class="setting-row actions">
            <el-button size="small" @click="emit('openAppData')">打开数据目录</el-button>
            <el-button size="small" @click="emit('changeDataDir')">修改数据目录…</el-button>
          </div>
          <p class="setting-hint">
            修改时会迁移设置与任务列表（不覆盖已有文件；缓存不迁移；原目录保留）。
          </p>
          <div class="section-label">危险操作</div>
          <div class="setting-row actions">
            <el-button size="small" plain type="danger" @click="confirmClearTasks">
              清空已持久化任务
            </el-button>
            <el-button size="small" type="danger" @click="confirmReset">
              重置全部设置
            </el-button>
          </div>
        </div>
        </el-scrollbar>
      </el-tab-pane>

      <el-tab-pane label="关于" name="about" lazy>
        <el-scrollbar class="settings-scroll">
        <div class="setting-pane">
          <div class="section-label">应用</div>
          <div class="setting-row setting-row-meta">
            <div class="setting-meta">
              <strong>{{ PRODUCT_NAME }}</strong>
              <span>{{ PRODUCT_TAGLINE }}</span>
            </div>
          </div>
          <div class="setting-row setting-row-meta">
            <div class="setting-meta">
              <strong>版本</strong>
              <span class="num">v{{ appVersion }}</span>
            </div>
            <el-tag :type="isPackaged ? 'success' : 'info'" effect="plain" size="small">
              {{ isPackaged ? '已打包' : '开发态' }}
            </el-tag>
          </div>
          <div class="setting-row setting-row-meta">
            <div class="setting-meta">
              <strong>运行时</strong>
              <span class="num">
                Electron {{ appInfo?.electron ?? '—' }} · Chrome {{ appInfo?.chrome ?? '—' }} · Node
                {{ appInfo?.node ?? '—' }}
              </span>
            </div>
          </div>
          <div class="setting-row actions">
            <el-button
              :loading="updateChecking"
              size="small"
              type="primary"
              @click="emit('checkUpdate')"
            >
              检查更新
            </el-button>
          </div>
        </div>
        </el-scrollbar>
      </el-tab-pane>
    </el-tabs>

    <div class="settings-foot">
      <span class="settings-foot-hint">修改会自动保存</span>
      <el-button size="small" @click="confirmReset">恢复默认</el-button>
      <el-button size="small" type="primary" @click="emit('update:visible', false)">
        完成
      </el-button>
    </div>
  </el-drawer>
</template>

<style scoped>
.dlg-head-text {
  min-width: 0;
  padding-right: 8px;
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

.settings-tabs {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.settings-tabs :deep(.el-tabs__header) {
  margin: 0 0 12px;
  flex-shrink: 0;
}

.settings-tabs :deep(.el-tabs__nav-wrap::after) {
  height: 0;
  background: none;
}

.settings-tabs :deep(.el-tabs__nav-wrap) {
  box-shadow: inset 0 -1px 0 0 var(--panel-border);
}

.settings-tabs :deep(.el-tabs__item) {
  font-size: 13px;
  height: 32px;
  line-height: 32px;
  padding: 0 12px;
  color: var(--app-fg-secondary);
}

.settings-tabs :deep(.el-tabs__item.is-active) {
  color: var(--accent);
  font-weight: 600;
}

.settings-tabs :deep(.el-tabs__active-bar) {
  background-color: var(--accent);
}

.settings-tabs :deep(.el-tabs__content) {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.settings-tabs :deep(.el-tab-pane) {
  height: 100%;
}

.settings-scroll {
  height: 100%;
}

.settings-scroll :deep(.el-scrollbar__view) {
  /* 给浮动滚动条留出槽位，避免盖住控件与文案 */
  padding-right: 16px;
  box-sizing: border-box;
}

.setting-pane {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding-bottom: 12px;
}

.section-label {
  margin: 20px 0 10px;
  font-size: 11px;
  font-weight: 600;
  font-family: var(--font-mono);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted);
}

.section-label:first-child {
  margin-top: 0;
}

.setting-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  min-height: 28px;
}

.setting-row-meta {
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
  flex-wrap: nowrap;
  gap: 12px;
}

.setting-row-meta:last-child {
  border-bottom: 0;
}

.setting-row-meta + .section-label,
.setting-field + .section-label,
.setting-row.actions + .section-label,
.setting-hint + .section-label {
  margin-top: 22px;
}

.setting-meta {
  flex: 1;
  min-width: 0;
}

.setting-meta strong {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--fg);
}

.setting-meta span {
  display: block;
  margin-top: 2px;
  font-size: 12px;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.theme-seg {
  display: flex;
  flex: none;
  width: 180px;
  padding: 2px;
  gap: 2px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}

.theme-seg button {
  flex: 1;
  height: 26px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--muted);
  font-size: 12px;
  cursor: pointer;
}

.theme-seg button[aria-pressed='true'] {
  background: var(--surface);
  color: var(--fg);
  box-shadow: 0 0 0 1px var(--border);
}

.theme-seg button:hover {
  color: var(--fg);
}

.theme-seg button:focus-visible {
  outline: 2px solid var(--accent-soft);
}

.setting-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 14px;
}

.setting-field label {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
  color: var(--muted);
}

.setting-field-extra {
  flex: none;
  font-size: 11px;
  color: var(--muted);
  opacity: 0.85;
}

.path-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  align-items: center;
}

.control-full,
.bin-dir-input {
  width: 100%;
  min-width: 0;
}

.path-copy-btn {
  margin: 0;
  padding: 2px 4px;
  border: none;
  border-radius: var(--radius-xs);
  background: transparent;
  text-align: left;
  font: inherit;
  cursor: pointer;
  color: var(--app-fg);
}

.path-copy-btn:hover:not(:disabled) {
  color: var(--accent);
}

.path-copy-btn:focus-visible {
  outline: 2px solid var(--accent-soft);
  outline-offset: 1px;
}

.path-copy-btn:disabled {
  cursor: default;
  opacity: 0.7;
}

.path-block {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg);
  font-family: var(--font-mono);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.setting-hint {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.5;
  word-break: break-word;
}

.setting-error-block {
  margin: 0 0 12px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid color-mix(in oklch, var(--danger) 35%, var(--border));
  background: var(--danger-soft);
  font-size: 12px;
  color: var(--danger);
  line-height: 1.5;
  word-break: break-word;
}

.setting-warn-block {
  margin: 0 0 10px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid color-mix(in oklch, var(--warning, #e6a23c) 40%, var(--border));
  background: color-mix(in oklch, var(--warning, #e6a23c) 12%, var(--bg));
  font-size: 12px;
  color: var(--text);
  line-height: 1.5;
  word-break: break-word;
}

.setting-warn-block strong {
  display: block;
  margin-bottom: 2px;
  color: var(--warning, #e6a23c);
}

.lan-bind-hint {
  margin: 6px 0 0;
}

.lan-pair-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.lan-pair-code {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0.12em;
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-soft, var(--bg));
  user-select: all;
}

.setting-row.actions {
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px 0 4px;
}

.setting-row-meta + .setting-row.actions,
.setting-field + .setting-row.actions {
  margin-top: 2px;
}

.lan-intro {
  margin: 0 0 12px;
}

.w-port {
  width: 140px;
}

.lan-urls {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
}

.lan-url-btn {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg);
  font-family: var(--font-mono);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.num {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.settings-foot {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
  padding: 12px 0 0;
  border-top: 1px solid var(--border);
}

.settings-foot-hint {
  margin-right: auto;
  font-size: 12px;
  color: var(--muted);
}
</style>
