const fs = require("fs");
const os = require("os");
const path = require("path");
const { screenshot } = require("./chrome");

const ROOT = path.join(__dirname, "..");
const svg = fs.readFileSync(path.join(ROOT, "icons/icon.svg"), "utf8");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tankful-icons-"));

const ICONS = [
  ...[16, 32, 48].map((size) => ({ name: `icon-${size}.png`, size, viewBox: "0 0 128 128" })),
  { name: "icon-128.png", size: 128, viewBox: "-16 -16 160 160" },
  { name: "app-192.png", size: 192, viewBox: "0 0 128 128" },
  { name: "app-512.png", size: 512, viewBox: "0 0 128 128" },
  { name: "app-maskable-512.png", size: 512, viewBox: "-8 -8 144 144", fullBleed: true },
  { name: "apple-touch-icon.png", size: 180, viewBox: "-4 -4 136 136", fullBleed: true },
];

for (const { name, size, viewBox, fullBleed } of ICONS) {
  let icon = svg
    .replace(/<!--[\s\S]*?-->\s*/g, "")
    .replace(/width="128" height="128"/, `width="${size}" height="${size}"`)
    .replace(/viewBox="[^"]*"/, `viewBox="${viewBox}"`);
  if (fullBleed) icon = icon.replace(/<rect [^>]*\/>/, '<rect x="-64" y="-64" width="256" height="256" fill="#1B2430"/>');
  const page = path.join(tmp, name.replace(/\.png$/, ".html"));
  fs.writeFileSync(page, `<!doctype html><html><head><style>html,body{margin:0;background:transparent}svg{display:block}</style></head><body>${icon}</body></html>`);
  const out = path.join(ROOT, "icons", name);
  screenshot(page, size, size, out, { transparent: !fullBleed });
  console.log("icons/" + name);
}

fs.rmSync(tmp, { recursive: true, force: true });
