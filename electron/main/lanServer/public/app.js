/* 轻影局域网远程页 */
;(function () {
  const $ = (id) => document.getElementById(id)

  const viewLogin = $('view-login')
  const viewMain = $('view-main')
  const loginForm = $('login-form')
  const loginError = $('login-error')
  const loginBtn = $('login-btn')
  const whoami = $('whoami')
  const uploadForm = $('upload-form')
  const uploadError = $('upload-error')
  const uploadHint = $('upload-hint')
  const uploadBtn = $('upload-btn')
  const uploadProgress = $('upload-progress')
  const uploadProgressInner = $('upload-progress-inner')
  const fileInput = $('file-input')
  const fileName = $('file-name')
  const dropzone = $('dropzone')
  const taskBody = $('task-body')
  const optMode = $('opt-mode')
  const optPreset = $('opt-preset')
  const optImagePreset = $('opt-image-preset')
  const wrapPreset = $('wrap-preset')
  const wrapImagePreset = $('wrap-image-preset')
  const wrapFormat = $('wrap-format')
  const wrapMaxedge = $('wrap-maxedge')
  const wrapAformat = $('wrap-aformat')
  const wrapAbitrate = $('wrap-abitrate')
  const wrapIformat = $('wrap-iformat')
  const wrapIquality = $('wrap-iquality')
  const wrapImaxedge = $('wrap-imaxedge')
  const wrapIstrip = $('wrap-istrip')
  const customOpts = $('custom-opts')
  const presetHint = $('preset-hint')
  const fileHint = $('file-hint')
  const optCrf = $('opt-crf')
  const optTarget = $('opt-target')
  const optMaxedge = $('opt-maxedge')
  const optFormat = $('opt-format')
  const optIformat = $('opt-iformat')
  const optIquality = $('opt-iquality')
  const optImaxedge = $('opt-imaxedge')
  const optIstrip = $('opt-istrip')

  /** 视频预设默认值（与 shared DEFAULT_PRESETS 对齐） */
  const PRESET_DEFAULTS = {
    archive: { crf: 18, maxEdge: 0, format: 'mp4', label: 'CRF 18 · 原分辨率 · 画质优先' },
    standard: { crf: 23, maxEdge: 0, format: 'mp4', label: 'CRF 23 · 原分辨率 · 均衡' },
    social: { crf: 28, maxEdge: 1280, format: 'mp4', label: 'CRF 28 · 最长边 1280 · 更小体积' },
    custom: { crf: 23, maxEdge: 0, format: 'mp4', label: '手动设置 CRF、分辨率与格式' }
  }

  /** 图片预设默认值（与 shared DEFAULT_IMAGE_PRESETS 对齐） */
  const IMAGE_PRESET_DEFAULTS = {
    optimize: { maxEdge: 0, quality: 85, format: 'keep', label: '保持原格式 · 质量 85 · 不缩放' },
    standard: { maxEdge: 1920, quality: 80, format: 'jpeg', label: 'JPEG · 质量 80 · 最长边 1920' },
    social: { maxEdge: 1280, quality: 75, format: 'jpeg', label: 'JPEG · 质量 75 · 最长边 1280' },
    thumb: { maxEdge: 400, quality: 70, format: 'jpeg', label: 'JPEG · 质量 70 · 最长边 400' },
    custom: { maxEdge: 1920, quality: 80, format: 'jpeg', label: '手动设置格式、质量与最长边' }
  }

  const ACCEPT_BY_MODE = {
    compress: 'video/*,.mp4,.mkv,.mov,.avi,.webm,.flv,.m4v,.ts,.mts,.m2ts,.3gp',
    audio: 'video/*,audio/*,.mp4,.mkv,.mov,.avi,.webm,.mp3,.m4a,.aac,.wav,.flac,.ogg,.opus,.wma',
    image: 'image/*,.jpg,.jpeg,.png,.webp,.bmp,.gif,.tif,.tiff'
  }

  const FILE_PLACEHOLDER = '点击或拖拽文件到此处'
  const THEME_KEY = 'qy-lan-theme'
  const CRED_KEY = 'qy-lan-creds'
  /** SSE 未连接时的轮询间隔 */
  const POLL_FALLBACK_MS = 2000
  /** SSE 已连接时的慢速校正间隔 */
  const POLL_SSE_MS = 12000
  let pollTimer = null
  let taskEvents = null
  let sseConnected = false
  let authenticated = false
  let loadTasksFailStreak = 0
  /** 最近一次完整任务列表（供局部更新后刷新统计） */
  let lastTasks = []

  function readStoredTheme() {
    try {
      const t = localStorage.getItem(THEME_KEY)
      return t === 'light' || t === 'dark' ? t : 'dark'
    } catch {
      return 'dark'
    }
  }

  function readStoredCreds() {
    try {
      const raw = localStorage.getItem(CRED_KEY)
      if (!raw) return null
      const obj = JSON.parse(raw)
      if (!obj || typeof obj !== 'object') return null
      const username = typeof obj.u === 'string' ? obj.u : ''
      const password = typeof obj.p === 'string' ? obj.p : ''
      if (!username && !password) return null
      return { username, password }
    } catch {
      return null
    }
  }

  function saveStoredCreds(username, password) {
    try {
      localStorage.setItem(
        CRED_KEY,
        JSON.stringify({ u: String(username || ''), p: String(password || '') })
      )
    } catch {
      /* ignore quota / private mode */
    }
  }

  function clearStoredCreds() {
    try {
      localStorage.removeItem(CRED_KEY)
    } catch {
      /* ignore */
    }
  }

  function fillLoginFromStoredCreds() {
    const creds = readStoredCreds()
    const userEl = $('login-user')
    const passEl = $('login-pass')
    const rememberEl = $('login-remember')
    if (!userEl || !passEl) return
    if (creds) {
      userEl.value = creds.username
      passEl.value = creds.password
      if (rememberEl) rememberEl.checked = true
    } else if (rememberEl) {
      rememberEl.checked = false
    }
  }

  function applyTheme(theme) {
    const next = theme === 'light' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    try {
      localStorage.setItem(THEME_KEY, next)
    } catch {
      /* ignore */
    }
    const btn = $('btn-theme')
    if (btn) {
      const tip = next === 'dark' ? '切换到浅色' : '切换到深色'
      btn.setAttribute('aria-label', next === 'dark' ? '切换浅色主题' : '切换深色主题')
      btn.setAttribute('data-tip', tip)
      btn.removeAttribute('title')
    }
  }

  /** 自定义 tip：用 data-tip，避免原生 title */
  const tipEl = document.createElement('div')
  tipEl.className = 'qy-tip'
  tipEl.setAttribute('role', 'tooltip')
  tipEl.hidden = true
  document.body.appendChild(tipEl)
  let tipAnchor = null
  let tipShowTimer = null
  let tipHideTimer = null

  function hideTip(immediate) {
    if (tipShowTimer) {
      clearTimeout(tipShowTimer)
      tipShowTimer = null
    }
    const doHide = () => {
      tipEl.classList.remove('is-visible')
      tipEl.hidden = true
      tipEl.textContent = ''
      tipAnchor = null
      tipHideTimer = null
    }
    if (immediate) {
      if (tipHideTimer) {
        clearTimeout(tipHideTimer)
        tipHideTimer = null
      }
      doHide()
      return
    }
    if (tipHideTimer) return
    tipHideTimer = setTimeout(doHide, 80)
  }

  function positionTip(anchor) {
    if (!anchor || tipEl.hidden) return
    const rect = anchor.getBoundingClientRect()
    const gap = 8
    const pad = 12
    tipEl.style.left = '0px'
    tipEl.style.top = '0px'
    const tw = tipEl.offsetWidth
    const th = tipEl.offsetHeight
    let left = rect.left + rect.width / 2 - tw / 2
    let top = rect.top - th - gap
    if (top < pad) top = rect.bottom + gap
    left = Math.min(Math.max(pad, left), window.innerWidth - tw - pad)
    top = Math.min(Math.max(pad, top), window.innerHeight - th - pad)
    tipEl.style.left = Math.round(left) + 'px'
    tipEl.style.top = Math.round(top) + 'px'
  }

  function showTipFor(anchor) {
    if (!anchor) return
    const text = (anchor.getAttribute('data-tip') || '').trim()
    if (!text) return
    if (tipHideTimer) {
      clearTimeout(tipHideTimer)
      tipHideTimer = null
    }
    tipAnchor = anchor
    tipEl.textContent = text
    tipEl.hidden = false
    positionTip(anchor)
    requestAnimationFrame(() => {
      if (tipAnchor === anchor) tipEl.classList.add('is-visible')
    })
  }

  function scheduleTip(anchor) {
    if (tipShowTimer) clearTimeout(tipShowTimer)
    tipShowTimer = setTimeout(() => {
      tipShowTimer = null
      showTipFor(anchor)
    }, 280)
  }

  function findTipTarget(node) {
    if (!node || !node.closest) return null
    return node.closest('[data-tip]')
  }

  document.addEventListener(
    'pointerover',
    (e) => {
      const target = findTipTarget(e.target)
      if (!target) return
      if (tipAnchor === target && !tipEl.hidden) {
        positionTip(target)
        return
      }
      scheduleTip(target)
    },
    true
  )

  document.addEventListener(
    'pointerout',
    (e) => {
      const from = findTipTarget(e.target)
      if (!from) return
      const to = findTipTarget(e.relatedTarget)
      if (to === from) return
      if (tipShowTimer) {
        clearTimeout(tipShowTimer)
        tipShowTimer = null
      }
      if (tipAnchor === from) hideTip(false)
    },
    true
  )

  document.addEventListener(
    'focusin',
    (e) => {
      const target = findTipTarget(e.target)
      if (target) showTipFor(target)
    },
    true
  )

  document.addEventListener(
    'focusout',
    (e) => {
      const from = findTipTarget(e.target)
      if (!from) return
      const to = findTipTarget(e.relatedTarget)
      if (to === from) return
      if (tipAnchor === from) hideTip(false)
    },
    true
  )

  window.addEventListener(
    'scroll',
    () => {
      if (tipAnchor && !tipEl.hidden) positionTip(tipAnchor)
      else hideTip(true)
    },
    true
  )

  window.addEventListener('resize', () => hideTip(true))
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideTip(true)
  })

  function toggleTheme() {
    const cur = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'
    applyTheme(cur === 'dark' ? 'light' : 'dark')
  }

  applyTheme(readStoredTheme())
  const btnTheme = $('btn-theme')
  if (btnTheme) btnTheme.addEventListener('click', toggleTheme)

  function updateStats(tasks) {
    const list = tasks || []
    const total = list.length
    let active = 0
    let done = 0
    let fail = 0
    for (const t of list) {
      if (t.status === 'running' || t.status === 'queued' || t.status === 'pending') active++
      else if (t.status === 'completed') done++
      else if (t.status === 'failed') fail++
    }
    const set = (id, n) => {
      const el = $(id)
      if (el) el.textContent = String(n)
    }
    set('stat-total', total)
    set('stat-active', active)
    set('stat-done', done)
    set('stat-fail', fail)
  }

  function closeTaskEvents() {
    if (taskEvents) {
      try {
        taskEvents.close()
      } catch {
        /* ignore */
      }
      taskEvents = null
    }
    sseConnected = false
  }

  function scheduleTaskPoll() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
    if (!authenticated) return
    const ms = sseConnected ? POLL_SSE_MS : POLL_FALLBACK_MS
    pollTimer = setInterval(() => {
      void loadTasks()
    }, ms)
  }

  function showLogin() {
    authenticated = false
    viewLogin.hidden = false
    viewMain.hidden = true
    closeTaskEvents()
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
    fillLoginFromStoredCreds()
  }

  function setWhoami(username) {
    const name = username ? String(username) : '已登录'
    const avatar = $('whoami-avatar')
    const nameEl = $('whoami-name')
    if (nameEl) nameEl.textContent = name
    if (avatar) {
      const ch = username ? String(username).trim().charAt(0) : '管'
      avatar.textContent = ch || '管'
    }
    if (whoami) {
      const tip = username ? `已登录：${username}` : '已登录'
      whoami.setAttribute('data-tip', tip)
      whoami.removeAttribute('title')
      if (!nameEl && !avatar) whoami.textContent = name
    }
  }

  function syncModeOptionSelection() {
    const mode = optMode ? optMode.value : 'compress'
    document.querySelectorAll('.mode-option').forEach((el) => {
      const input = el.querySelector('input[name="process-mode"]')
      const on = Boolean(input && input.value === mode)
      el.classList.toggle('is-selected', on)
      if (input) input.checked = on
    })
  }

  function setCollapseOpen(el, open) {
    if (!el) return
    const shouldOpen = Boolean(open)
    el.classList.toggle('is-open', shouldOpen)
    el.setAttribute('aria-hidden', shouldOpen ? 'false' : 'true')
    el.querySelectorAll('input, select, textarea, button').forEach((node) => {
      if (shouldOpen) node.removeAttribute('tabindex')
      else node.setAttribute('tabindex', '-1')
    })
  }

  function showMain(username) {
    authenticated = true
    viewLogin.hidden = true
    viewMain.hidden = false
    setWhoami(username)
    syncModeUi()
    void loadTasks()
    openTaskEvents()
    scheduleTaskPoll()
  }

  function setFileLabel(file) {
    if (file) {
      fileName.textContent = file.name
      fileName.setAttribute('data-tip', file.name)
      fileName.removeAttribute('title')
      dropzone.classList.add('has-file')
    } else {
      fileName.textContent = FILE_PLACEHOLDER
      fileName.removeAttribute('data-tip')
      fileName.removeAttribute('title')
      dropzone.classList.remove('has-file')
    }
  }

  function syncModeUi() {
    const mode = optMode.value
    const audio = mode === 'audio'
    const image = mode === 'image'
    const video = !audio && !image
    const custom = optPreset.value === 'custom'
    const imageCustom = optImagePreset && optImagePreset.value === 'custom'
    syncModeOptionSelection()

    if (wrapPreset) wrapPreset.hidden = image
    if (wrapImagePreset) wrapImagePreset.hidden = !image
    wrapFormat.hidden = !video
    wrapMaxedge.hidden = !video
    wrapAformat.hidden = !audio
    wrapAbitrate.hidden = !audio
    if (wrapIformat) wrapIformat.hidden = false
    if (wrapIquality) wrapIquality.hidden = false
    if (wrapImaxedge) wrapImaxedge.hidden = false
    if (wrapIstrip) wrapIstrip.hidden = false

    setCollapseOpen(customOpts, video && custom)
    setCollapseOpen($('image-custom-opts'), image && imageCustom)

    if (fileInput) {
      fileInput.accept = ACCEPT_BY_MODE[mode] || ACCEPT_BY_MODE.compress
    }
    if (fileHint) {
      fileHint.textContent = image
        ? '图片 · 单文件'
        : audio
          ? '视频 / 音频 · 单文件'
          : '视频 · 单文件'
    }

    if (presetHint) {
      if (image) {
        const idef =
          IMAGE_PRESET_DEFAULTS[optImagePreset ? optImagePreset.value : 'standard'] ||
          IMAGE_PRESET_DEFAULTS.standard
        presetHint.textContent = imageCustom
          ? idef.label + ' · 下方可改格式 / 质量 / 最长边'
          : idef.label
      } else if (audio) {
        presetHint.textContent = '音频模式仅抽取音轨，忽略视频预设画质参数'
      } else {
        const def = PRESET_DEFAULTS[optPreset.value] || PRESET_DEFAULTS.standard
        presetHint.textContent = custom
          ? def.label + ' · 下方可改 CRF / 目标体积'
          : def.label
      }
    }
  }

  /** 切换视频预设时填入默认 CRF / 最长边 / 格式 */
  function applyPresetDefaults() {
    const def = PRESET_DEFAULTS[optPreset.value] || PRESET_DEFAULTS.standard
    if (optCrf) optCrf.value = String(def.crf)
    if (optMaxedge) optMaxedge.value = String(def.maxEdge)
    if (optFormat && def.format) optFormat.value = def.format
    if (optTarget && optPreset.value !== 'custom') optTarget.value = '0'
    syncModeUi()
  }

  /** 切换图片预设时填入默认格式 / 质量 / 最长边 */
  function applyImagePresetDefaults() {
    const id = optImagePreset ? optImagePreset.value : 'standard'
    const def = IMAGE_PRESET_DEFAULTS[id] || IMAGE_PRESET_DEFAULTS.standard
    if (optIformat && def.format) optIformat.value = def.format
    if (optIquality) optIquality.value = String(def.quality)
    if (optImaxedge) optImaxedge.value = String(def.maxEdge)
    syncModeUi()
  }

  async function api(path, options) {
    const res = await fetch(path, {
      credentials: 'same-origin',
      ...options
    })
    const ct = res.headers.get('content-type') || ''
    let data = null
    if (ct.includes('application/json')) {
      data = await res.json()
    }
    return { res, data }
  }

  function syncPairCodeField(required) {
    const wrap = $('login-pair-wrap')
    const input = $('login-pair')
    if (!wrap || !input) return
    wrap.hidden = !required
    input.required = Boolean(required)
    if (!required) input.value = ''
  }

  async function checkStatus() {
    try {
      const { data } = await api('/api/status')
      if (data && data.ok) {
        if (data.maxUploadMb) {
          uploadHint.textContent = `单文件上限约 ${data.maxUploadMb} MB；编码器与输出目录使用本机设置`
        }
        syncPairCodeField(Boolean(data.pairCodeRequired))
        if (data.authenticated) {
          showMain(data.username)
        } else {
          showLogin()
        }
      }
    } catch {
      showLogin()
    }
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    loginError.hidden = true
    loginBtn.disabled = true
    try {
      const username = $('login-user').value.trim()
      const password = $('login-pass').value
      const pairWrap = $('login-pair-wrap')
      const pairInput = $('login-pair')
      const needPair = pairWrap && !pairWrap.hidden
      const body = { username, password }
      if (needPair) {
        body.pairCode = pairInput ? pairInput.value.trim() : ''
      }
      const { res, data } = await api('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      if (!res.ok || !data || !data.ok) {
        loginError.textContent =
          (data && data.error) || `登录失败 (${res.status})`
        loginError.hidden = false
        if (data && data.pairCodeRequired) syncPairCodeField(true)
        return
      }
      const rememberEl = $('login-remember')
      if (rememberEl && rememberEl.checked) saveStoredCreds(username, password)
      else clearStoredCreds()
      if (!(rememberEl && rememberEl.checked)) {
        $('login-pass').value = ''
      }
      if (pairInput) pairInput.value = ''
      showMain(data.username || username)
    } catch (err) {
      loginError.textContent = err.message || '网络错误'
      loginError.hidden = false
    } finally {
      loginBtn.disabled = false
    }
  })

  $('btn-logout').addEventListener('click', async () => {
    try {
      await api('/api/logout', { method: 'POST' })
    } catch {
      // ignore
    }
    showLogin()
  })

  window.addEventListener('pagehide', () => {
    closeTaskEvents()
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  })

  optMode.addEventListener('change', () => {
    if (optMode.value === 'image') applyImagePresetDefaults()
    else syncModeUi()
  })

  document.querySelectorAll('input[name="process-mode"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      if (!radio.checked || !optMode) return
      optMode.value = radio.value
      optMode.dispatchEvent(new Event('change', { bubbles: true }))
    })
  })
  optPreset.addEventListener('change', applyPresetDefaults)
  if (optImagePreset) {
    optImagePreset.addEventListener('change', applyImagePresetDefaults)
  }

  fileInput.addEventListener('change', () => {
    const f = fileInput.files && fileInput.files[0]
    setFileLabel(f || null)
  })

  ;['dragenter', 'dragover'].forEach((ev) => {
    dropzone.addEventListener(ev, (e) => {
      e.preventDefault()
      e.stopPropagation()
      dropzone.classList.add('is-dragover')
    })
  })
  ;['dragleave', 'drop'].forEach((ev) => {
    dropzone.addEventListener(ev, (e) => {
      e.preventDefault()
      e.stopPropagation()
      dropzone.classList.remove('is-dragover')
    })
  })
  dropzone.addEventListener('drop', (e) => {
    const files = e.dataTransfer && e.dataTransfer.files
    if (files && files.length) {
      fileInput.files = files
      setFileLabel(files[0])
    }
  })

  function formatSize(bytes) {
    if (bytes == null || !Number.isFinite(bytes)) return '—'
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
  }

  function statusLabel(s) {
    const map = {
      pending: '待处理',
      queued: '排队中',
      running: '进行中',
      completed: '已完成',
      failed: '失败',
      cancelled: '已取消'
    }
    return map[s] || s
  }

  function modeLabel(m) {
    const map = {
      compress: '视频',
      audio: '音频',
      image: '图片'
    }
    return map[m] || ''
  }

  function modeClass(m) {
    if (m === 'audio') return 'is-audio'
    if (m === 'image') return 'is-image'
    if (m === 'compress') return 'is-video'
    return ''
  }

  function progressValue(t) {
    if (t.status === 'completed') return 100
    if (typeof t.progress === 'number' && Number.isFinite(t.progress)) {
      return Math.max(0, Math.min(100, t.progress))
    }
    if (t.status === 'queued' || t.status === 'pending') return 0
    return null
  }

  function findTaskRow(taskId) {
    if (!taskBody || !taskId) return null
    const id = String(taskId)
    const rows = taskBody.querySelectorAll('tr[data-task-id]')
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].getAttribute('data-task-id') === id) return rows[i]
    }
    return null
  }

  function patchTaskProgress(payload) {
    if (!payload || !payload.id) return
    const id = payload.id
    const row = findTaskRow(id)
    const progress =
      typeof payload.progress === 'number' && Number.isFinite(payload.progress)
        ? Math.max(0, Math.min(100, payload.progress))
        : 0
    const status = payload.status || 'running'

    const idx = lastTasks.findIndex((t) => t.id === id)
    if (idx >= 0) {
      lastTasks[idx] = {
        ...lastTasks[idx],
        status,
        progress,
        time: payload.time != null ? payload.time : lastTasks[idx].time,
        speed: payload.speed != null ? payload.speed : lastTasks[idx].speed,
        etaSec: payload.etaSec != null ? payload.etaSec : lastTasks[idx].etaSec
      }
      updateStats(lastTasks)
    }

    if (!row) {
      void loadTasks()
      return
    }

    const statusEl = row.querySelector('.status')
    if (statusEl) {
      statusEl.className = 'status ' + status
      statusEl.textContent = statusLabel(status)
    }
    const pctText = row.querySelector('.pct-text')
    const pctFill = row.querySelector('.pct-fill')
    if (pctText) pctText.textContent = progress.toFixed(1) + '%'
    if (pctFill) {
      pctFill.style.width = progress + '%'
      pctFill.classList.toggle('is-done', status === 'completed')
      pctFill.classList.toggle('is-fail', status === 'failed')
    }
  }

  function upsertTaskFromView(view) {
    if (!view || !view.id) return
    const idx = lastTasks.findIndex((t) => t.id === view.id)
    if (idx >= 0) lastTasks[idx] = {...lastTasks[idx], ...view}
    else lastTasks = [view, ...lastTasks]
    // 结构性变化（下载/播放/缩略图）用整表重绘更稳妥
    renderTasks(lastTasks)
  }

  function openTaskEvents() {
    closeTaskEvents()
    if (!authenticated || typeof EventSource === 'undefined') {
      scheduleTaskPoll()
      return
    }
    try {
      taskEvents = new EventSource('/api/tasks/events')
    } catch {
      sseConnected = false
      scheduleTaskPoll()
      return
    }

    taskEvents.addEventListener('snapshot', (ev) => {
      try {
        const data = JSON.parse(ev.data || '{}')
        if (data && Array.isArray(data.tasks)) {
          renderTasks(data.tasks)
        }
      } catch {
        /* ignore */
      }
    })

    taskEvents.addEventListener('progress', (ev) => {
      try {
        const data = JSON.parse(ev.data || '{}')
        patchTaskProgress(data)
      } catch {
        /* ignore */
      }
    })

    taskEvents.addEventListener('end', (ev) => {
      try {
        const data = JSON.parse(ev.data || '{}')
        upsertTaskFromView(data)
      } catch {
        void loadTasks()
      }
    })

    taskEvents.addEventListener('queued', (ev) => {
      try {
        const data = JSON.parse(ev.data || '{}')
        upsertTaskFromView(data)
      } catch {
        void loadTasks()
      }
    })

    taskEvents.onopen = () => {
      sseConnected = true
      setTasksPollWarn(false)
      scheduleTaskPoll()
    }

    taskEvents.onerror = () => {
      sseConnected = false
      scheduleTaskPoll()
    }
  }

  function renderTasks(tasks) {
    lastTasks = Array.isArray(tasks) ? tasks.slice() : []
    updateStats(lastTasks)
    if (!tasks || tasks.length === 0) {
      taskBody.innerHTML = `<tr class="empty-row">
        <td colspan="5">
          <div class="empty-state queue-empty">
            <div class="empty-icon" aria-hidden="true">◇</div>
            <p>暂无任务</p>
            <span class="muted">从左侧投递文件后，本机将排队处理并在此显示进度。</span>
          </div>
        </td>
      </tr>`
      return
    }
    taskBody.innerHTML = tasks
      .map((t) => {
        const pv = progressValue(t)
        const pctText =
          pv == null ? '—' : (t.status === 'completed' ? '100%' : pv.toFixed(1) + '%')
        const fillW = pv == null ? 0 : pv
        const size =
          t.status === 'completed' && t.outputSize != null
            ? formatSize(t.outputSize)
            : formatSize(t.inputSize)
        const err =
          t.error && t.status === 'failed'
            ? `<div class="task-file-err">${escapeHtml(t.error)}</div>`
            : ''
        const dl = t.downloadable
          ? `<a class="btn sm ghost" href="/api/tasks/${encodeURIComponent(t.id)}/download">下载</a>`
          : '<span class="muted">—</span>'
        const modeTag = modeLabel(t.mode)
          ? `<span class="mode-tag ${modeClass(t.mode)}">${escapeHtml(modeLabel(t.mode))}</span>`
          : ''
        const fullName = t.fileName || t.id
        const mode = t.mode || 'compress'
        const canPlay = Boolean(t.playable)
        const mimeAttr = t.mediaMime
          ? ` data-preview-mime="${escapeHtml(t.mediaMime)}"`
          : ''
        const dlAttr = t.downloadable ? ' data-preview-downloadable="1"' : ''
        const audioNoteSvg =
          '<svg class="task-thumb-ph__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 18V6.4c0-.4.2-.7.6-.9l8-3c.7-.3 1.4.2 1.4 1V15" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><circle cx="7" cy="18" r="2.5" stroke="currentColor" stroke-width="1.7"/><circle cx="17" cy="15" r="2.5" stroke="currentColor" stroke-width="1.7"/></svg>'
        let thumb = ''
        if (mode === 'audio') {
          if (canPlay) {
            const tip = t.downloadable ? '点击播放音频' : '源文件可预听'
            thumb = `<button type="button" class="task-thumb-btn is-audio" data-preview-id="${escapeHtml(t.id)}" data-preview-name="${escapeHtml(fullName)}" data-preview-kind="audio"${mimeAttr}${dlAttr} data-tip="${tip}" aria-label="${tip}"><span class="task-thumb task-thumb-ph is-audio">${audioNoteSvg}</span></button>`
          } else {
            thumb = `<span class="task-thumb task-thumb-ph is-audio" data-tip="完成后可播放" aria-hidden="true">${audioNoteSvg}</span>`
          }
        } else if (t.hasThumbnail) {
          // 视频未完成仅看抽帧图；完成后才播输出
          const kind = mode === 'image' ? 'image' : canPlay ? 'video' : 'image'
          const tip = kind === 'video' ? '点击播放视频' : '点击查看大图'
          thumb = `<button type="button" class="task-thumb-btn${kind === 'video' ? ' is-playable' : ''}" data-preview-id="${escapeHtml(t.id)}" data-preview-name="${escapeHtml(fullName)}" data-preview-kind="${kind}"${mimeAttr}${dlAttr} data-tip="${tip}" aria-label="${tip}"><img class="task-thumb" src="/api/tasks/${encodeURIComponent(t.id)}/thumbnail" alt="" loading="lazy" onerror="this.closest('.task-thumb-btn').classList.add('is-fail')" /></button>`
        } else {
          thumb = `<span class="task-thumb task-thumb-ph" aria-hidden="true"></span>`
        }
        return `<tr data-task-id="${escapeHtml(t.id)}">
          <td>
            <div class="task-file-row">
              ${thumb}
              <div class="task-file">
                <div class="task-file-name" data-tip="${escapeHtml(fullName)}">${escapeHtml(fullName)}</div>
                ${modeTag}
                ${err}
              </div>
            </div>
          </td>
          <td><span class="status ${escapeHtml(t.status)}">${statusLabel(t.status)}</span></td>
          <td class="pct-cell">
            <div class="pct-wrap">
              <span class="pct-text">${pctText}</span>
              <div class="pct-track"><div class="pct-fill${t.status === 'completed' ? ' is-done' : t.status === 'failed' ? ' is-fail' : ''}" style="width:${fillW}%"></div></div>
            </div>
          </td>
          <td class="size-cell">${size}</td>
          <td class="col-action">${dl}</td>
        </tr>`
      })
      .join('')
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  function setTasksPollWarn(show) {
    const sub = document.querySelector('.card-tasks .card-sub')
    if (!sub) return
    if (!sub.dataset.defaultSub) sub.dataset.defaultSub = sub.textContent || ''
    sub.textContent = show
      ? '刷新失败，将自动重试'
      : sub.dataset.defaultSub
    sub.classList.toggle('is-warn', Boolean(show))
  }

  async function loadTasks() {
    if (!authenticated) return
    try {
      const { res, data } = await api('/api/tasks')
      if (res.status === 401) {
        showLogin()
        return
      }
      if (data && data.ok) {
        loadTasksFailStreak = 0
        setTasksPollWarn(false)
        renderTasks(data.tasks || [])
        return
      }
      loadTasksFailStreak += 1
      if (loadTasksFailStreak >= 3) setTasksPollWarn(true)
    } catch {
      loadTasksFailStreak += 1
      if (loadTasksFailStreak >= 3) setTasksPollWarn(true)
    }
  }

  $('btn-refresh').addEventListener('click', () => {
    void loadTasks()
  })

  uploadForm.addEventListener('submit', (e) => {
    e.preventDefault()
    uploadError.hidden = true
    const file = fileInput.files && fileInput.files[0]
    if (!file) {
      uploadError.textContent = '请选择文件'
      uploadError.hidden = false
      return
    }

    const mode = optMode.value
    let options
    if (mode === 'image') {
      const imagePresetId = optImagePreset ? optImagePreset.value : 'standard'
      options = {
        mode: 'image',
        imagePresetId
      }
      if (imagePresetId === 'custom') {
        options.image = {
          format: optIformat ? optIformat.value : 'jpeg',
          quality: Number(optIquality && optIquality.value) || 80,
          maxEdge: Number(optImaxedge && optImaxedge.value) || 0,
          strip: optIstrip ? Boolean(optIstrip.checked) : true
        }
      }
    } else {
      options = {
        mode,
        presetId: optPreset.value,
        format: optFormat.value,
        maxEdge: Number(optMaxedge.value) || 0,
        audioFormat: $('opt-aformat').value,
        audioBitrate: $('opt-abitrate').value
      }
      if (optPreset.value === 'custom' && mode !== 'audio') {
        options.crf = Number(optCrf.value)
        if (!Number.isFinite(options.crf)) options.crf = 23
        const target = Number(optTarget.value) || 0
        if (target > 0) options.targetSizeMb = target
      }
    }

    const fd = new FormData()
    fd.append('file', file, file.name)
    fd.append('options', JSON.stringify(options))

    uploadBtn.disabled = true
    uploadProgress.hidden = false
    uploadProgressInner.style.width = '0%'

    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/tasks')
    xhr.withCredentials = true

    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) {
        const p = Math.round((ev.loaded / ev.total) * 100)
        uploadProgressInner.style.width = p + '%'
      }
    }

    xhr.onload = () => {
      uploadBtn.disabled = false
      uploadProgress.hidden = true
      try {
        const data = JSON.parse(xhr.responseText || '{}')
        if (xhr.status === 401) {
          showLogin()
          return
        }
        if (xhr.status >= 200 && xhr.status < 300 && data.ok) {
          fileInput.value = ''
          setFileLabel(null)
          void loadTasks()
        } else {
          uploadError.textContent = data.error || '上传失败'
          uploadError.hidden = false
        }
      } catch {
        uploadError.textContent = '上传响应无效'
        uploadError.hidden = false
      }
    }

    xhr.onerror = () => {
      uploadBtn.disabled = false
      uploadProgress.hidden = true
      uploadError.textContent = '网络错误'
      uploadError.hidden = false
    }

    xhr.send(fd)
  })

  const lightbox = $('thumb-lightbox')
  const lightboxImg = $('thumb-lightbox-img')
  const lightboxVideo = $('thumb-lightbox-video')
  const lightboxAudio = $('thumb-lightbox-audio')
  const lightboxAudioWrap = $('thumb-lightbox-audio-wrap')
  const lightboxFallback = $('thumb-lightbox-fallback')
  const lightboxFallbackMsg = $('thumb-lightbox-fallback-msg')
  const lightboxFallbackDl = $('thumb-lightbox-fallback-dl')
  const lightboxTitle = $('thumb-lightbox-title')
  const lightboxLoading = $('thumb-lightbox-loading')
  const lightboxCloseBtn = $('thumb-lightbox-x')
  const lightboxPanel = lightbox
    ? lightbox.querySelector('.thumb-lightbox-panel')
    : null
  const previewCache = Object.create(null)
  let lightboxReturnFocus = null

  function getLightboxFocusables() {
    if (!lightboxPanel) return []
    const nodes = lightboxPanel.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), video[controls], audio[controls], [tabindex]:not([tabindex="-1"])'
    )
    return Array.prototype.filter.call(nodes, (el) => {
      if (el.hidden || el.getAttribute('aria-hidden') === 'true') return false
      if (el.closest('[hidden]')) return false
      const style = window.getComputedStyle(el)
      return style.display !== 'none' && style.visibility !== 'hidden'
    })
  }

  function stopMediaEl(el) {
    if (!el) return
    try {
      el.pause()
    } catch {
      /* ignore */
    }
    el.removeAttribute('src')
    try {
      el.load()
    } catch {
      /* ignore */
    }
    el.hidden = true
    el.onloadeddata = null
    el.oncanplay = null
    el.onerror = null
  }

  function hideLightboxFallback() {
    if (lightboxFallback) lightboxFallback.hidden = true
    if (lightboxFallbackDl) {
      lightboxFallbackDl.hidden = true
      lightboxFallbackDl.removeAttribute('href')
    }
  }

  function showUnsupportedFallback(opts) {
    const taskId = opts && opts.taskId
    const downloadable = Boolean(opts && opts.downloadable)
    const asVideoStill = Boolean(opts && opts.asVideoStill)
    const body = lightbox ? lightbox.querySelector('.thumb-lightbox-body') : null
    if (lightboxLoading) {
      lightboxLoading.hidden = true
      lightboxLoading.classList.remove('is-error')
    }
    stopMediaEl(lightboxVideo)
    stopMediaEl(lightboxAudio)
    if (lightboxAudioWrap) lightboxAudioWrap.hidden = true

    if (asVideoStill && taskId) {
      openImageLightbox(taskId)
      if (body) body.classList.add('has-media-fallback')
    } else {
      if (lightboxImg) {
        lightboxImg.hidden = true
        lightboxImg.removeAttribute('src')
      }
      if (body) body.classList.remove('has-media-fallback')
    }

    if (lightboxFallback) lightboxFallback.hidden = false
    if (lightboxFallbackMsg) {
      lightboxFallbackMsg.textContent = asVideoStill
        ? '当前浏览器无法播放此视频，已显示预览图；请下载后播放'
        : '当前浏览器无法预览此格式，请下载后播放'
    }
    if (lightboxFallbackDl && taskId && downloadable) {
      lightboxFallbackDl.href =
        '/api/tasks/' + encodeURIComponent(taskId) + '/download'
      lightboxFallbackDl.hidden = false
    } else if (lightboxFallbackDl) {
      lightboxFallbackDl.hidden = true
      lightboxFallbackDl.removeAttribute('href')
    }
  }

  function mimeProbablyPlayable(kind, mime) {
    if (!mime) return true
    try {
      // 抽音频未完成时源常为视频容器，浏览器多能取音轨；预检勿用 video/* 卡死
      if (kind === 'audio' && mime.indexOf('video/') === 0) return true
      const el =
        kind === 'audio'
          ? document.createElement('audio')
          : document.createElement('video')
      if (!el || typeof el.canPlayType !== 'function') return true
      const r = el.canPlayType(mime)
      return r === 'probably' || r === 'maybe'
    } catch {
      return true
    }
  }

  function guessMimeFromName(name) {
    const n = String(name || '').toLowerCase()
    const i = n.lastIndexOf('.')
    const ext = i >= 0 ? n.slice(i) : ''
    const map = {
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mkv': 'video/x-matroska',
      '.mov': 'video/quicktime',
      '.m4v': 'video/mp4',
      '.mp3': 'audio/mpeg',
      '.m4a': 'audio/mp4',
      '.aac': 'audio/aac',
      '.opus': 'audio/opus',
      '.ogg': 'audio/ogg',
      '.wav': 'audio/wav',
      '.flac': 'audio/flac'
    }
    return map[ext] || ''
  }

  function resetLightboxMedia() {
    if (lightboxImg) {
      lightboxImg.hidden = true
      lightboxImg.removeAttribute('src')
      lightboxImg.onload = null
      lightboxImg.onerror = null
    }
    stopMediaEl(lightboxVideo)
    stopMediaEl(lightboxAudio)
    if (lightboxAudioWrap) lightboxAudioWrap.hidden = true
    hideLightboxFallback()
    const body = lightbox ? lightbox.querySelector('.thumb-lightbox-body') : null
    if (body) body.classList.remove('has-media-fallback')
    if (lightboxLoading) {
      lightboxLoading.hidden = true
      lightboxLoading.classList.remove('is-error')
    }
  }

  function closeLightbox() {
    if (!lightbox || lightbox.hidden) return
    lightbox.hidden = true
    document.body.classList.remove('lightbox-open')
    resetLightboxMedia()
    const restore = lightboxReturnFocus
    lightboxReturnFocus = null
    if (restore && typeof restore.focus === 'function') {
      try {
        restore.focus()
      } catch {
        /* ignore */
      }
    }
  }

  function focusLightboxChrome() {
    const focusTarget = lightboxCloseBtn || getLightboxFocusables()[0]
    if (focusTarget && typeof focusTarget.focus === 'function') {
      try {
        focusTarget.focus()
      } catch {
        /* ignore */
      }
    }
  }

  function openImageLightbox(taskId) {
    if (lightboxLoading) {
      lightboxLoading.hidden = false
      lightboxLoading.classList.remove('is-error')
    }
    const thumbSrc = '/api/tasks/' + encodeURIComponent(taskId) + '/thumbnail'
    const previewSrc =
      '/api/tasks/' + encodeURIComponent(taskId) + '/thumbnail?edge=1280'
    const cached = previewCache[taskId]

    const show = (src) => {
      if (!lightboxImg) return
      lightboxImg.onload = () => {
        if (lightboxLoading) lightboxLoading.hidden = true
        lightboxImg.hidden = false
      }
      lightboxImg.onerror = () => {
        if (lightboxLoading) {
          lightboxLoading.hidden = false
          lightboxLoading.classList.add('is-error')
        }
      }
      lightboxImg.src = src
    }

    if (cached) {
      show(cached)
      return
    }

    show(thumbSrc)
    const hi = new Image()
    hi.onload = () => {
      previewCache[taskId] = previewSrc
      if (!lightbox.hidden) show(previewSrc)
    }
    hi.onerror = () => {
      /* 保留小图 */
    }
    hi.src = previewSrc
  }

  function openStreamLightbox(kind, taskId, opts) {
    const mime = (opts && opts.mime) || ''
    const downloadable = Boolean(opts && opts.downloadable)
    const fileName = (opts && opts.fileName) || ''
    const resolvedMime = mime || guessMimeFromName(fileName)

    if (resolvedMime && !mimeProbablyPlayable(kind, resolvedMime)) {
      showUnsupportedFallback({
        taskId,
        downloadable,
        asVideoStill: kind === 'video'
      })
      return
    }

    const mediaSrc = '/api/tasks/' + encodeURIComponent(taskId) + '/media'
    if (lightboxLoading) {
      lightboxLoading.hidden = false
      lightboxLoading.classList.remove('is-error')
    }

    const onReady = () => {
      if (lightboxLoading) lightboxLoading.hidden = true
    }
    const onError = () => {
      showUnsupportedFallback({
        taskId,
        downloadable,
        asVideoStill: kind === 'video'
      })
    }

    if (kind === 'video' && lightboxVideo) {
      lightboxVideo.onloadeddata = onReady
      lightboxVideo.onerror = onError
      lightboxVideo.hidden = false
      lightboxVideo.src = mediaSrc
      lightboxVideo.load()
      const playP = lightboxVideo.play()
      if (playP && typeof playP.catch === 'function') playP.catch(() => {})
      return
    }

    if (kind === 'audio' && lightboxAudio) {
      if (lightboxAudioWrap) lightboxAudioWrap.hidden = false
      lightboxAudio.onloadeddata = onReady
      lightboxAudio.oncanplay = onReady
      lightboxAudio.onerror = onError
      lightboxAudio.hidden = false
      lightboxAudio.src = mediaSrc
      lightboxAudio.load()
      const playP = lightboxAudio.play()
      if (playP && typeof playP.catch === 'function') playP.catch(() => {})
    }
  }

  function openLightbox(taskId, fileName, triggerEl, kind, extra) {
    if (!lightbox || !taskId) return
    lightboxReturnFocus =
      triggerEl && typeof triggerEl.focus === 'function'
        ? triggerEl
        : document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null
    resetLightboxMedia()
    lightbox.hidden = false
    document.body.classList.add('lightbox-open')
    if (lightboxTitle) lightboxTitle.textContent = fileName || '预览'
    focusLightboxChrome()

    const previewKind = kind === 'video' || kind === 'audio' ? kind : 'image'
    if (previewKind === 'image') openImageLightbox(taskId)
    else
      openStreamLightbox(previewKind, taskId, {
        mime: extra && extra.mime,
        downloadable: extra && extra.downloadable,
        fileName
      })
  }

  if (taskBody) {
    taskBody.addEventListener('click', (e) => {
      const btn = e.target && e.target.closest
        ? e.target.closest('[data-preview-id]')
        : null
      if (!btn || btn.classList.contains('is-fail')) return
      e.preventDefault()
      openLightbox(
        btn.getAttribute('data-preview-id'),
        btn.getAttribute('data-preview-name'),
        btn,
        btn.getAttribute('data-preview-kind') || 'image',
        {
          mime: btn.getAttribute('data-preview-mime') || '',
          downloadable: btn.getAttribute('data-preview-downloadable') === '1'
        }
      )
    })
  }

  ;['thumb-lightbox-close', 'thumb-lightbox-x'].forEach((id) => {
    const el = $(id)
    if (el) el.addEventListener('click', closeLightbox)
  })

  document.addEventListener('keydown', (e) => {
    if (!lightbox || lightbox.hidden) return
    if (e.key === 'Escape') {
      e.preventDefault()
      closeLightbox()
      return
    }
    if (e.key !== 'Tab') return
    const focusables = getLightboxFocusables()
    if (!focusables.length) {
      e.preventDefault()
      return
    }
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    const active = document.activeElement
    if (e.shiftKey) {
      if (active === first || !lightboxPanel || !lightboxPanel.contains(active)) {
        e.preventDefault()
        last.focus()
      }
    } else if (active === last || !lightboxPanel || !lightboxPanel.contains(active)) {
      e.preventDefault()
      first.focus()
    }
  })

  const loginRemember = $('login-remember')
  if (loginRemember) {
    loginRemember.addEventListener('change', () => {
      if (!loginRemember.checked) clearStoredCreds()
    })
  }

  fillLoginFromStoredCreds()
  void checkStatus()
})()
