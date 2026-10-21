<div align="center">

# komari-plugins

A collection of [Komari](https://github.com/komari-monitor/komari) plugins.

[![CI](https://img.shields.io/github/actions/workflow/status/hoobnn/komari-plugins/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/hoobnn/komari-plugins/actions/workflows/ci.yml)
[![Komari](https://img.shields.io/badge/Komari-1.6.0%2B-5B5BD6?style=flat-square)](https://github.com/komari-monitor/komari)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)

[简体中文](README.md) · **English**

</div>

## Plugins

<!-- plugins:start -->
| Plugin | Description | Version | Komari |
| --- | --- | --- | --- |
| [**bark‑plus**](bark-plus/README.en.md) | <img src="bark-plus/icon.webp" width="16" height="16" alt=""> **Bark Plus Notification**<br>Send Komari notifications through Bark with Basic Auth for self-hosted servers, multiple devices, groups and critical alerts | [1.0.0](https://github.com/hoobnn/komari-plugins/releases/tag/bark-plus-v1.0.0) | `>=1.6.0` |
<!-- plugins:end -->

Click a plugin name for its options and usage.

## Installation

1. Install from the plugin market on Komari's Plugins page, or click a version above to open its Release, download `<plugin>.zip` and upload it.
2. Enable the plugin and configure it as described in its documentation.

If the server cannot reach GitHub, the plugin market cannot install anything; download the ZIP on another machine and upload it instead.

## Development

```text
komari-plugins/
├── <short>/                 # one plugin per directory, named after short in komari-plugin.json
│   ├── komari-plugin.json
│   ├── script.js
│   ├── icon.webp
│   └── README.md / README.en.md   # plugin docs, not included in the package
└── scripts/
    ├── build.mjs            # packaging: dist/<short>.zip + dist/SHA256SUMS
    └── readme.mjs           # generates the plugin table on this page from the manifests
```

| Command | Purpose |
| --- | --- |
| `pnpm build` | Build every plugin; `pnpm build <short>` builds one |
| `pnpm readme` | Update the plugin tables in both READMEs from each `komari-plugin.json`; CI checks they are current |

Package names are fixed as `<short>.zip` without a version, and timestamps are fixed, so the same source always produces the same package.

**Adding a plugin**: create a `<short>/` directory with the manifest, script, icon and READMEs, then run `pnpm readme` to update the table.

Commit messages use gitmoji + Conventional Commits with the plugin name as scope, for example `✨ feat(bark-plus): 支持多设备推送`. Run `pnpm install` after cloning to install the commit-msg hook, which rejects non-conforming messages; see [`commitlint.config.js`](commitlint.config.js) for the type-to-emoji mapping.

## License

[MIT](LICENSE)
