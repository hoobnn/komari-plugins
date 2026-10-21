<div align="center">

# komari-plugins

A collection of [Komari](https://github.com/komari-monitor/komari) plugins.

[![CI](https://img.shields.io/github/actions/workflow/status/hoobnn/komari-plugins/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/hoobnn/komari-plugins/actions/workflows/ci.yml)
[![Komari](https://img.shields.io/badge/Komari-1.6.0%2B-5B5BD6?style=flat-square)](https://github.com/komari-monitor/komari)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)

[简体中文](README.md) · **English**

</div>

## Plugins

| Plugin | Channel ID | Latest | Description |
| --- | --- | --- | --- |
| [`bark-plus`](#bark-plus) | `bark` | [![bark-plus](https://img.shields.io/github/v/release/hoobnn/komari-plugins?filter=bark-plus-v*&style=flat-square&label=)](https://github.com/hoobnn/komari-plugins/releases?q=bark-plus) | Enhanced Bark notifications: Basic Auth for self-hosted servers, multiple devices, groups, critical alerts and readable errors |

## Installation

1. Install from the plugin market on Komari's Plugins page, or download `<plugin>.zip` from [Releases](https://github.com/hoobnn/komari-plugins/releases) and upload it.
2. Enable the plugin.
3. Select the channel in the Notification settings and fill in its configuration.

If the server cannot reach GitHub, the plugin market cannot install anything; download the ZIP on another machine and upload it instead.

## bark-plus

The official [Bark plugin](https://github.com/Akizon77/komari-notification-plugins) only sends `device_key`, so a self-hosted bark-server with Basic Auth rejects it (HTTP 418), and failures only report `bark API returned non-OK status`. bark-plus adds:

| Option | Description |
| --- | --- |
| Basic Auth username / password | Match bark-server's `BARK_SERVER_BASIC_AUTH_USER` / `BARK_SERVER_BASIC_AUTH_PASSWORD` |
| Device key | Several keys separated by commas, sent through bark-server's `device_keys` batch push |
| Critical events | Defaults to `Offline`: offline alerts use the `critical` level and ring even in silent mode |
| Critical volume | Ring volume for the `critical` level, 0–10 |
| Group / sound / icon / click URL / save to history | Bark's `group` / `sound` / `icon` / `url` / `isArchive` |

**Drop-in replacement for the official Bark plugin**: it uses the same channel ID `bark` and the same `server_url`, `device_key`, `icon` and `level` field names, so configuration saved by the former built-in Bark channel or the official plugin is picked up as is. The two cannot be enabled together; whichever is enabled second fails to register.

### Errors

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

For batch pushes bark-server always reports overall success, so bark-plus checks every device and fails if any of them failed, listing the failed devices (only the first 4 characters of each key).

## Development and releases

The repository keeps one plugin per directory and releases each plugin separately, to fit the automatic listing and update rules of the [Komari plugin market](https://github.com/komari-monitor/plugin-market):

- The directory name must equal `short` in `komari-plugin.json`.
- `npm run build` builds every plugin and `npm run build -- <short>` builds one, producing `dist/<short>.zip` and `dist/SHA256SUMS`. ZIP names carry no version and timestamps are fixed, so the same source always produces the same package.
- To release, bump `version` in `komari-plugin.json`, commit, and push a `<short>-v<version>` tag (for example `bark-plus-v1.2.0`). The Release workflow builds only that plugin and attaches only `<short>.zip`.
- **Leave at least 6 hours between releases of different plugins.** The market checks the repository's latest Release only once every 6 hours, so a release that is superseded sooner can be missed. The Release workflow refuses such releases; re-run it once enough time has passed.
- To list a new plugin, publish its first Release and, while it is still the latest Release, open a [GitHub plugin issue](https://github.com/komari-monitor/plugin-market/issues/new/choose) in the plugin market with the repository URL. Later versions are picked up by the market every 6 hours through automatic PRs.
- Commit messages use gitmoji + Conventional Commits with the plugin name as scope, for example `✨ feat(bark-plus): 支持多设备推送`.

## License

[MIT](LICENSE). The ZIP writer in `scripts/build.mjs` and `bark-plus/icon.webp` come from [Akizon77/komari-notification-plugins](https://github.com/Akizon77/komari-notification-plugins) (MIT).
