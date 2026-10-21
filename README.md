<div align="center">

# komari-plugins

[Komari](https://github.com/komari-monitor/komari) 插件合集。

[![CI](https://img.shields.io/github/actions/workflow/status/hoobnn/komari-plugins/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/hoobnn/komari-plugins/actions/workflows/ci.yml)
[![Komari](https://img.shields.io/badge/Komari-1.6.0%2B-5B5BD6?style=flat-square)](https://github.com/komari-monitor/komari)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)

**简体中文** · [English](README.en.md)

</div>

## 插件

<!-- plugins:start -->
| 插件 | 说明 | 版本 | Komari |
| --- | --- | --- | --- |
| [**bark‑plus**](bark-plus/README.md) | <img src="bark-plus/icon.webp" width="16" height="16" alt=""> **Bark 通知（增强版）**<br>通过 Bark 发送 Komari 通知，支持自建服务器 Basic Auth、多设备、分组与重要警告 | [1.0.0](https://github.com/hoobnn/komari-plugins/releases/tag/bark-plus-v1.0.0) | `>=1.6.0` |
<!-- plugins:end -->

点插件名查看配置项和使用说明。

## 安装

1. 在 Komari 后台「插件」页面从插件市场安装；或在上表点版本号进入 Release，下载 `<插件名>.zip` 后上传。
2. 启用插件，按插件说明完成配置。

服务器访问不了 GitHub 时插件市场装不上，在本机下载 ZIP 再上传即可。

## 开发

```text
komari-plugins/
├── <short>/                 # 一个插件一个目录，目录名等于 komari-plugin.json 的 short
│   ├── komari-plugin.json
│   ├── script.js
│   ├── icon.webp
│   └── README.md / README.en.md   # 插件说明，不会打进插件包
└── scripts/
    ├── build.mjs            # 打包：dist/<short>.zip + dist/SHA256SUMS
    └── readme.mjs           # 用各插件清单生成本页的插件表格
```

| 命令 | 作用 |
| --- | --- |
| `pnpm build` | 构建全部插件；`pnpm build <short>` 只构建一个 |
| `pnpm readme` | 按各插件的 `komari-plugin.json` 更新中英 README 的插件表格，CI 会检查是否最新 |

插件包文件名固定为 `<short>.zip`、不带版本号，时间戳固定，同样的源码打出同样的包。

**新增插件**：建 `<short>/` 目录写好清单、脚本、图标和中英 README，运行 `pnpm readme` 更新表格。

提交信息使用 gitmoji + Conventional Commits，scope 写插件名，例如 `✨ feat(bark-plus): 支持多设备推送`。克隆后先运行 `pnpm install` 装好 commit-msg 钩子，不合规的提交会被拒；type 与 emoji 的对应见 [`commitlint.config.js`](commitlint.config.js)。

## 许可证

[MIT](LICENSE)
