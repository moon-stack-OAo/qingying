# 发版说明

面向维护者的简短发版清单。勿在仓库中提交证书、密码或 token。

## 当前版本

- **1.2.0**：见 `CHANGELOG.md` / `package.json` 的 `version`
- 未完成项仅保留在 `[Unreleased]` 计划（如代码签名 / 公证）
- **重要**：当前无真实证书时**不会**实际签名；配置与 CI 接线已就绪，证书到位后按下文清单启用

## 步骤

1. **更新变更说明**  
   将 `CHANGELOG.md` 中 `[Unreleased]` 已完成项整理进即将发布的版本小节，并保留未完成项在「计划」。  
   若仍以 **1.0.0** 发首发 tag，确认 `[1.0.0]` 小节已覆盖全部能力。

2. **版本号（需授权）**  
   按语义化版本修改 `package.json` 的 `version`。  
   **约定：未打 tag 前不随意改版本号。**  
   当前整合目标为 `1.0.0`，无需递增，除非此前已发布过同 tag。

3. **本地校验（推荐）**

   ```bash
   npm ci
   npm run typecheck
   npm test
   npm run build
   ```

4. **提交并打 tag（需授权）**

   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

   也可先 `git push` 再推送 tag。tag 需匹配 `v*`（如 `v1.0.0`）。  
   若远程已存在 `v1.0.0`，需协商是否覆盖或改为 `1.0.1`（勿擅自 force）。

5. **GitHub Actions Release**  
   推送 tag 后触发 `Release` 工作流：在 Windows 上打包并上传 GitHub Release（含安装包与 `latest.yml`，供自动更新使用）。  
   **Release 正文**由 `scripts/extract-changelog.mjs` 从 `CHANGELOG.md` 对应 `## [x.y.z]` 小节生成（`release-notes.md` /
   产物旁 `RELEASE_NOTES.md`），不再仅依赖 GitHub 自动生成的 commit 列表。  
   Windows 与 **macOS** 两个 job 都会打包并上传到同一 GitHub Release。  
   未配置签名 Secrets 时：`CSC_IDENTITY_AUTO_DISCOVERY=false`，产出**未签名**包且不失败。

6. **发布后检查**
    - Release 页产物与说明是否完整
    - 客户端「检查更新」能否发现新版本
    - 安装与启动是否正常（未签名时可能有 SmartScreen / Gatekeeper 提示）

## 代码签名环境变量

`electron-builder.yml` **不写死**证书路径或密码，一律由环境变量 / CI Secrets 驱动。

### Windows

| 变量                                          | 说明                                                                      |
|---------------------------------------------|-------------------------------------------------------------------------|
| `CSC_LINK` 或 `WIN_CSC_LINK`                 | `.pfx` / `.p12` 的本地路径、`file://`、HTTPS URL，或 **base64** 内容（CI 推荐 base64） |
| `CSC_KEY_PASSWORD` 或 `WIN_CSC_KEY_PASSWORD` | 证书密码                                                                    |
| `CSC_NAME`                                  | 可选；多证书时指定主题名 / 指纹                                                       |
| `CSC_IDENTITY_AUTO_DISCOVERY`               | 无证书时设为 `false`，跳过签名                                                     |

- 现象：未签名时 SmartScreen 可能提示「未知发布者」
- 仅在 CI Secrets 或本机安全环境配置；**勿写入仓库**
- CI：优先使用 `WIN_CSC_*`；未设置时回退到 `CSC_*`（见 `.github/workflows/release.yml`）

### macOS（签名 + 公证）

| 变量                            | 说明                                                      |
|-------------------------------|---------------------------------------------------------|
| `CSC_LINK`                    | Developer ID Application 证书 `.p12` 路径或 base64           |
| `CSC_KEY_PASSWORD`            | 证书密码                                                    |
| `CSC_NAME`                    | 可选；钥匙串中有多身份时指定，如 `Developer ID Application: … (TEAMID)` |
| `APPLE_ID`                    | Apple ID（邮箱）                                            |
| `APPLE_APP_SPECIFIC_PASSWORD` | [App 专用密码](https://appleid.apple.com)（非登录密码）            |
| `APPLE_TEAM_ID`               | 团队 ID（10 位）                                             |
| `CSC_IDENTITY_AUTO_DISCOVERY` | 无证书时设为 `false`                                          |

- 正式分发还需在 `electron-builder.yml` 的 `mac` 下启用 `hardenedRuntime`、`entitlements`（仓库已提供
  `build/entitlements.mac.plist` 模板，当前为注释状态）
- 现状：CI 可产出未签名 dmg/zip；**完整签名与公证需真实 Apple 证书后按清单开启**

## 启用签名检查清单

> 仍需真实证书才能实际签名。以下仅说明「证书就绪后」如何打开。

### Windows

1. 取得代码签名证书（`.pfx`），勿提交到 Git
2. 生成本地 / CI 可用的 base64（示例，勿把输出写入仓库）：

   ```bash
   # macOS / Linux
   base64 -i certificate.pfx | tr -d '\n' > cert.b64
   # Windows PowerShell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("certificate.pfx")) | Set-Content -NoNewline cert.b64
   ```

3. 在 GitHub 仓库 **Settings → Secrets and variables → Actions** 添加：
    - `WIN_CSC_LINK`（或 `CSC_LINK`）= base64 内容
    - `WIN_CSC_KEY_PASSWORD`（或 `CSC_KEY_PASSWORD`）= 证书密码
4. 推送 `v*` tag 触发 Release；workflow 检测到 Secrets 非空后会注入并尝试签名
5. 验证：安装包属性 / `signtool verify` 显示发布者；SmartScreen 风险降低（信誉积累仍需时间）

可选本机：

```bash
# PowerShell 示例（路径按本机修改）
$env:CSC_LINK = "D:\certs\qingying.pfx"
$env:CSC_KEY_PASSWORD = "********"
npm run dist:win
```

### macOS

1. Apple Developer 账号；导出 **Developer ID Application** 为 `.p12`
2. 配置 App 专用密码与 Team ID
3. GitHub Secrets：`CSC_LINK`、`CSC_KEY_PASSWORD`，以及公证用 `APPLE_ID`、`APPLE_APP_SPECIFIC_PASSWORD`、`APPLE_TEAM_ID`（可选
   `CSC_NAME`）
4. 编辑 `electron-builder.yml`，取消 `mac` 下注释并按需调整：

   ```yaml
   mac:
     hardenedRuntime: true
     gatekeeperAssess: false
     entitlements: build/entitlements.mac.plist
     entitlementsInherit: build/entitlements.mac.plist
     # identity: 一般可省略，由 CSC_LINK / 钥匙串自动选择；多身份时再设或用 CSC_NAME
   ```

5. 推送 tag；Secrets 非空时 workflow 不再强制 `CSC_IDENTITY_AUTO_DISCOVERY=false`，将尝试签名；配置齐 Apple* 时
   electron-builder 会走公证
6. 本机验证：`spctl --assess --type execute` / 公证历史；用户侧应不再需要「右键打开」或 `xattr -cr`

若需暂时关闭 mac job，在 `release.yml` 的 `release-macos` 上加 `if: false`（注释中已说明）。

## 相关文档

- [CHANGELOG.md](../CHANGELOG.md)
- [README.md](../README.md)（功能、限制、自动更新）
