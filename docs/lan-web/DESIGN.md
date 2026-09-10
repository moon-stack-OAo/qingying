# 轻影远程 · 局域网 Web Design System

> Category: Product / Utility  
> Product: 轻影（qingying）· LAN Remote Web  
> Scope: **仅** `electron/main/lanServer/public`（登录页 + 工作台 + lightbox）  
> Goal: 暗色优先的本地媒体工具气质——冷静、可控、少装饰；为后续 OpenDesign 重绘与 CSS 落地提供单一事实来源。

## Visual Theme & Atmosphere

- **气质**：本地转码工作台，不是 SaaS 营销页。深色画布、克制青绿点缀、信息密度适中。
- **默认主题**：`data-theme="dark"`；浅色为可选，不得成为默认。
- **情绪关键词**：冷静 · 可信 · 少噪音 · 进度可感知。
- **禁止**：大面积渐变英雄区、霓虹、毛玻璃堆叠、插画装饰、Element 默认蓝作为品牌主色。

与桌面端的关系：

| 维度  | 桌面 Electron                | 本规范（LAN Web）         |
|-----|----------------------------|----------------------|
| 主色  | 青绿 accent `oklch(... 165)` | **同一青绿体系**（hex 落地见下） |
| 圆角  | 6–10px                     | 略收：8–12px（工具感）       |
| 阴影  | 轻                          | 更克制，几乎只靠边框分层         |
| 组件库 | Element Plus               | 原生 HTML/CSS（无 EP）    |

## Color Palette & Roles

### Dark（默认）

| Token              | Hex                               | 用途                                 |
|--------------------|-----------------------------------|------------------------------------|
| `--bg`             | `#0F1115`                         | 页面底（对齐 Electron `backgroundColor`） |
| `--bg-elevated`    | `#14171D`                         | 次级底、滚动区                            |
| `--panel`          | `#1A1D24`                         | 卡片 / 侧栏面板                          |
| `--panel-elevated` | `#1E222B`                         | 悬浮层、表头、控件填充                        |
| `--fg`             | `#E8EAED`                         | 主文字                                |
| `--fg-secondary`   | `#A0A7B4`                         | 次要说明                               |
| `--fg-muted`       | `#6B7280`                         | 占位、辅助                              |
| `--border`         | `rgba(255,255,255,0.10)`          | 默认描边                               |
| `--border-strong`  | `rgba(255,255,255,0.18)`          | 聚焦邻近、分割强调                          |
| `--accent`         | `#2DD4A8`                         | **唯一品牌主色**（青绿，对齐桌面 hue 165）        |
| `--accent-hover`   | `#4BE0B8`                         | 主按钮 hover                          |
| `--accent-soft`    | `rgba(45,212,168,0.14)`           | 选中底、进度轨填充、chip                     |
| `--accent-fg`      | `#0B1A16`                         | 主按钮上的文字                            |
| `--ok`             | `#67C23A`                         | 成功 / 已完成                           |
| `--warn`           | `#E6A23C`                         | 警告 / 排队提示                          |
| `--danger`         | `#F56C6C`                         | 错误 / 失败                            |
| `--info`           | `#79BBFF`                         | 仅信息态（非 CTA）                        |
| `--track`          | `rgba(255,255,255,0.08)`          | 进度条底轨                              |
| `--focus-ring`     | `0 0 0 3px rgba(45,212,168,0.28)` | 键盘焦点                               |

### Light（可选）

| Token            | Hex                     |
|------------------|-------------------------|
| `--bg`           | `#F3F5F9`               |
| `--panel`        | `#FFFFFF`               |
| `--fg`           | `#1F2937`               |
| `--fg-secondary` | `#606266`               |
| `--fg-muted`     | `#909399`               |
| `--border`       | `rgba(15,23,42,0.10)`   |
| `--accent`       | `#0D9F7A`               |
| `--accent-hover` | `#0B8A69`               |
| `--accent-soft`  | `rgba(13,159,122,0.12)` |
| `--accent-fg`    | `#FFFFFF`               |

语义色（ok / warn / danger）浅色下可沿用同一 hex，仅 soft 透明度改为 ~10%。

**规则**

- 每个屏幕最多 **一个** 强 accent 焦点（通常是「登录」或「上传并开始」）。
- 勿用纯黑 `#000` / 纯白 `#FFF` 做大面积背景。
- 禁止把 `--info`（蓝）当作主 CTA。

## Typography Rules

- **字体栈**：`"Segoe UI", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif`
- **等宽**（配对码、端口、文件体积）：`"Cascadia Mono", "JetBrains Mono", "SF Mono", Consolas, ui-monospace, monospace`
- **字号阶梯（px）**：12 · 13 · 14 · 15 · 17 · 20 · 24
- **字重**：正文 400；标题 / 品牌名 600；数字统计可用 600–700
- **行高**：正文 1.45；标题 1.25
- **字距**：≥20px 标题可 `-0.01em`
- **文案语言**：简体中文；句首不大写英文 Title Case（品牌名「轻影」除外）

推荐映射：

| 角色        | 字号         | 字重      | 色            |
|-----------|------------|---------|--------------|
| 页面标题（工作台） | 20–24      | 600     | `--fg`       |
| 卡片标题      | 15–17      | 600     | `--fg`       |
| 正文 / 表单   | 14         | 400     | `--fg`       |
| 辅助说明      | 12–13      | 400     | `--fg-muted` |
| 统计数字      | 20         | 600–700 | `--fg`       |
| 配对码 / 体积  | 13–15 mono | 600     | `--fg`       |

## Spacing & Radius

- **间距阶梯**：4 · 8 · 12 · 16 · 20 · 24 · 32
- **圆角**：`--radius-sm: 8px` · `--radius: 10px` · `--radius-lg: 12px`
- **顶栏高度**：52–56px
- **控件高度**：输入 / 按钮 36–40px
- **工作台侧栏宽度**：桌面 320–360px；平板以下改单栏

## Component Stylings

### Buttons

- **Primary**：`--accent` 实心，`--accent-fg` 文字；hover → `--accent-hover`；禁用 40% 透明度。
- **Ghost / Secondary**：透明底 + `--border`；hover 用 `--panel-elevated` 或 `rgba(255,255,255,0.05)`。
- **Danger text**：仅用于退出失败操作，文字 `--danger`，无红底大按钮除非破坏性确认。
- 圆角 `--radius-sm`；左右 padding 14–16px；禁止双主按钮并排抢视觉。

### Inputs / Selects

- 底：`--panel-elevated`（暗色）或白（浅色）
- 边：1px `--border`；focus → accent 边 + `--focus-ring`
- 标签在上，13px muted；错误文案 13px `--danger`，贴控件下方
- 配对码输入：等宽、字距略松、`maxlength` 视觉上可居中数字

### Cards / Panels

- 1px `--border` + `--panel` 底；**默认无大阴影**
- 内边距 16–20px；卡片头：图标点缀（单色）+ 标题 + 一行 muted 副标题
- 上传 dropzone：虚线边 `--border-strong`；拖入时 `--accent-soft` 底 + accent 边

### Stat chips

- 紧凑横排；数字大、标签小
- 「进行中」可用小圆点 + accent 或 info 脉动，避免整块高饱和底
- 成功 / 失败仅用边或数字色区分，勿整卡染色

### Task table / list

- 行高舒适（约 48–56px）；缩略图 40–48 圆角 6–8
- 进度条：细轨 `--track`，填充 `--accent`；失败改 `--danger`
- 空态：居中短文案 + 弱图标，不放插画

### Topbar

- 半透明深底 + 1px 底边即可；**少用 backdrop-blur 叠层**（可用轻微 blur ≤8px）
- 左：品牌标「轻」方块（accent 软底 + accent 字）+「轻影远程」+ 副标
- 右：主题切换 · 用户 chip · 退出（ghost）

### Login

- 居中窄卡（max-width ~380–400px）
- 背景：极弱径向光晕（accent 8–12% 透明度），**禁止**多色霓虹光斑
- 品牌区：「轻」mark + 标题「轻影」+ 副标「局域网远程压缩」
- 单主 CTA「登录」

### Lightbox

- 遮罩 `rgba(0,0,0,0.72)`；面板 `--panel`；关闭为 ghost
- 加载态：细环 spinner，色用 accent 或 muted，勿粗闪

## Layout Principles

1. **登录**：单列居中；垂直可略偏上（约 42% 视口），避免死板正中。
2. **工作台（≥960px）**：顶栏 → 页眉（标题+统计）→ **左投递 / 右队列** 双栏；左窄右宽。
3. **工作台（<960px）**：单栏，投递在上、队列在下；统计可横向滚动。
4. **内容宽度**：主区 max-width 1200–1280px，水平 padding 16–24px。
5. **分隔**：优先留白与 1px 边；少用粗分割线。

## Depth & Elevation

仅两级：

- **Flat (0)**：页面与卡片默认（边框分层）。
- **Raised (1)**：lightbox、下拉、少量浮层 —— `0 8px 24px rgba(0,0,0,0.35)`（浅色则黑 8%）。

禁止：neumorphism、多层 glass、卡片上再叠重阴影。

## Motion

- 时长 120–200ms；缓动 `ease-out`
- 允许：主题切换淡入、dropzone 边色、进度条宽度、lightbox 显隐
- 禁止：弹性弹跳、大位移入场、无限闪烁（进行中圆点可极弱 pulse）

## Do's and Don'ts

**Do**

- ✅ 青绿 accent 只服务主操作与进度
- ✅ 暗色为默认；文案短、状态明确
- ✅ 表单标签中文、错误可读、配对码提示指向「设置 → 远程访问」
- ✅ 保持现有信息架构：登录 / 投递 / 队列 / 预览

**Don't**

- ❌ 恢复 Element `#409eff` 作为主品牌色
- ❌ 登录页大插画或产品截图墙
- ❌ 一屏多个实心主按钮
- ❌ 在规范外发明新 hex（若必须，在产物里标注偏离并说明原因）
- ❌ 改变功能边界（远程仍是投递，不是完整遥控桌面）

## Responsive Behavior

| 断点         | 布局                         |
|------------|----------------------------|
| ≥ 1100px   | 双栏工作台，侧栏固定宽                |
| 960–1099px | 双栏，侧栏略收                    |
| 640–959px  | 单栏堆叠                       |
| < 640px    | 单栏；顶栏副标可隐藏；统计 chip 缩小；按钮全宽 |

触控：主要点击目标 ≥ 40px；lightbox 关闭热区足够大。

## Content & Voice

- 产品名：**轻影**；远程页标题：**轻影 · 远程访问**
- 顶栏：**轻影远程** / 副标：**局域网投递 · 压缩 · 下载**
- 登录副标：**局域网远程压缩**
- 工作台标题：**工作台**；说明：**上传后由本机排队处理，完成后可下载结果**
- 主操作：**登录** · **上传并开始** · **退出** · **关闭**
- 语气：直接、安全提示不恐吓；不说「云端」「AI」

## Screens to Redesign（OpenDesign 交付物建议）

按优先级生成 HTML 预览（暗色默认 + 可选浅色切换）：

1. **登录**（含配对码显示 / 隐藏两种状态）
2. **工作台空态**（无任务）
3. **工作台忙碌态**（进行中 + 进度 + 缩略图）
4. **Lightbox 预览**
5. **窄屏（手机）工作台**

实现映射（供后续改代码，非本文件职责）：

- 结构：`electron/main/lanServer/public/index.html`
- 行为：`.../app.js`
- 样式：`.../style.css`（以本 DESIGN.md token 替换现有 Element 蓝主色）

## Agent Prompt Guide

- 生成或改版时：**先读本文件**，颜色与圆角不得偏离 token 表。
- 输出应为可浏览器打开的静态 HTML/CSS（可内联），中文 UI。
- 保留现有 DOM 语义区块名更佳（`view-login` / `view-main` / `workbench` / `stat-chip` 等），便于对照落地。
- 一屏一个主 CTA；暗色默认；青绿 accent。
- 不要引入 Vue / Element Plus / 外部 CDN UI 库（可用系统字体）。
- 若用户要求「更炫」，优先加微对比与排版，而不是加渐变和光效。

## Changelog（设计意图）

| 相对现状    | 变更                                                |
|---------|---------------------------------------------------|
| 主色      | Element 蓝 `#409eff` → 青绿 `#2DD4A8` / 浅色 `#0D9F7A` |
| 氛围      | 通用后台感 → **暗色媒体工具**                                |
| 阴影 / 玻璃 | 减弱；边框分层为主                                         |
| 圆角      | 14px → 10–12px（更利落）                               |
| 信息架构    | 保持不变                                              |

## 落地状态

- 已同步到 `electron/main/lanServer/public/style.css`（青绿主色、弱装饰、双栏等高）。
- **中度对齐**已落地：登录纵向品牌 / field、顶栏 chip、模式卡片皮、panel 观感；保留全部真实表单字段与 `app.js` API。
- 图片 mode-tag 用 `--info`（非规范外 violet）；`--accent*` / `--track` / `--radius-lg` / `--font-mono` 已作 token 别名落地。
- OpenDesign 预览项目：`lan-web-bfa4`（含演示切换器，不进生产）。
