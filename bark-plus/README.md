# Bark 通知（增强版）

**简体中文** · [English](README.en.md) · [返回插件列表](../README.md)

通过 [Bark](https://github.com/Finb/Bark) 推送 Komari 通知。可直接替换官方 [Bark 插件](https://github.com/Akizon77/komari-notification-plugins)，并补上它缺少的能力：

- **自建服务器的 Basic Auth**：官方插件只发送 `device_key`，接开了鉴权的 bark-server 会被拒（HTTP 418）。
- **多设备推送**：密钥用英文逗号分隔，走 bark-server 的批量推送，并逐台检查结果。
- **重要警告**：指定事件（默认 `Offline`）以 `critical` 级别推送，静音模式下也会响铃。
- **可读的报错**：按 bark-server 和 APNs 的返回给出中英双语的原因和处理建议。

| 项目 | 值 |
| --- | --- |
| 渠道 ID | `bark` |
| Komari | `>=1.6.0` |
| 权限 | 只用运行时的 `fetch` |

## 配置项

| 配置项 | 默认值 | 说明 |
| --- | --- | --- |
| Bark 服务器地址 | `https://api.day.app` | 官方服务器或自建 bark-server 的地址 |
| 设备密钥 | — | Bark App 中显示的设备密钥；多台设备用英文逗号分隔 |
| Basic Auth 用户名 / 密码 | — | 对应 bark-server 的 `BARK_SERVER_BASIC_AUTH_USER` / `BARK_SERVER_BASIC_AUTH_PASSWORD`，未开启鉴权时留空 |
| 通知级别 | `timeSensitive` | 普通事件的级别：`active` / `timeSensitive` / `passive` / `critical` |
| 重要警告事件 | `Offline` | 这些事件改用 `critical` 级别，英文逗号分隔，留空不启用 |
| 重要警告音量 | `5` | `critical` 级别的铃声音量，0–10 |
| 分组 | `Komari` | 通知在 Bark 历史记录中的分组 |
| 铃声 | — | Bark 内置铃声名称，例如 `alarm`、`minuet` |
| 图标 | — | 通知图标的 URL（iOS 15+） |
| 点击跳转链接 | — | 点击通知后打开的链接，例如面板地址 |
| 保存到历史记录 | 开 | 关闭后通知不会出现在 Bark 历史记录中 |

## 从官方 Bark 插件迁移

渠道 ID 同为 `bark`，`server_url`、`device_key`、`icon`、`level` 字段名不变，旧版内置 Bark 渠道和官方插件保存的配置可以直接读取。

两者注册同一个渠道 ID，不能同时启用，后启用的会注册失败。迁移时先停用并删除官方插件，再安装本插件。

## 报错说明

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

多设备推送时，bark-server 外层总是返回成功，插件会逐台检查结果，任何一台失败都会报错并列出失败的设备（密钥只显示前 4 位）。

## 致谢

基于 [Akizon77/komari-notification-plugins](https://github.com/Akizon77/komari-notification-plugins) 的 Bark 插件（MIT），图标沿用该仓库。
