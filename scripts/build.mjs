// 把含 komari-plugin.json 的插件目录打包成 Komari 可直接上传的 dist/<short>.zip，并输出 sha256。
// 用法：pnpm build [short ...]，不传参数时构建全部插件。
// 文件名固定不带版本号：插件市场按上一版的文件名在新 Release 里找更新包。
// 只校验和打包，不执行插件代码。ZIP 写法参考 Akizon77/komari-notification-plugins（MIT）。
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { deflateRawSync } from "node:zlib";

const root = resolve(import.meta.dirname, "..");
const dist = join(root, "dist");

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const u16 = (v) => { const b = Buffer.alloc(2); b.writeUInt16LE(v); return b; };
const u32 = (v) => { const b = Buffer.alloc(4); b.writeUInt32LE(v >>> 0); return b; };

// 固定时间戳为 0，保证同样的源码打出同样的包
function createZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const fileName = Buffer.from(name, "utf8");
    const compressed = deflateRawSync(data, { level: 9 });
    const checksum = crc32(data);
    const local = Buffer.concat([
      u32(0x04034b50), u16(20), u16(0x0800), u16(8), u16(0), u16(0),
      u32(checksum), u32(compressed.length), u32(data.length), u16(fileName.length), u16(0),
      fileName, compressed,
    ]);
    centrals.push(Buffer.concat([
      u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(8), u16(0), u16(0),
      u32(checksum), u32(compressed.length), u32(data.length), u16(fileName.length),
      u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), fileName,
    ]));
    locals.push(local);
    offset += local.length;
  }
  const localData = Buffer.concat(locals);
  const centralData = Buffer.concat(centrals);
  return Buffer.concat([
    localData, centralData,
    u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length),
    u32(centralData.length), u32(localData.length), u16(0),
  ]);
}

async function pluginDirs() {
  const dirs = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const manifest = join(root, entry.name, "komari-plugin.json");
    if (await stat(manifest).then(() => true, () => false)) dirs.push(entry.name);
  }
  return dirs.sort();
}

const allDirs = await pluginDirs();
const selected = process.argv.slice(2);
for (const name of selected) {
  if (!allDirs.includes(name)) throw new Error(`unknown plugin "${name}", available: ${allDirs.join(", ")}`);
}

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const checksums = [];
for (const dir of selected.length > 0 ? selected : allDirs) {
  const sourceDir = join(root, dir);
  const manifest = JSON.parse(await readFile(join(sourceDir, "komari-plugin.json"), "utf8"));
  if (manifest.short !== dir) throw new Error(`${dir}: manifest short "${manifest.short}" must match the directory name`);
  if (!/^\d+\.\d+\.\d+$/.test(manifest.version || "")) throw new Error(`${dir}: invalid version "${manifest.version}"`);

  // 插件目录里的 README 只给人看，不打进插件包
  const files = (await readdir(sourceDir))
    .filter((name) => !name.startsWith(".") && !/^readme(\.[\w-]+)?\.md$/i.test(name))
    .sort();
  for (const required of [manifest.entry, manifest.icon].filter(Boolean)) {
    if (!files.includes(required)) throw new Error(`${dir}: missing ${required}`);
  }

  const entries = await Promise.all(files.map(async (name) => ({ name, data: await readFile(join(sourceDir, name)) })));
  const zip = createZip(entries);
  const zipName = `${dir}.zip`;
  await writeFile(join(dist, zipName), zip);
  const sha256 = createHash("sha256").update(zip).digest("hex");
  checksums.push(`${sha256}  ${zipName}`);
  console.log(`${zipName}  ${manifest.version}  ${sha256}`);
}

await writeFile(join(dist, "SHA256SUMS"), checksums.join("\n") + "\n");
