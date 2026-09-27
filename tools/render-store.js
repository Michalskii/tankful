const fs = require("fs");
const os = require("os");
const path = require("path");
const { screenshot, flattenPng } = require("./chrome");

const ROOT = path.join(__dirname, "..");
const SHOT = { width: 1280, height: 800 };

const GRAPHICS = [
  { src: "store/promo-tile.html", out: "store/promo-tile-440x280.png", width: 440, height: 280 },
];

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tankful-store-"));
for (const lang of fs.readdirSync(path.join(ROOT, "store/raw"))) {
  const dir = path.join(ROOT, "store/raw", lang);
  for (const file of fs.readdirSync(dir).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort()) {
    const page = path.join(tmp, `${lang}-${file}.html`);
    const img = `file:///${path.join(dir, file).replace(/\\/g, "/")}`;
    fs.writeFileSync(page, `<!doctype html><html><head><style>html,body{margin:0;overflow:hidden}img{display:block}</style></head><body><img src="${img}"></body></html>`);
    fs.mkdirSync(path.join(ROOT, "store", lang), { recursive: true });
    GRAPHICS.push({ page, out: `store/${lang}/screenshot-${file.replace(/\.\w+$/, "")}.png`, ...SHOT });
  }
}

for (const g of GRAPHICS) {
  const out = path.join(ROOT, g.out);
  screenshot(g.page || path.join(ROOT, g.src), g.width, g.height, out, { waitMs: 5000 });
  flattenPng(out, [0x1b, 0x24, 0x30]);
  console.log(g.out);
}
fs.rmSync(tmp, { recursive: true, force: true });
