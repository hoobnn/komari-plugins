// 用各插件的 komari-plugin.json 生成 README.md / README.en.md 里的插件表格（<!-- plugins:start --> 到 <!-- plugins:end -->）。
// 用法：pnpm readme 更新表格；加 --check 只检查是否需要更新（CI 用），需要更新时退出码为 1。
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const repo = "https://github.com/hoobnn/komari-plugins";
const check = process.argv.includes("--check");

const LOCALES = {
  "README.md": {
    keys: ["zh_CN", "zh-CN", "zh"],
    header: "| 插件 | 说明 | 版本 | Komari |",
    readme: "README.md",
  },
  "README.en.md": {
    keys: ["en"],
    header: "| Plugin | Description | Version | Komari |",
    readme: "README.en.md",
  },
};

function localized(value, keys) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  for (const key of keys) if (value[key]) return value[key];
  return Object.values(value)[0] || "";
}

async function exists(path) {
  return stat(path).then(() => true, () => false);
}

async function plugins() {
  const list = [];
  for (const entry of (await readdir(root, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const manifestPath = join(root, entry.name, "komari-plugin.json");
    if (!(await exists(manifestPath))) continue;
    list.push({ dir: entry.name, manifest: JSON.parse(await readFile(manifestPath, "utf8")) });
  }
  return list;
}

async function renderTable(locale, list) {
  const rows = [locale.header, "| --- | --- | --- | --- |"];
  for (const { dir, manifest } of list) {
    const doc = (await exists(join(root, dir, locale.readme))) ? `${dir}/${locale.readme}` : dir;
    const name = localized(manifest.name, locale.keys);
    const description = localized(manifest.description, locale.keys);
    const tag = `${manifest.short}-v${manifest.version}`;
    // 第一列只放 short（用不断行连字符 U+2011 显示，防止在 "-" 处折行）；
    // 图标和名字放进较宽的说明列，窄列里放图标会被 GitHub 折成两行
    const icon = manifest.icon ? `<img src="${dir}/${manifest.icon}" width="16" height="16" alt=""> ` : "";
    const label = manifest.short.replaceAll("-", "‑");
    rows.push(
      `| [**${label}**](${doc}) | ${icon}**${name}**<br>${description} | [${manifest.version}](${repo}/releases/tag/${tag}) | \`${manifest.komari || "*"}\` |`,
    );
  }
  return rows.join("\n");
}

let stale = false;
const list = await plugins();
for (const [file, locale] of Object.entries(LOCALES)) {
  const path = join(root, file);
  const content = await readFile(path, "utf8");
  const pattern = /(<!-- plugins:start -->)[\s\S]*?(<!-- plugins:end -->)/;
  if (!pattern.test(content)) throw new Error(`${file}: missing <!-- plugins:start --> / <!-- plugins:end --> markers`);
  const table = await renderTable(locale, list);
  const next = content.replace(pattern, (_, start, end) => `${start}\n${table}\n${end}`);
  if (next === content) continue;
  stale = true;
  if (check) console.error(`${file}: plugin table is out of date, run pnpm readme`);
  else {
    await writeFile(path, next);
    console.log(`${file}: plugin table updated`);
  }
}
if (check && stale) process.exit(1);
