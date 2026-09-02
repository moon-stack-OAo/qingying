# AGENTS.md — 轻影（qingying）

面向 AI / 协作者的项目专属指引。全局个人偏好（中文回复等）以用户 `~/.config/opencode/AGENTS.md` 为准；**本文件优先约束本仓库的技术与流程约定**。

## 项目概览

- **产品名**：轻影（`PRODUCT_NAME`）；包名 `qingying`；AppId `com.moonstack.qingying`
- **定位**：本地桌面端媒体工具（视频压缩、抽音频、图片处理、拼接/混剪、视频打码等），不依赖云端转码
- **技术栈**：Electron + electron-vite + Vue 3 + TypeScript + Element Plus；FFmpeg（`ffmpeg-static` / `@ffprobe-installer/ffprobe`）；图片侧 Sharp（可选 ImageMagick）
- **仓库**：`https://github.com/moon-stack-OAo/qingying.git`
- **版本权威**：`package.json` 的 `version` 与 `CHANGELOG.md` 对齐；README 不单独维护版本号

## 目录与分层（必须遵守）

```
electron/main/     # 主进程：窗口、IPC、任务队列、FFmpeg/图片引擎、设置、更新、局域网服务
electron/preload/  # 预加载：contextBridge 暴露 electronAPI；拖拽路径解析
src/               # 渲染进程：Vue 3 UI（components / composables）
shared/            # 主/渲染共享：类型、IPC 通道名、纯逻辑（ffmpegLogic、imageLogic 等）
tests/             # vitest 单测（优先测 shared 纯函数与可抽离逻辑）
docs/              # 发版等维护文档
scripts/           # changelog 提取、图标生成等
resources/ / build/# 打包资源；产物在 release/（勿提交）
```

### 分层规则

1. **可在主进程与渲染进程复用的纯逻辑** → 放 `shared/`（无 Node/Electron/DOM 专用 API）。改命令行拼装、进度解析、命名模板、裁切几何等优先改 shared，并补/改 `tests/`。
2. **IPC 通道名与跨进程类型** → 定义在 `shared/types.ts`（`IpcChannels`、`ElectronAPI` 等）。新增能力时：types → preload 暴露 → main 注册 → 渲染调用，保持一致。
3. **渲染层**只通过 `window.electronAPI`（preload）与主进程通信；禁止在渲染进程直接 `require('fs')` / 启子进程。
4. **主进程副作用**（spawn ffmpeg、读写设置、任务持久化、托盘、updater、lanServer）留在 `electron/main/`。
5. 品牌常量用 `shared/brand.ts`，避免硬编码产品名散落各处。

## 常用命令

```bash
npm install          # 或 npm ci（CI / 干净复现）
npm run dev          # 开发启动
npm run typecheck    # node + web 类型检查（改完必跑）
npm test             # vitest run
npm run build        # electron-vite 编译到 out/
npm run dist:win     # Windows 安装包 → release/
npm run dist:mac     # 需在 macOS 上执行
```

完成功能或修 bug 后，默认执行：`npm run typecheck` 与 `npm test`。涉及打包/路径/asar 时再本地 `npm run build`。

## 架构要点

| 主题     | 约定                                                                             |
|--------|--------------------------------------------------------------------------------|
| 安全基线   | `contextIsolation: true`，`nodeIntegration: false`，`sandbox: true`              |
| IPC    | 使用 `handleFromMainWindow`（`ipcGuard.ts`）校验 sender 为主窗口；勿随意改回裸 `ipcMain.handle` |
| 路径     | 用户可选路径走 `pathAllowlist`；禁止路径穿越；局域网静态资源用 `safeJoinUnderRoot`                    |
| 任务     | `taskQueue` 并发 1–4；进度按 taskId 推送；任务列表可持久化（`taskStore` + `taskNormalize`）       |
| FFmpeg | 参数拼装在 `shared/ffmpegLogic.ts`；实际执行在 `electron/main/ffmpeg/`                    |
| 图片     | Sharp 为主；Magick 为可选引擎；逻辑在 `shared/imageLogic.ts` + `electron/main/image/`      |
| 打码     | 默认滤镜一次编码；可选逐帧流水线（抽帧 → Sharp → 封装）                                              |
| 更新     | electron-updater + GitHub Releases；`npm run dev` 不查真实更新                        |
| 设置     | 主进程持久化；渲染用 `useSettings` 等 composable 同步                                       |

## 编码约定

- **语言**：用户可见文案、错误产品化映射、注释优先中文；标识符保持英文。
- **TypeScript**：严格类型；跨进程载荷保持可结构化克隆（必要时用 `shared/cloneForIpc.ts`）。
- **Vue**：Composition API + `<script setup>`；状态与副作用优先放 `src/composables/`；可复用 UI 放 `src/components/`。
- **Element Plus**：沿用现有中文 locale 与主题（含暗色）模式，勿引入第二套 UI 库。
- **错误**：ffmpeg/业务错误经 `shared/errorMap.ts` 映射为用户可读中文；硬件失败可回退软件编码。
- **注释**：仅在非显而易见处添加；不要为改动堆砌解释性注释。
- **依赖**：新增 npm 包前确认必要性；主进程 native 依赖需考虑 `electron-builder` / `asarUnpack` 与 `postinstall`。
- **测试**：纯函数与边界逻辑写在 `tests/*.test.ts`；别名 `@shared` 指向 `shared/`（见 `vitest.config.ts`）。

## 安全与密钥

- **禁止**提交证书、密码、token、`.pfx` / `.p12`、App 专用密码。
- 签名相关仅通过环境变量 / CI Secrets：`CSC_*`、`WIN_CSC_*`、`APPLE_*` 等（见 `docs/RELEASE.md`）。
- 勿在日志中打印完整用户文件路径（生产环境已有脱敏约定，preload 拖拽摘要同理）。
- 改 IPC / 局域网上传（`lanServer`）时必须保持鉴权、限流与路径白名单，不得为图方便放开任意读盘。
- `.gitignore` 已忽略 `node_modules/`、`out/`、`release/`、`*.local` 等；勿强制添加这些产物。

## Git 与版本

- 提交信息使用**中文**，风格可参考现有 log：`feat:` / `fix:` / `chore:` / `docs:` / `ci:` / `style:` 等前缀。
- **未经用户明确授权，禁止**：`git add` / `commit` / `push` / `reset` / `rebase` / 强制改历史 / 删分支。
- 涉及 Git 操作先说明影响范围并征求确认。
- **未打 tag / 未明确允许前，不要修改 `package.json` 的 `version`。**
- 未 push 前的多次本地改动视为同一版本迭代；发版流程见 `docs/RELEASE.md`。
- 发版：整理 `CHANGELOG.md` →（授权后）改版本 → typecheck/test/build → tag `v*` → Release 工作流产出安装包与 `latest.yml`。

## 改动时的检查清单

1. 是否放对分层（shared vs main vs renderer）？
2. 新增 IPC 是否三端同步（types / preload / main / UI）？
3. 是否触及路径、取消、并发、硬件回退等边界？
4. 是否更新/补充 vitest？相关逻辑能否下沉到 shared 便于测？
5. 用户可见文案与 `errorMap` 是否一致、可读？
6. 跑过 `npm run typecheck` 与 `npm test`？
7. 若影响发版/更新/签名，是否对照 `docs/RELEASE.md` 与 `CHANGELOG.md`？

## 明确不要做的事

- 不要在渲染进程直接调用 ffmpeg 或读写任意磁盘路径。
- 不要绕过 `ipcGuard` / `pathAllowlist`「临时调试」后忘记恢复。
- 不要把 `node_modules`、`out/`、`release/`、证书或本机绝对路径提交进仓库。
- 不要静默升版本号或擅自打 tag / force-push。
- 不要引入与 Element Plus 冲突的另一套组件体系，或无必要的重型前端状态库。
- 不要假设系统已安装 ffmpeg；一律走应用内置二进制与现有 `bin`/`paths` 解析。

## 关键文档

| 文档                     | 用途               |
|------------------------|------------------|
| `README.md`            | 功能、开发、使用、技术说明    |
| `CHANGELOG.md`         | 版本变更权威记录         |
| `docs/RELEASE.md`      | 发版、签名、CI Secrets |
| `electron-builder.yml` | 打包与更新渠道配置        |

## 协作沟通（本仓库）

- 回复与说明默认简体中文；先结论后原因。
- 需求歧义先澄清（尤其是任务模式、编码器、输出路径、打码流水线）。
- 存在多种实现时给出推荐方案及适用场景。
- 可能影响已安装用户（设置迁移、任务持久化格式、IPC 破坏性变更）时必须明确指出风险与兼容策略。
