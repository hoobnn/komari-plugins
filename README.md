# komari-plugins

自用的 [Komari](https://github.com/komari-monitor/komari) 插件合集，要求 Komari `>= 1.6.0`。

## 插件列表

| 插件 | 渠道 ID | 说明 |
| --- | --- | --- |
| [`bark-plus`](#bark-plus) | `bark` | Bark 通知增强版：支持自建服务器 Basic Auth、多设备、分组、重要警告 |

## 安装

1. 运行 `npm run build`，在 `dist/` 中得到插件 ZIP。
2. 在 Komari 后台「插件」页面上传 ZIP 并启用。
3. 在「通知」设置中选择对应渠道并填写配置。

服务器访问不了 GitHub 时，插件市场装不上，直接上传 ZIP 即可。

## bark-plus

官方 [Bark 插件](https://github.com/Akizon77/komari-notification-plugins) 只发送 `device_key`，接开了 Basic Auth 的自建 bark-server 会被拒（HTTP 418）。本插件在官方插件的基础上增加：

| 配置项 | 说明 |
| --- | --- |
| Basic Auth 用户名 / 密码 | 对应 bark-server 的 `BARK_SERVER_BASIC_AUTH_USER` / `BARK_SERVER_BASIC_AUTH_PASSWORD` |
| 设备密钥 | 可填多个，英文逗号分隔，走 bark-server 的 `device_keys` 批量推送 |
| 重要警告事件 | 默认 `Offline`：节点离线改用 `critical` 级别，静音模式下也会响铃 |
| 重要警告音量 | `critical` 级别的铃声音量，0–10 |
| 分组 / 铃声 / 图标 / 点击跳转链接 / 保存到历史记录 | 对应 Bark 的 `group` / `sound` / `icon` / `url` / `isArchive` |

**与官方 Bark 插件互斥**：两者都注册渠道 ID `bark`，同时启用时后启用的会失败。沿用同一个 ID，是为了直接读取旧版内置 Bark 渠道保存的配置（`server_url`、`device_key`、`icon`、`level` 字段名保持不变）。

## 开发

- 每个插件一个目录，目录名必须等于 `komari-plugin.json` 里的 `short`。
- `npm run build` 会校验清单，把每个插件目录打包成 `dist/<short>-<version>.zip`，并生成 `dist/SHA256SUMS`。构建只打包，不执行插件代码。
- 提交信息使用 gitmoji + Conventional Commits，例如 `✨ feat(bark-plus): 支持多设备推送`。

## 许可证

[MIT](./LICENSE)。`scripts/build.mjs` 的 ZIP 写法和 `bark-plus/icon.webp` 来自 [Akizon77/komari-notification-plugins](https://github.com/Akizon77/komari-notification-plugins)（MIT）。
