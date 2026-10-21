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

// 错误统一写成「原因。建议 / reason. hint（上游 / upstream: 原文）」，Komari 会原样显示在 RPC 错误里
function fail(reason, hint, detail) {
  let message = `Bark 推送失败：${reason.zh_CN}${hint ? `。${hint.zh_CN}` : ""}`;
  message += ` / Bark push failed: ${reason.en}${hint ? `. ${hint.en}` : ""}`;
  if (detail) message += `（上游 / upstream: ${String(detail).slice(0, 200)}）`;
  throw new Error(message);
}

function maskKey(key) {
  return key.length > 6 ? `${key.slice(0, 4)}…` : "…";
}

const RETRY = text("稍后再试", "Try again later");

const APNS_ERRORS = [
  [
    /BadDeviceToken|Unregistered|DeviceTokenNotForTopic/,
    text("设备已失效", "the device is no longer registered"),
    text(
      "Bark App 可能被卸载或重装过，在手机上打开 Bark App 重新注册（服务器已自动清掉旧令牌）",
      "The Bark app may have been reinstalled; open it to register again (the server has removed the old token)",
    ),
  ],
  [/TooManyRequests/, text("推送太频繁，被 APNs 限流", "rate limited by APNs"), RETRY],
  [
    /PayloadTooLarge/,
    text("通知内容过长", "the notification is too large"),
    text("APNs 限制 4 KB，缩短消息模板", "APNs allows 4 KB; shorten the message template"),
  ],
  [
    /ProviderToken|Certificate|Forbidden/,
    text("bark-server 的 APNs 推送凭据无效", "bark-server has invalid APNs credentials"),
    text("检查服务器上的推送证书或密钥", "Check the push certificate or key on the server"),
  ],
  [/InternalServerError|ServiceUnavailable|Shutdown/, text("APNs 服务暂时不可用", "APNs is temporarily unavailable"), RETRY],
  [
    /timeout|dial|EOF|no such host|connection|tls/i,
    text("bark-server 连不上 APNs", "bark-server cannot reach APNs"),
    text("检查服务器到 api.push.apple.com 的网络", "Check the server's network access to api.push.apple.com"),
  ],
];

// 按 bark-server v2 的返回（route_auth.go / route_push.go）把错误翻译成 [原因, 建议]
function explain(status, message) {
  const raw = String(message || "");
  if (status === 418 || status === 401) {
    return [
      text("Basic Auth 鉴权失败", "Basic Auth was rejected"),
      text(
        "检查用户名和密码是否与 bark-server 的 BARK_SERVER_BASIC_AUTH_USER / BARK_SERVER_BASIC_AUTH_PASSWORD 一致",
        "Check that the username and password match BARK_SERVER_BASIC_AUTH_USER / BARK_SERVER_BASIC_AUTH_PASSWORD",
      ),
    ];
  }
  if (status === 404) {
    return [
      text("服务器上没有 /push 接口", "the server has no /push endpoint"),
      text("检查 Bark 服务器地址，带路径前缀部署时要写全", "Check the server URL, including any path prefix"),
    ];
  }
  if (/device key is empty/.test(raw)) {
    return [text("服务器没有收到设备密钥", "the server received no device key"), text("检查设备密钥是否填写", "Check the device key")];
  }
  if (/key not found/.test(raw)) {
    return [
      text("设备密钥不存在", "the device key does not exist"),
      text(
        "检查密钥是否填错，以及 Bark App 里添加的服务器是不是这一台",
        "Check the key and that the Bark app is registered with this server",
      ),
    ];
  }
  if (/device token/.test(raw)) {
    return [
      text("设备注册信息已失效", "the device registration is invalid"),
      text("在手机上打开 Bark App 重新注册到这台服务器", "Open the Bark app to register with this server again"),
    ];
  }
  const limit = raw.match(/batch push count exceeds the maximum limit: (\d+)/);
  if (limit) {
    return [
      text(`设备数量超过服务器上限 ${limit[1]} 台`, `more devices than the server limit of ${limit[1]}`),
      text("减少设备密钥，或调大 bark-server 的 max-batch-push-count", "Use fewer device keys or raise max-batch-push-count"),
    ];
  }
  if (/request bind failed|invalid type for device_keys|url path parse failed/.test(raw)) {
    return [
      text("服务器不接受请求格式", "the server rejected the request format"),
      text("bark-server 可能版本过旧，需要 v2 及以上", "bark-server may be outdated; v2 or later is required"),
    ];
  }
  const apns = raw.match(/push failed: (.*)/);
  if (apns) {
    const matched = APNS_ERRORS.find(([pattern]) => pattern.test(apns[1]));
    return matched ? [matched[1], matched[2]] : [text(`APNs 拒绝推送（${apns[1]}）`, `APNs rejected the push (${apns[1]})`), null];
  }
  if (status >= 500) {
    return [
      text(`Bark 服务器不可用（HTTP ${status}）`, `the Bark server is unavailable (HTTP ${status})`),
      text("反向代理后面的 bark-server 可能没在运行", "bark-server behind the reverse proxy may be down"),
    ];
  }
  return [text(`服务器返回 HTTP ${status}`, `the server returned HTTP ${status}`), null];
}

function checkBatch(results, deviceKeys) {
  const failures = results.filter((item) => item && item.code !== 200);
  if (failures.length === 0) return;
  const reasons = failures.map((item) => [maskKey(String(item.device_key || "")), explain(item.code, item.message)[0]]);
  const sameCause = new Set(failures.map((item) => item.message)).size === 1;
  fail(
    text(
      `${deviceKeys.length} 台设备中 ${failures.length} 台失败：${reasons.map(([key, r]) => `${key} ${r.zh_CN}`).join("；")}`,
      `${failures.length} of ${deviceKeys.length} devices failed: ${reasons.map(([key, r]) => `${key} ${r.en}`).join("; ")}`,
    ),
    sameCause ? explain(failures[0].code, failures[0].message)[1] : null,
    failures.map((item) => item.message).filter(Boolean).join("; "),
  );
}

async function sendBark(notification, config) {
  const deviceKeys = splitList(config.device_key);
  if (deviceKeys.length === 0) {
    fail(
      text("未填写设备密钥", "no device key is configured"),
      text("在通知渠道配置里填写 Bark App 中显示的设备密钥", "Enter the device key shown in the Bark app"),
    );
  }
  if (!notification.message) fail(text("通知内容为空", "the message is empty"), text("检查通知模板", "Check the notification template"));

  const serverURL = String(config.server_url || "https://api.day.app").trim().replace(/\/+$/, "");
  try {
    new URL(serverURL);
  } catch (_) {
    fail(
      text(`服务器地址格式不对：${serverURL}`, `invalid server URL: ${serverURL}`),
      text("应类似 https://api.day.app", "It should look like https://api.day.app"),
    );
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
    fail(
      text(`连不上 Bark 服务器 ${serverURL}`, `cannot connect to the Bark server ${serverURL}`),
      text("检查地址、DNS 和网络", "Check the URL, DNS and network"),
      err && err.message ? err.message : err,
    );
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
    fail(
      text("服务器返回的不是 Bark 响应", "the response is not from Bark"),
      text("检查地址是否指向 bark-server", "Check that the URL points to bark-server"),
      upstream,
    );
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
