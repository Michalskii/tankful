const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { crc32 } = require("./chrome");

const ROOT = path.join(__dirname, "..");

function packageFiles() {
  const files = fs
    .readdirSync(ROOT)
    .filter((f) => /\.(js|html|css)$/.test(f) || f === "manifest.json")
    .filter((f) => fs.statSync(path.join(ROOT, f)).isFile());
  for (const lang of fs.readdirSync(path.join(ROOT, "_locales"))) files.push(`_locales/${lang}/messages.json`);
  for (const icon of fs.readdirSync(path.join(ROOT, "icons")).filter((f) => /^icon-\d+\.png$/.test(f))) files.push(`icons/${icon}`);
  return files.sort();
}

function dosTime(date) {
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

function firefoxManifest(manifest) {
  const { service_worker, ...background } = manifest.background;
  return {
    ...manifest,
    background: { ...background, scripts: ["settings.js", service_worker] },
    browser_specific_settings: {
      gecko: {
        id: "tankful@koszt-paliwa.pl",
        strict_min_version: "140.0",
        data_collection_permissions: { required: ["locationInfo"] },
      },
      gecko_android: { strict_min_version: "142.0" },
    },
  };
}

function packageEntries(target = "chrome") {
  return packageFiles().map((name) => {
    let data = fs.readFileSync(path.join(ROOT, name));
    if (name === "manifest.json" && target === "firefox") data = Buffer.from(JSON.stringify(firefoxManifest(JSON.parse(data)), null, 2) + "\n");
    return { name, data };
  });
}

function zip(entries) {
  const parts = [];
  const central = [];
  let offset = 0;
  const { time, date } = dosTime(new Date());
  for (const { name, data } of entries) {
    const packed = zlib.deflateRawSync(data, { level: 9 });
    const nameBuf = Buffer.from(name, "utf8");
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(0x0800, 8);
    entry.writeUInt16LE(8, 10);
    entry.writeUInt16LE(time, 12);
    entry.writeUInt16LE(date, 14);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(packed.length, 20);
    entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(nameBuf.length, 28);
    entry.writeUInt32LE(offset, 42);

    parts.push(local, nameBuf, packed);
    central.push(entry, nameBuf);
    offset += local.length + nameBuf.length + packed.length;
  }
  const dir = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(dir.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, dir, end]);
}

if (require.main === module) {
  const { version } = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
  const target = process.argv.includes("--target=firefox") ? "firefox" : "chrome";
  const entries = packageEntries(target);
  const out = path.join(ROOT, "dist", `tankful-${version}${target === "chrome" ? "" : `-${target}`}.zip`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, zip(entries));
  console.log(`${path.relative(ROOT, out)} – ${entries.length} files, ${Math.round(fs.statSync(out).size / 1024)} KB`);
  for (const { name } of entries) console.log("  " + name);
}

module.exports = { packageFiles, firefoxManifest };
