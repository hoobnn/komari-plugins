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

// 错误统一写成「原因。建议（上游原文）」，Komari 会把它原样显示在 RPC 错误里
function fail(reason, hint, detail) {
  let message = `Bark 推送失败：${reason}`;
  if (hint) message += `。${hint}`;
  if (detail) message += `（上游：${String(detail).slice(0, 200)}）`;
  throw new Error(message);
}

function maskKey(key) {
  return key.length > 6 ? `${key.slice(0, 4)}…` : "…";
}

const APNS_ERRORS = [
  [/BadDeviceToken|Unregistered|DeviceTokenNotForTopic/, "设备已失效", "Bark App 可能被卸载或重装过，在手机上打开 Bark App 重新注册（服务器已自动清掉旧令牌）"],
  [/TooManyRequests/, "推送太频繁，被 APNs 限流", "稍后再试"],
  [/PayloadTooLarge/, "通知内容过长", "APNs 限制 4 KB，缩短消息模板"],
  [/ProviderToken|Certificate|Forbidden/, "bark-server 的 APNs 推送凭据无效", "检查服务器上的推送证书或密钥"],
  [/InternalServerError|ServiceUnavailable|Shutdown/, "APNs 服务暂时不可用", "稍后再试"],
  [/timeout|dial|EOF|no such host|connection|tls/i, "bark-server 连不上 APNs", "检查服务器到 api.push.apple.com 的网络"],
];

// 按 bark-server v2 的返回（route_auth.go / route_push.go）把错误翻译成 [原因, 建议]
function explain(status, message) {
  const text = String(message || "");
  if (status === 418 || status === 401) {
    return ["Basic Auth 鉴权失败", "检查用户名和密码是否与 bark-server 的 BARK_SERVER_BASIC_AUTH_USER / BARK_SERVER_BASIC_AUTH_PASSWORD 一致"];
  }
  if (status === 404) return ["服务器上没有 /push 接口", "检查 Bark 服务器地址，带路径前缀部署时要写全"];
  if (/device key is empty/.test(text)) return ["服务器没有收到设备密钥", "检查设备密钥是否填写"];
  if (/key not found/.test(text)) {
    return ["设备密钥不存在", "检查密钥是否填错，以及 Bark App 里添加的服务器是不是这一台"];
  }
  if (/device token/.test(text)) return ["设备注册信息已失效", "在手机上打开 Bark App 重新注册到这台服务器"];
  const limit = text.match(/batch push count exceeds the maximum limit: (\d+)/);
  if (limit) return [`设备数量超过服务器上限 ${limit[1]} 台`, "减少设备密钥，或调大 bark-server 的 max-batch-push-count"];
  if (/request bind failed|invalid type for device_keys|url path parse failed/.test(text)) {
    return ["服务器不接受请求格式", "bark-server 可能版本过旧，需要 v2 及以上"];
  }
  const apns = text.match(/push failed: (.*)/);
  if (apns) {
    const matched = APNS_ERRORS.find(([pattern]) => pattern.test(apns[1]));
    return matched ? [matched[1], matched[2]] : [`APNs 拒绝推送（${apns[1]}）`, ""];
  }
  if (status >= 500) return [`Bark 服务器不可用（HTTP ${status}）`, "反向代理后面的 bark-server 可能没在运行"];
  return [`服务器返回 HTTP ${status}`, ""];
}

function checkBatch(results, deviceKeys) {
  const failures = results.filter((item) => item && item.code !== 200);
  if (failures.length === 0) return;
  const reasons = failures.map((item) => {
    const [reason] = explain(item.code, item.message);
    return `${maskKey(String(item.device_key || ""))} ${reason}`;
  });
  const [, hint] = explain(failures[0].code, failures[0].message);
  fail(
    `${deviceKeys.length} 台设备中 ${failures.length} 台失败：${reasons.join("；")}`,
    failures.length === 1 || new Set(failures.map((item) => item.message)).size === 1 ? hint : "",
    failures.map((item) => item.message).filter(Boolean).join("; "),
  );
}

async function sendBark(notification, config) {
  const deviceKeys = splitList(config.device_key);
  if (deviceKeys.length === 0) fail("未填写设备密钥", "在通知渠道配置里填写 Bark App 中显示的设备密钥");
  if (!notification.message) fail("通知内容为空", "检查通知模板");

  const serverURL = String(config.server_url || "https://api.day.app").trim().replace(/\/+$/, "");
  try {
    new URL(serverURL);
  } catch (_) {
    fail(`服务器地址格式不对：${serverURL}`, "应类似 https://api.day.app");
  }

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

  let response;
  try {
    response = await fetch(serverURL + "/push", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
  } catch (err) {
    fail(`连不上 Bark 服务器 ${serverURL}`, "检查地址、DNS 和网络", err && err.message ? err.message : err);
  }
  const body = await response.text();

  let result = null;
  try {
    result = JSON.parse(body);
  } catch (_) {
    // 418 和反代的 5xx 页面都不是 JSON，交给下面按状态码判断
  }
  const upstream = `HTTP ${response.status} ${(result && result.message) || body}`.trim();
  if (response.status !== 200) {
    const [reason, hint] = explain(response.status, result && result.message);
    fail(reason, hint, upstream);
  }
  if (!result || typeof result !== "object") {
    fail("服务器返回的不是 Bark 响应", "检查地址是否指向 bark-server", upstream);
  }
  if (result.code !== 200) {
    const [reason, hint] = explain(result.code, result.message);
    fail(reason, hint, upstream);
  }
  // 批量推送时外层总是 200，每台设备的结果在 data 里
  if (Array.isArray(result.data)) checkBatch(result.data, deviceKeys);
}

function load() {
  server.registerNotificationChannel("bark", configuration, sendBark);
}
