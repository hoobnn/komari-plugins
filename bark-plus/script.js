const server = require("server");

const LEVELS = ["active", "timeSensitive", "passive", "critical"];

function text(zh, en) {
  return { zh_CN: zh, en };
}

const configuration = {
  type: "managed",
  name: text("Bark（增强版）", "Bark Plus"),
  data: [
    {
      key: "server_url",
      name: text("Bark 服务器地址", "Bark Server URL"),
      type: "string",
      required: true,
      default: "https://api.day.app",
      help: text(
        "官方服务器 https://api.day.app，或自建 bark-server 的地址",
        "https://api.day.app or the URL of a self-hosted bark-server",
      ),
    },
    {
      key: "device_key",
      name: text("设备密钥", "Device Key"),
      type: "string",
      required: true,
      help: text(
        "Bark App 中显示的设备密钥；多台设备用英文逗号分隔",
        "Device key shown in the Bark app; separate multiple devices with commas",
      ),
    },
    {
      key: "username",
      name: text("Basic Auth 用户名", "Basic Auth Username"),
      type: "string",
      help: text(
        "自建服务器开启 BARK_SERVER_BASIC_AUTH_USER 时填写",
        "Required when the self-hosted server sets BARK_SERVER_BASIC_AUTH_USER",
      ),
    },
    {
      key: "password",
      name: text("Basic Auth 密码", "Basic Auth Password"),
      type: "string",
      help: text(
        "自建服务器开启 BARK_SERVER_BASIC_AUTH_PASSWORD 时填写",
        "Required when the self-hosted server sets BARK_SERVER_BASIC_AUTH_PASSWORD",
      ),
    },
    {
      key: "level",
      name: text("通知级别", "Level"),
      type: "select",
      options: LEVELS.join(","),
      default: "timeSensitive",
      help: text("普通事件使用的 Bark 通知级别", "Bark level for regular events"),
    },
    {
      key: "critical_events",
      name: text("重要警告事件", "Critical Events"),
      type: "string",
      default: "Offline",
      help: text(
        "这些事件改用 critical 级别（静音模式下也会响铃），英文逗号分隔，留空则不启用",
        "Events sent with the critical level (rings even in silent mode), comma separated; leave empty to disable",
      ),
    },
    {
      key: "volume",
      name: text("重要警告音量", "Critical Volume"),
      type: "number",
      default: 5,
      help: text("critical 级别的铃声音量，0-10", "Ring volume for the critical level, 0-10"),
    },
    {
      key: "group",
      name: text("分组", "Group"),
      type: "string",
      default: "Komari",
      help: text("通知在 Bark 历史记录中的分组", "Group shown in Bark's history"),
    },
    {
      key: "sound",
      name: text("铃声", "Sound"),
      type: "string",
      help: text("Bark 内置铃声名称，例如 alarm、minuet；留空使用默认", "Bark sound name, e.g. alarm or minuet"),
    },
    {
      key: "icon",
      name: text("图标", "Icon"),
      type: "string",
      help: text("通知图标的 URL（iOS 15+）", "Icon URL (iOS 15+)"),
    },
    {
      key: "url",
      name: text("点击跳转链接", "Click URL"),
      type: "string",
      help: text("点击通知后打开的链接，例如面板地址", "URL opened when the notification is tapped"),
    },
    {
      key: "is_archive",
      name: text("保存到历史记录", "Save to History"),
      type: "switch",
      default: true,
      help: text("关闭后通知不会出现在 Bark 历史记录中", "When off, notifications are not saved in Bark's history"),
    },
  ],
};

const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

// 运行时不保证提供 Buffer / btoa，这里自己做 UTF-8 + Base64 编码
function base64(value) {
  const bytes = [];
  for (const ch of unescape(encodeURIComponent(value))) bytes.push(ch.charCodeAt(0));
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0);
    out += BASE64[(n >> 18) & 63] + BASE64[(n >> 12) & 63];
    out += i + 1 < bytes.length ? BASE64[(n >> 6) & 63] : "=";
    out += i + 2 < bytes.length ? BASE64[n & 63] : "=";
  }
  return out;
}

function splitList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function eventName(notification) {
  const event = notification.event && notification.event.event;
  return typeof event === "string" ? event : "";
}

async function sendBark(notification, config) {
  const deviceKeys = splitList(config.device_key);
  if (deviceKeys.length === 0) throw new Error("device key is required");
  if (!notification.message) throw new Error("message is empty");

  const serverURL = String(config.server_url || "https://api.day.app").trim().replace(/\/+$/, "");
  new URL(serverURL);

  const payload = { body: notification.message };
  if (deviceKeys.length === 1) payload.device_key = deviceKeys[0];
  else payload.device_keys = deviceKeys;
  if (notification.title) payload.title = notification.title;

  const critical = splitList(config.critical_events).includes(eventName(notification));
  const level = critical ? "critical" : String(config.level || "");
  if (LEVELS.includes(level)) payload.level = level;
  if (critical) {
    const volume = Number(config.volume);
    if (Number.isFinite(volume)) payload.volume = Math.min(10, Math.max(0, Math.round(volume)));
  }
  if (config.group) payload.group = String(config.group);
  if (config.sound) payload.sound = String(config.sound);
  if (config.icon) payload.icon = String(config.icon);
  if (config.url) payload.url = String(config.url);
  // Bark 的 isArchive 是字符串 "1"/"0"
  payload.isArchive = config.is_archive === false ? "0" : "1";

  const headers = { "Content-Type": "application/json; charset=utf-8" };
  if (config.username || config.password) {
    headers.Authorization = "Basic " + base64(`${config.username || ""}:${config.password || ""}`);
  }

  const response = await fetch(serverURL + "/push", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const body = await response.text();
  if (response.status === 418 || response.status === 401) {
    throw new Error(`bark server rejected the request (HTTP ${response.status}), check Basic Auth username and password`);
  }
  if (response.status !== 200) {
    throw new Error(`bark API returned HTTP ${response.status}: ${body.slice(0, 200)}`);
  }

  let result;
  try {
    result = JSON.parse(body);
  } catch (_) {
    return;
  }
  if (result.code !== 200) {
    throw new Error(`bark API error (code: ${result.code}): ${result.message || ""}`);
  }
}

function load() {
  server.registerNotificationChannel("bark", configuration, sendBark);
}
