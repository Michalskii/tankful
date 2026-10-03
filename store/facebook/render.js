const fs = require("fs");
const path = require("path");
const { screenshot } = require("../../tools/chrome");

const FONTS = `<link href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@900&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">`;
const GAUGE = (size, stroke = 13) => `<svg width="${size}" height="${size}" viewBox="0 0 128 128" aria-hidden="true"><path d="M31.1 91 A38 38 0 1 1 96.9 91" fill="none" stroke="#F2A516" stroke-width="${stroke}" stroke-linecap="round"/><line x1="64" y1="74" x2="87" y2="51" stroke="#FAF7F0" stroke-width="9" stroke-linecap="round"/><circle cx="64" cy="74" r="10" fill="#FAF7F0"/></svg>`;
const TICKS = `<svg class="ticks" viewBox="0 0 128 128" aria-hidden="true"><path d="M31.1 91 A38 38 0 1 1 96.9 91" fill="none" stroke="#F2A516" stroke-width="9" stroke-linecap="round"/><path d="M31.1 91 A38 38 0 1 1 96.9 91" fill="none" stroke="#FAF7F0" stroke-width="1" stroke-dasharray="1 7.95" transform="translate(64 64) scale(1.32) translate(-64 -64)"/><line x1="64" y1="74" x2="87" y2="51" stroke="#FAF7F0" stroke-width="6" stroke-linecap="round"/><circle cx="64" cy="74" r="7" fill="#FAF7F0"/></svg>`;

const profile = `<!doctype html><html><head><meta charset="utf-8"><style>
html, body { margin: 0; }
.p { width: 720px; height: 720px; display: grid; place-items: center; background: radial-gradient(circle at 50% 35%, #2B3848 0, #1B2430 62%); }
</style></head><body><div class="p">${GAUGE(470)}</div></body></html>`;

const cover = `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
html, body { margin: 0; }
.c {
  position: relative; overflow: hidden; width: 1640px; height: 624px; box-sizing: border-box;
  display: flex; flex-direction: column; justify-content: center; padding: 0 0 0 310px;
  background: radial-gradient(circle at 80% 30%, #2B3848 0, #1B2430 58%); color: #FAF7F0;
  font-family: 'IBM Plex Sans', system-ui, sans-serif;
}
.c::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 10px; background: linear-gradient(90deg, #F2A516, #F7C45E 60%, transparent); }
.ticks { position: absolute; right: 30px; top: 50%; width: 520px; height: 520px; transform: translateY(-48%); opacity: 0.28; }
.brand { font-family: 'Big Shoulders Display', sans-serif; font-weight: 900; font-size: 46px; letter-spacing: 0.04em; text-transform: uppercase; color: #F2A516; }
h1 { margin: 18px 0 22px; max-width: 860px; font-size: 76px; line-height: 1.05; font-weight: 600; letter-spacing: -0.015em; }
p { margin: 0; font-size: 32px; color: #B8C0CB; }
</style></head><body><div class="c">${TICKS}
<div class="brand">koszt-paliwa.pl</div>
<h1>Ile kosztuje paliwo na Twoją trasę?</h1>
<p>Ceny paliw w Polsce i Europie. Porady dla kierowców.</p>
</div></body></html>`;

for (const [name, html, w, h] of [["profile", profile, 720, 720], ["cover", cover, 1640, 624]]) {
  const file = path.join(__dirname, `${name}.html`);
  fs.writeFileSync(file, html);
  screenshot(file, w, h, path.join(__dirname, `fb-${name}.png`), { waitMs: 3000 });
  fs.rmSync(file);
}
