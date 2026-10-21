# Bark Plus Notification

[简体中文](README.md) · **English** · [Back to plugin list](../README.en.md)

Sends Komari notifications through [Bark](https://github.com/Finb/Bark). A drop-in replacement for the official [Bark plugin](https://github.com/Akizon77/komari-notification-plugins) that adds what it lacks:

- **Basic Auth for self-hosted servers**: the official plugin only sends `device_key`, so a bark-server with authentication rejects it (HTTP 418).
- **Multiple devices**: comma-separated keys go through bark-server's batch push, with every device's result checked.
- **Critical alerts**: selected events (default `Offline`) use the `critical` level and ring even in silent mode.
- **Readable errors**: bilingual reasons and hints mapped from bark-server and APNs responses.

| Item | Value |
| --- | --- |
| Channel ID | `bark` |
| Komari | `>=1.6.0` |
| Permissions | Runtime `fetch` only |

## Options

| Option | Default | Description |
| --- | --- | --- |
| Bark Server URL | `https://api.day.app` | The official server or a self-hosted bark-server |
| Device Key | — | Device key shown in the Bark app; separate multiple devices with commas |
| Basic Auth Username / Password | — | bark-server's `BARK_SERVER_BASIC_AUTH_USER` / `BARK_SERVER_BASIC_AUTH_PASSWORD`; leave empty without authentication |
| Level | `timeSensitive` | Level for regular events: `active` / `timeSensitive` / `passive` / `critical` |
| Critical Events | `Offline` | Events sent with the `critical` level, comma separated; leave empty to disable |
| Critical Volume | `5` | Ring volume for the `critical` level, 0–10 |
| Group | `Komari` | Group shown in Bark's history |
| Sound | — | Bark sound name, e.g. `alarm` or `minuet` |
| Icon | — | Icon URL (iOS 15+) |
| Click URL | — | URL opened when the notification is tapped, e.g. your panel |
| Save to History | On | When off, notifications are not saved in Bark's history |

## Migrating from the official Bark plugin

It uses the same channel ID `bark` and the same `server_url`, `device_key`, `icon` and `level` field names, so configuration saved by the former built-in Bark channel or the official plugin is picked up as is.

Both register the same channel ID and cannot be enabled together; whichever is enabled second fails to register. Disable and delete the official plugin before installing this one.

## Errors

Failures are shown in Komari as "Chinese reason. hint / English reason. hint (upstream: raw response)", for example:

```text
Bark 推送失败：设备密钥不存在。检查密钥是否填错，以及 Bark App 里添加的服务器是不是这一台 / Bark push failed: the device key does not exist. Check the key and that the Bark app is registered with this server（上游 / upstream: HTTP 400 failed to get device token: key not found）
```

| Upstream response (bark-server v2) | Reported reason |
| --- | --- |
| HTTP 418 `I'm a teapot` | Basic Auth was rejected (bark-server authenticates first, so a wrong path also returns 418 without credentials) |
| HTTP 404 | The server has no `/push` endpoint |
| `failed to get device token: key not found` | The device key does not exist |
| `failed to get device token: …device token…` | The device registration is invalid |
| `batch push count exceeds the maximum limit: N` | More devices than the server limit |
| `request bind failed`, etc. | The server rejected the request format |
| `push failed: BadDeviceToken` / `Unregistered` | The device is no longer registered; open the app to register again |
| `push failed: TooManyRequests` / `PayloadTooLarge` | Rate limited by APNs / payload over 4 KB |
| `push failed: …ProviderToken` / certificate errors | bark-server has invalid APNs credentials |
| `push failed:` network errors | bark-server cannot reach APNs |
| Proxy 5xx, non-JSON response, connection failure | Server unavailable / wrong URL / unreachable |

For batch pushes bark-server always reports overall success, so the plugin checks every device and fails if any of them failed, listing the failed devices (only the first 4 characters of each key).

## Credits

Based on the Bark plugin from [Akizon77/komari-notification-plugins](https://github.com/Akizon77/komari-notification-plugins) (MIT); the icon comes from that repository.
