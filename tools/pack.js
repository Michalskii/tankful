// Buduje paczkę do Chrome Web Store: node tools/pack.js → dist/tankful-<wersja>.zip
// Pliki z białej listy (nie przez wykluczanie), żeby do sklepu nie trafiły testy, narzędzia ani grafiki sklepu.
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { crc32 } = require("./chrome");

const ROOT = path.join(__dirname, "..");

// Pliki rozszerzenia: skrypty, strony i style w katalogu głównym, manifest, tłumaczenia i ikony PNG.
function packageFiles() {
  const files = fs
    .readdirSync(ROOT)
    .filter((f) => /\.(js|html|css)$/.test(f) || f === "manifest.json")
    .filter((f) => fs.statSync(path.join(ROOT, f)).isFile());
  for (const lang of fs.readdirSync(path.join(ROOT, "_locales"))) files.push(`_locales/${lang}/messages.json`);
  for (const icon of fs.readdirSync(path.join(ROOT, "icons")).filter((f) => f.endsWith(".png"))) files.push(`icons/${icon}`);
  return files.sort();
}

// Czas DOS dla nagłówków ZIP.
function dosTime(date) {
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

function zip(files) {
  const parts = [];
  const central = [];
  let offset = 0;
  const { time, date } = dosTime(new Date());
  for (const name of files) {
    const data = fs.readFileSync(path.join(ROOT, name));
    const packed = zlib.deflateRawSync(data, { level: 9 });
    const nameBuf = Buffer.from(name, "utf8");
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // wersja potrzebna do rozpakowania
    local.writeUInt16LE(0x0800, 6); // nazwy w UTF-8
    local.writeUInt16LE(8, 8); // deflate
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
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(dir.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, dir, end]);
}

if (require.main === module) {
  const { version } = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
  const files = packageFiles();
  const out = path.join(ROOT, "dist", `tankful-${version}.zip`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, zip(files));
  console.log(`${path.relative(ROOT, out)} – ${files.length} plików, ${Math.round(fs.statSync(out).size / 1024)} KB`);
  for (const f of files) console.log("  " + f);
}

module.exports = { packageFiles };
