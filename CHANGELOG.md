# 更新日志

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。  
格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

## [Unreleased]

### 计划

- Windows 代码签名、macOS 公证完整链路（配置与证书就绪后启用）
- 局域网远程接入动图相关任务模式（当前仅桌面端）

## [1.2.6]

### 优化

- **界面去模板化（unslop）**：去掉大写宽字距分区标签、更新徽章脉冲与胶囊圆角；进度条改为纯 accent；间距收齐 4px 网格；侧栏加宽至 240px
- **FFmpeg 状态签名**：标题栏改为静音文案 + 就绪状态圆点，不再用彩色胶囊底
- **更新提示文案**：标题栏徽章 `NEW` 改为「更新」；已下载仍为「就绪」
- **视频空态时间线刻度**：压缩 / 抽音频 / 拼接 / 混剪 / 打码 / 转 GIF 的大空态增加极淡时间线刻度（图片模式不加）
- **体积摘要**：右侧「体积 ±%」旁附 mono 前后体积（如 `128 MB → 48.2 MB`）
- **应用图标扁平化**：青绿实底 + 画幅 + 播放三角，去掉渐变与光晕；同步 `resources/`、`build/`、favicon

## [1.2.5]

### 新增

- **视频转动图**（`video-to-gif`）：视频片段导出 GIF / 动图 WebP；支持时段裁剪、帧率、最长边、循环、调色板色数与抖动
- **多图转动图**（`images-to-gif`）：≥2 张静图按序合成动图；可调帧间隔/帧率与输出格式
- **动图优化**（`gif-optimize`）：对已有 GIF / 动图 WebP 用内置 FFmpeg 重编码缩小体积（palette / libwebp，无外部 gifsicle）
- **动图公共引擎**：`shared/gifLogic` + `gifRunner`；GIF 两遍调色板，WebP 单遍 `libwebp`
- **开发二进制自检**：`npm run ensure:binaries`（`scripts/ensure-binaries.mjs`）检查并补装 Electron / ffmpeg / ffprobe / sharp / resvg

## [1.2.4]

### 优化

- **设置抽屉滚动条**：`el-scrollbar` 内容区右侧留白，避免浮动滚动条遮挡控件与文案
- **远程访问设置分区**：按「服务 / 安全 / 访问」分段，合并密码状态展示并精简重复安全说明
- **更新弹窗与滚动统一**：软件更新弹窗系统风格化；主要滚动区改用 Element Plus 滚动条；设置各 Tab 间距统一

## [1.2.3]

### 安全

- **`openExternal` 协议白名单落地**：`setWindowOpenHandler` 仅对 `http:` / `https:` 调用 `shell.openExternal`（与 1.2.0 说明对齐）
- **SETTINGS_GET / SET / RESET 脱敏**：下发渲染进程的设置省略 `lanPasswordHash`，是否已设密码仍通过 `LanStatus.hasPassword`
- **路径白名单收紧**：`allowPath(file)` 仅登记精确文件，不再放开父目录；sidecar / 打开输出由 `allowOutputPath` 在启动校验与任务完成后显式登记；选目录与 `outputDir` / userData 仍 `allowDir` 整树放行（同目录未选中邻接文件读预览会失败，属预期）
- **局域网默认绑定更安全**：无历史设置 / 重置后默认 `lanBindHost` 为 `127.0.0.1`（仅本机）；已持久化用户保持原值。设置页推荐「仅本机」，选 `0.0.0.0` 时加强风险确认
- **局域网登录配对码**：绑定 `0.0.0.0` 时，登录除密码外还需桌面设置页显示的 6 位内存配对码（约 10 分钟 TTL，可刷新；改密 / 停服务 / 切换绑定作废）。仅本机绑定不要求。配对码不落盘
- **局域网安全提示**：设置页在绑定 `0.0.0.0` 时明确提示同网可访问、HTTP 明文、强密码与配对码；未设密码禁止开启。Cookie 因明文 HTTP 不加 `Secure`（`buildSetCookie` 预留可选 `secure`，默认 false）
- **局域网缩略图限流**：已认证 `/api/tasks/*/thumbnail` 按 IP 滑动窗口限流（默认 30 次/分钟），超限返回 429
- **局域网下载限流**：已认证 `/api/tasks/*/download` 按 IP 滑动窗口限流（默认 20 次/分钟），超限返回 429 中文错误
- **渲染进程 CSP**：`index.html` 增补 `object-src 'none'`、`base-uri 'self'`

### 优化

- **局域网上传任务不进桌面列表**：LAN 入队改走 `enqueueLan`，进度/结束/排队事件仍走 SSE 与队列监听，但不向主窗口推 `TASK_*`；桌面「取消全部」只取消桌面任务；完成系统通知不统计 LAN；退出时仍硬停全部
- **局域网 SSE 实时进度**：`GET /api/tasks/events`（需登录）推送 `snapshot` / `progress` / `end` / `queued`；Web 页用 EventSource 局部更新进度条，保留 CSS transition；进度约 150ms / 0.5% 节流，每 IP ≤3 路 SSE；断线自动重连并以低频轮询兜底
- **页面标题与品牌同源**：`index.html` 标题由 electron-vite 从 `shared/brand.ts` 的 `PRODUCT_NAME` 注入
- **拖拽路径工具下沉**：`fileUrlToPath` / `pathBasename` / `isUncPath` 抽至 `shared/pathUtils`，preload 与 `useDragDrop` 共用
- **任务恢复跳过 UNC `existsSync`**：`taskStore` 对 UNC 源路径不在启动时同步探测，避免卡死（与队列入队策略一致）
- **chore：拆分 lanServer handlers**：`electron/main/lanServer/index.ts` 拆为 `context` / `httpUtil` / `paths` / `taskUtil` 与 `handlers/*`，对外 API 不变
- **局域网 Web UI**：按 `docs/lan-web/DESIGN.md` 落地暗色工具风；补焦点环 / lightbox 焦点管理、进度状态色、响应式断点与触控热区
- **局域网登录记住密码**：可选将用户名与密码存于本机浏览器 `localStorage`，下次自动回填（仅适合受信设备）
- **局域网预览增强**：完成后视频/音频可在 lightbox 内播放（`/api/tasks/:id/media` 支持 Range）；音频任务列表使用音符 SVG 占位并可点播
- **局域网预览能力检测与源预听**：lightbox 用 `canPlayType` 降级（提示 + 下载；视频回退抽帧图）；音频未完成且源仍在时可预听；`LanTaskView` 增补 `mediaMime` / 扩展 `playable`

### 文档

- `AGENTS.md`：注明 `ffmpegLogic` 使用 Node `path`、勿打进纯浏览器包；改 native 包时核对 `asarUnpack`
- `README`：打包二进制说明补充 `sharp` / `@img` 与同步改 `electron-builder.yml` 的提醒
- `docs/lan-web/DESIGN.md`：局域网远程 Web 设计规范
- Release 正文由 changelog 提取，并自动附带下载与安装说明

### 测试

- 补充 `pathUtils` 用例
- 补充局域网配对码 `pairCode` 用例
- 补充局域网 SSE 节流与 `taskQueueLogic` LAN 分流用例

## [1.2.2]

### 安全

- **路径白名单**：禁止从持久化任务 / 未校验的 `outputDir` 回灌扩大允许目录；`SETTINGS_SET` 仅接受本会话已登记或与当前可信设置相同的输出目录
- **局域网**：移除不完整且易误导的 OPTIONS CORS 头（上传页与 API 同源，无需跨源）

### 修复

- 重置设置后同步任务队列并发数，与「保存设置」一致

### 优化

- 统一 FFmpeg / 探测 / 抽帧子进程取消为 `processKill.killChildProcess`
- 模式侧栏宽度 220px → 200px
- 高级参数入口去掉误导性展开箭头（实际为右侧抽屉）
- 视频压缩「预设」不再 `flex` 撑开，与目标体积 / 编码器间距保持稳定

### 测试

- 补充 pathAllowlist 持久化校验、IPC 通道对账、`processKill`、`taskQueueLogic` 用例

## [1.2.1]

### 优化

- **关闭确认弹窗**：标题/内容排版与按钮样式统一，适配视口居中
- **设置抽屉**：分区标题与元信息、主题按钮组、底部操作栏，布局与控件尺寸更一致
- **裁切/打码相关 UI**：画布圆角与遮罩层次、弹窗头部信息、打码工作区文案与主按钮样式
- **拖入区与多处文案**：提示更精炼；格式后缀大小写统一；帮助/更新/选项面板等视觉一致性调整

### 文档

- 新增项目专属 `AGENTS.md`（目录分层、IPC/安全、命令与发版协作约定）

## [1.2.0]

### 安全

- **IPC 路径白名单**：读图 / 抽帧 / 打开路径 / 图片处理 / 启动任务前校验路径，仅允许用户选择、拖入、历史任务及应用数据 /
  输出目录等已登记范围
- **IPC 调用来源校验**：业务与更新相关 IPC 须来自主窗口 `webContents`
- **`openExternal` 协议白名单**：仅允许 `http:` / `https:`
- **渲染进程 `sandbox: true`**：preload 改为单文件打包以兼容沙箱
- **局域网**：密码最短 8 位；可配置监听地址（`0.0.0.0` / `127.0.0.1`）；登录限流仅使用真实 `socket.remoteAddress`（不信任
  `X-Forwarded-For`）；下载与静态资源路径防穿越；scrypt 校验固定允许参数，拒绝被篡改的超大代价参数
- **局域网上传**：multipart 真正流式写盘（避免整包进内存）；同时上传并发上限 2；LAN 任务结束清理 `lan-uploads` 源文件
- **水印 `fontColor` 白名单**：非法颜色回退默认值，降低 `drawtext` 滤镜注入风险
- 生产环境对拖入 / 选文件等路径日志脱敏（仅开发输出完整路径）

### 修复

- 重置设置后同步任务队列并发数，与「保存设置」行为一致
- 图片任务取消：Magick 可中断子进程；Sharp 在处理检查点响应取消并清理不完整输出
- **视频抽帧 / 打码预览**：内置 ffprobe 由停更的 `ffprobe-static@3`（二进制 4.0.2）更换为 `@ffprobe-installer/ffprobe`（约 5.x+/2023 essentials），修复「无法读取视频信息」
- **任务一直「排队中」/ 取消无响应**：出队后立即推送运行进度；视频打码强制软件编码并跳过硬件试编；同 id 再入队释放僵尸 running；队列 pump 重入补扫；时长探测可超时/取消；不再误吞排队中/运行中的失败终态；取消按钮立即反馈 UI；失败/校验提示更明显且抬高浮层
- **局域网 UNC 路径卡死**：启动校验 / 入队不再同步 `existsSync`（`\\NAS\...` 上会挂死 IPC）；输出去重与文件探测改为异步超时；启动超时给出明确提示
- **打码预览被提示顶掉**：规则校验改用消息提示，抽帧失败与加载态不再整块替换已有预览
- **打码默认框**：进入预览时默认居中约 50% × 50%（不再沿用裁切的居中 80%）；抽帧后写入真实像素坐标，保存时自动带上未点「添加」的当前框
- **CI typecheck**：将 `cloneForIpc` 移至 `shared/`，修复 `tsconfig.node` 无法解析测试引用导致发版失败
- **系统托盘**：启动后立即创建托盘图标（此前仅「最小化到托盘」时才出现）
- **裁切/打码画布坐标**：容器尺寸与指针统一用 `getBoundingClientRect`，修复缩放/DPI 下拖动偏移
- **裁切拖动性能**：`setPointerCapture` + `requestAnimationFrame` 合并更新，仅在矩形实际变化时 emit
- **DropZone 拖入高亮**：preload 捕获阶段去掉 `stopPropagation`，渲染进程可更新 dragging
- **裁切取整**：拖动中保留浮点，确认/落盘再 round，减轻亚像素抖动
- **固定比例拖角**：锁定主轴与对边锚点，避免主方向切换导致框跳变
- **拼接顺序拖拽**：近边缘自动滚动、插入指示线、`:key` 使用 index+path 避免重复 path
- **图片质量滑块**：本地草稿跟手拖动，松手再持久化；tooltip 改挂标签避免挡指针

### 新增

- **视频打码**独立任务模式：从压缩高级选项拆出，仅支持单个视频，默认接近原画导出
- **视频打码 · 逐帧流水线**（可选开关）：抽全帧 JPEG → Sharp 固定区域打码 → 封装并回嵌音轨；默认仍为 FFmpeg 滤镜一次编码。非逐帧时结束时间填 0 即覆盖到片尾
- 设置中可选择局域网绑定地址，并加强「开启即共享本机处理能力」的安全提示

### 优化

- **视频打码**改为单页流程：不再展示任务队列与体积汇总，隐藏并发数；工作区为 DropZone / 单视频状态条
- 首页选项 / 打码单页布局与提示显示优化
- **视频/图片拼接顺序**：任务列表「编辑拼接顺序」打开弹窗，支持拖拽排序；图片拼接可在弹窗内改布局方向（横向/纵向/网格）
- **自动更新**：按钮改为「安装并重启」；点击后进入「正在安装」空态（与检查更新同布局，不展示更新内容），禁止关闭直至重启

### 文档

- 完善代码签名 / 公证文档与 CI 接线说明（Secrets 可选注入；无证书时跳过签名且不失败）。**仍需真实证书才能实际签名**
  ，未宣称已支持生产签名

## [1.1.0]

### 新增

- **视频局部打码**：选中单个视频压缩任务后，可可视化框选区域并设置时间段；支持像素化 / 模糊，导出经 FFmpeg `filter_complex`
  应用，兼容水印、裁切与缩放
- **图片工具**：图片压缩 / 裁切 / 拼接；内置引擎与可视化裁切预览
- **视频拼接**与**图+视频混剪**（片头 / 片尾静图、叠加图）
- **局域网远程访问**：本机 Web 上传与任务入队（会话认证、限流、multipart）
- **分辨率输出**：固定宽高 / 按比例，可选黑边填充；视频抽帧预览用于定框
- **编码器扩展**：更多 H.264 / HEVC 硬件选项与 `libx265`；拼接与混剪重编码走同一硬件路径
- 局域网端支持图片压缩预设与任务缩略图预览
- **局域网 Web 主题**：远程页顶栏可切换浅色 / 深色，偏好保存在浏览器本地
- **开机自启**：设置中可开启登录时启动，并可选择启动后最小化到托盘

### 优化

- 自动更新改为始终全量下载；点击下载前清空旧缓存，避免差分失败出现双段进度
- 运行中每小时静默检查更新（仅标题栏提示，不自动弹窗；启动检查仍会弹窗）
- 首页任务参数隔离：裁切 / 混剪改为任务级编辑，多任务时给出明确提示
- 切换任务模式时校验文件类型；工具分组、拼接列表可编辑、选文件按模式过滤
- 编码器可用性与混剪引导可发现性提升

## [1.0.2]

### 新增

- **更新下载可取消**：下载中可取消，失败支持中文错误提示与重试
- **安装完成页可选桌面快捷方式**：默认勾选，取消则不创建桌面图标（开始菜单仍创建）

### 优化

- **数据目录切换**：尽量迁移设置、任务列表等到新目录；不覆盖已有文件；跳过 Chromium 缓存；原目录保留
- 选择目录对话框默认打开当前路径

### 修复

- **macOS 最大化**：取消固定不可缩放与过高 min 尺寸，适配工作区；同步全屏状态与标题栏还原

## [1.0.1]

### 新增

- **视频水印**：压缩任务高级选项支持文字 / 图片水印（九宫格位置、边距、透明度、缩放%、可选时间段）
- **图片处理引擎**：默认内置 `sharp`；设置中可选系统 / 自定义 ImageMagick，并支持引擎状态检测与测试

### 修复

- 打包安装后关闭到托盘时图标丢失（`extraResources` 打入托盘图标，运行时从 `process.resourcesPath` 解析）

### 优化

- 品牌图标重绘（画幅 + 柔光 + 影剪影），全套 PNG/ICO/favicon 同步更新
- 标题栏版本旁：有可用更新显示 **NEW**，下载完成显示 **就绪**，点击打开更新弹窗
- 更新弹窗品牌化：渐变顶栏、版本对比、进度条与主按钮样式；加大弹窗尺寸

## [1.0.0]

**轻影**（qingying）首发：本地视频压缩与音频抽取桌面应用（Electron + Vue 3 + TypeScript + Element Plus）。

### 新增

#### 核心能力

- 内置 `ffmpeg-static` / `ffprobe-static`，无需系统安装 FFmpeg
- 多文件添加：按钮选择 + 拖拽（真实本地路径）；**文件夹递归**（深度 8 / 最多 500）
- **任务模式**：视频压缩 / 仅抽取音频（m4a / mp3 / opus + 码率）
- 压缩预设：高清存档 / 标准压缩 / 微信社交 / 自定义
- 多格式输出：mp4 / mkv / mov（H.264 + AAC）、webm（VP9 + Opus）
- 并行编码：并发 1–4；单任务 / 全部取消
- 体积对比：原始 / 输出 / 节省比例与汇总
- 实时进度：百分比、时间、速度、**ETA**
- **时间段裁剪**（开始/结束秒，压缩与抽音频均支持）
- **目标体积（MB）**：码率估算约达目标；可选 **真·两遍编码**（libx264 / VP9；硬件自动单遍 ABR）
- **画面旋转**：高级选项支持顺时针 / 逆时针 90°（竖→横）与 180°
- **静音**：高级选项可去掉音轨（`-an`）
- **兼容档**：H.264 可选 Main@L4 / High + yuv420p（利于旧设备/微信）；WebM 不适用
- **视频音轨码率**：压缩时可选手动码率（默认仍 128k）
- **帧率 / 编码速度**：可选 24/30/60 fps；x264 preset 快速 / 均衡 / 高质量

#### 硬件加速

- 自动 / 软件 x264 / NVIDIA NVENC / Intel QSV / AMD AMF / **Apple VideoToolbox**
- 列表探测 + **lavfi 短片试编**验证
- 硬件编码失败自动回退软件 x264，并提示
- auto 在 macOS（darwin）优先 VideoToolbox

#### 体验与界面

- **暗色模式**：浅色 / 深色 / 跟随系统
- **无边框自定义标题栏**：拖动、最小化 / 最大化 / 关闭
- **设置抽屉**：主题 / 并发 / 通知 / 任务持久化 / ffmpeg 路径 / 数据管理 / 关于
- 支持自定义数据目录（重启生效）与 ffmpeg bin 覆盖
- **关闭行为**：询问 / 最小化到托盘 / 直接退出；支持「下次不再询问」
- **系统托盘**：悬停显示版本；菜单含打开主窗口 / 检查更新 / 打开设置 / 退出
- FFmpeg 就绪状态展示在标题栏（悬停显示路径或错误）
- **全局快捷键**与帮助对话框（`F1` / 工具栏 `?`）
- 输出命名模板：预设 + 自定义（`{name}` `{preset}` `{date}` `{time}`）
- 输出位置：固定目录 / 源文件同目录 / 按日期子目录
- 设置持久化（输出目录、预设、编码器、并发、命名、目标体积、两遍、主题、任务模式、通知等）
- **任务列表持久化**（重启恢复；运行中回落待处理；源文件缺失标失败；已完成最多 100 条）
- **任务详情**：路径、参数摘要、完整 ffmpeg 命令行、错误全文
- 队列完成后系统通知；打开文件 / 在文件夹中显示
- 应用到待处理；错误信息中文产品化映射
- 抽音频前无音轨预检
- 品牌图标（窗口 / 安装包 / favicon）

#### 工程与分发

- 产品名 **轻影**，包名 / 安装包 `qingying`，`appId` 为 `com.moonstack.qingying`
- 仓库：`moon-stack-OAo/qingying`
- 架构：main / preload / renderer；`shared` 类型与 FFmpeg 纯逻辑
- UI：composables + 组件拆分
- vitest 单元测试；CI：`typecheck` + `test` + `build`
- 自动更新：`electron-updater` + GitHub Releases
- Windows / macOS 打包配置（electron-builder）；发版说明见 `docs/RELEASE.md`

### 优化

- 统一间距 / 字号 / 圆角设计 Token，清理死样式
- 全局字号 token 上调约 1px；按钮与 Element 控件字号对齐 token
- 面板描边改用 ring（box-shadow）；更新弹窗 / 设置抽屉布局与滚动条
- **移除独立工具栏**：任务操作并入任务列表标题栏；输出目录并入任务选项
- 任务选项分区布局（模式/预设、输出/命名、高级折叠）
- 空态三步引导；任务表次要操作收入更多菜单；保留表格默认线样式
- 工作区弹性布局，有任务时压缩拖放区
- 增强 DropZone / 设置路径 / 折叠按钮的键盘与焦点可达性
- 默认窗口 **1360×900**，禁用拖拽调整尺寸（最大化仍可用）

### 依赖

- 添加 `@resvg/resvg-js`、`to-ico` 开发依赖（图标构建）

### 说明

- WebM 使用软件 VP9 + Opus，不支持硬件加速
- 两遍编码仅 libx264 / libvpx-vp9；NVENC / QSV / AMF / VideoToolbox 在目标体积下使用单遍 ABR
- 硬件编码器依赖本机驱动与 FFmpeg 编译支持；试编通过不保证长时间任务一定成功（已支持回退）
- Windows 未代码签名时可能触发 SmartScreen；macOS 公证链路需证书后启用

### 快捷键

| 快捷键                                           | 动作        |
|-----------------------------------------------|-----------|
| `Ctrl/Cmd + Enter`                            | 全部开始      |
| `Ctrl/Cmd + Shift + Enter` / `Ctrl/Cmd + Esc` | 全部取消      |
| `Ctrl/Cmd + O`                                | 添加视频      |
| `Ctrl/Cmd + Shift + O`                        | 选择输出目录    |
| `Ctrl/Cmd + L`                                | 清除已完成     |
| `Ctrl/Cmd + D`                                | 切换浅色 / 深色 |
| `F1` 或 `Ctrl + /`                             | 快捷键帮助     |

[Unreleased]: https://github.com/moon-stack-OAo/qingying/compare/v1.2.4...HEAD

[1.2.4]: https://github.com/moon-stack-OAo/qingying/releases/tag/v1.2.4

[1.2.3]: https://github.com/moon-stack-OAo/qingying/releases/tag/v1.2.3

[1.2.2]: https://github.com/moon-stack-OAo/qingying/releases/tag/v1.2.2

[1.2.1]: https://github.com/moon-stack-OAo/qingying/releases/tag/v1.2.1

[1.2.0]: https://github.com/moon-stack-OAo/qingying/releases/tag/v1.2.0

[1.1.0]: https://github.com/moon-stack-OAo/qingying/releases/tag/v1.1.0

[1.0.0]: https://github.com/moon-stack-OAo/qingying/releases/tag/v1.0.0
