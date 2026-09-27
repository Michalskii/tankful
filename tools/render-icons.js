const fs = require("fs");
const os = require("os");
const path = require("path");
const { screenshot } = require("./chrome");

const ROOT = path.join(__dirname, "..");
const svg = fs.readFileSync(path.join(ROOT, "icons/icon.svg"), "utf8");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tankful-icons-"));

for (const size of [16, 32, 48, 128]) {
  const viewBox = size === 128 ? "-16 -16 160 160" : "0 0 128 128";
  const icon = svg
    .replace(/width="128" height="128"/, `width="${size}" height="${size}"`)
    .replace(/viewBox="[^"]*"/, `viewBox="${viewBox}"`);
  const page = path.join(tmp, `icon-${size}.html`);
  fs.writeFileSync(page, `<!doctype html><html><head><style>html,body{margin:0;background:transparent}svg{display:block}</style></head><body>${icon}</body></html>`);
  const out = path.join(ROOT, "icons", `icon-${size}.png`);
  screenshot(page, size, size, out, { transparent: true });
  console.log("icons/" + path.basename(out));
}

fs.rmSync(tmp, { recursive: true, force: true });
