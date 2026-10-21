<div align="center">

# komari-plugins

[Komari](https://github.com/komari-monitor/komari) 插件合集。

[![CI](https://img.shields.io/github/actions/workflow/status/hoobnn/komari-plugins/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/hoobnn/komari-plugins/actions/workflows/ci.yml)
[![Komari](https://img.shields.io/badge/Komari-1.6.0%2B-5B5BD6?style=flat-square)](https://github.com/komari-monitor/komari)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)

**简体中文** · [English](README.en.md)

</div>

## 插件列表

| 插件 | 渠道 ID | 最新版本 | 说明 |
| --- | --- | --- | --- |
| [`bark-plus`](#bark-plus) | `bark` | [![bark-plus](https://img.shields.io/github/v/release/hoobnn/komari-plugins?filter=bark-plus-v*&style=flat-square&label=)](https://github.com/hoobnn/komari-plugins/releases?q=bark-plus) | Bark 通知增强版：支持自建服务器 Basic Auth、多设备、分组、重要警告，报错可读 |

## 安装

1. 在 Komari 后台「插件」页面从插件市场安装，或从 [Releases](https://github.com/hoobnn/komari-plugins/releases) 下载 `<插件名>.zip` 后上传。
2. 启用插件。
3. 在「通知」设置中选择对应渠道并填写配置。

服务器访问不了 GitHub 时插件市场装不上，在本机下载 ZIP 再上传即可。

## bark-plus

官方 [Bark 插件](https://github.com/Akizon77/komari-notification-plugins) 只发送 `device_key`，接开了 Basic Auth 的自建 bark-server 会被拒（HTTP 418），失败时也只报 `bark API returned non-OK status`。bark-plus 在它的基础上增加：

| 配置项 | 说明 |
| --- | --- |
| Basic Auth 用户名 / 密码 | 对应 bark-server 的 `BARK_SERVER_BASIC_AUTH_USER` / `BARK_SERVER_BASIC_AUTH_PASSWORD` |
| 设备密钥 | 可填多个，英文逗号分隔，走 bark-server 的 `device_keys` 批量推送 |
| 重要警告事件 | 默认 `Offline`：节点离线改用 `critical` 级别，静音模式下也会响铃 |
| 重要警告音量 | `critical` 级别的铃声音量，0–10 |
| 分组 / 铃声 / 图标 / 点击跳转链接 / 保存到历史记录 | 对应 Bark 的 `group` / `sound` / `icon` / `url` / `isArchive` |

**可直接替换官方 Bark 插件**：渠道 ID 同为 `bark`，`server_url`、`device_key`、`icon`、`level` 字段名不变，旧版内置 Bark 渠道和官方插件保存的配置可以直接读取。两者不能同时启用，后启用的会注册失败。

### 报错说明

推送失败时，报错按「中文原因。建议 / English reason. hint（上游 / upstream: 原始返回）」显示在 Komari 里，例如：

```text
Bark 推送失败：设备密钥不存在。检查密钥是否填错，以及 Bark App 里添加的服务器是不是这一台 / Bark push failed: the device key does not exist. Check the key and that the Bark app is registered with this server（上游 / upstream: HTTP 400 failed to get device token: key not found）
```

| 上游返回（bark-server v2） | 显示的原因 |
| --- | --- |
| HTTP 418 `I'm a teapot` | Basic Auth 鉴权失败（bark-server 先鉴权，未鉴权时路径写错也是 418） |
| HTTP 404 | 服务器上没有 `/push` 接口 |
| `failed to get device token: key not found` | 设备密钥不存在 |
| `failed to get device token: …device token…` | 设备注册信息已失效 |
| `batch push count exceeds the maximum limit: N` | 设备数量超过服务器上限 |
| `request bind failed` 等 | 服务器不接受请求格式 |
| `push failed: BadDeviceToken` / `Unregistered` | 设备已失效，需要在 App 里重新注册 |
| `push failed: TooManyRequests` / `PayloadTooLarge` | 被 APNs 限流 / 内容超过 4 KB |
| `push failed: …ProviderToken` / 证书类 | bark-server 的 APNs 凭据无效 |
| `push failed:` 网络错误 | bark-server 连不上 APNs |
| 反代 5xx、非 JSON 响应、连接失败 | 服务器不可用 / 地址不对 / 连不上 |

多设备推送时，bark-server 外层总是返回成功，bark-plus 会逐台检查结果，任何一台失败都会报错并列出失败的设备（密钥只显示前 4 位）。

## 开发与发版

仓库按「一个目录一个插件、每个插件单独发版」维护，以适配 [Komari 插件市场](https://github.com/komari-monitor/plugin-market) 的自动收录和更新规则：

- 目录名必须等于 `komari-plugin.json` 里的 `short`。
- `npm run build` 构建全部插件，`npm run build -- <short>` 只构建一个；产物是 `dist/<short>.zip` 和 `dist/SHA256SUMS`。ZIP 文件名固定、不带版本号，时间戳固定，同样的源码打出同样的包。
- 发版：改 `komari-plugin.json` 的 `version` 并提交，再推送 `<short>-v<version>` 标签（例如 `bark-plus-v1.0.0`）。Release 工作流只构建这一个插件，Release 里只放 `<short>.zip`。
- **两个插件发版至少间隔 6 小时**。插件市场每 6 小时只检查一次仓库的「最新 Release」，间隔太短，前一个插件的更新会被漏掉。Release 工作流会检查并拦下，等够时间后重跑即可。
- 新插件上架：先发它的第一个 Release，在它还是最新 Release 时到插件市场提交 [GitHub 插件 Issue](https://github.com/komari-monitor/plugin-market/issues/new/choose)，只需填仓库地址。之后的版本由市场每 6 小时自动拉取并开 PR。
- 提交信息使用 gitmoji + Conventional Commits，scope 写插件名，例如 `✨ feat(bark-plus): 支持多设备推送`。

## 许可证

[MIT](LICENSE)。`scripts/build.mjs` 的 ZIP 写法和 `bark-plus/icon.webp` 来自 [Akizon77/komari-notification-plugins](https://github.com/Akizon77/komari-notification-plugins)（MIT）。
