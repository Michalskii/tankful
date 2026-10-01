const fs = require("fs");
const os = require("os");
const path = require("path");
const { screenshot, flattenPng } = require("./chrome");

const ROOT = path.join(__dirname, "..");
const LOGO = `<svg width="120" height="120" viewBox="0 0 128 128" aria-hidden="true"><rect x="4" y="4" width="120" height="120" rx="28" fill="#26313F"/><path d="M31.1 91 A38 38 0 1 1 96.9 91" fill="none" stroke="#F2A516" stroke-width="13" stroke-linecap="round"/><line x1="64" y1="74" x2="87" y2="51" stroke="#FAF7F0" stroke-width="9" stroke-linecap="round"/><circle cx="64" cy="74" r="10" fill="#FAF7F0"/></svg>`;

const TEXTS = {
  pl: {
    heading: "Ile kosztuje paliwo na tę trasę?",
    points: ["Aktualne ceny w Polsce i UE", "Trasy przez kilka krajów", "Auta elektryczne i koszt na osobę"],
    route: "Warszawa → Kraków",
    meta: "295 km · Benzyna 95 · 7 l/100 km",
    cost: "≈ 163 zł",
    person: "👥 4 × 41 zł",
  },
  en: {
    heading: "What will the fuel cost for this trip?",
    points: ["Live prices in Poland and the EU", "Trips through several countries", "Electric cars and cost per person"],
    route: "Berlin → Prague",
    meta: "350 km · Petrol 95 · 7 l/100 km",
    cost: "≈ €45",
    person: "👥 3 × €15",
  },
  de: {
    heading: "Was kostet der Sprit für diese Strecke?",
    points: ["Aktuelle Preise in Deutschland und der EU", "Strecken durch mehrere Länder", "E-Autos und Kosten pro Person"],
    route: "Berlin → Warschau",
    meta: "575 km · Super 95 · 7 l/100 km",
    cost: "≈ 69 €",
    person: "👥 3 × 23 €",
  },
};

function page(t) {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@900&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  html, body { margin: 0; background: #1B2430; }
  .card {
    width: 1200px; height: 630px; box-sizing: border-box; padding: 72px 80px;
    display: grid; grid-template-columns: 1fr 420px; gap: 64px; align-items: center;
    background: radial-gradient(circle at 85% 20%, #2B3848 0, #1B2430 55%); color: #FAF7F0;
    font-family: 'IBM Plex Sans', system-ui, sans-serif;
  }
  .brand { display: flex; align-items: center; gap: 24px; }
  .wordmark { font-family: 'Big Shoulders Display', sans-serif; font-size: 84px; font-weight: 900; letter-spacing: 0.02em; line-height: 0.9; text-transform: uppercase; }
  h1 { margin: 48px 0 28px; font-size: 54px; line-height: 1.1; font-weight: 600; letter-spacing: -0.01em; }
  ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 12px; font-size: 26px; color: #B8C0CB; }
  li::before { content: ""; display: inline-block; width: 12px; height: 12px; margin-right: 16px; border-radius: 50%; background: #F2A516; vertical-align: middle; }
  .trip { padding: 36px; background: #26313F; border-radius: 28px; box-shadow: 0 24px 60px rgba(0,0,0,0.35); display: grid; gap: 12px; }
  .route { font-size: 28px; font-weight: 600; }
  .meta { font-size: 20px; color: #B8C0CB; }
  .cost { margin-top: 16px; font-size: 76px; font-weight: 600; color: #F2A516; font-variant-numeric: tabular-nums; line-height: 1; }
  .person { font-size: 24px; color: #FAF7F0; }
</style>
</head>
<body>
<div class="card">
  <div>
    <div class="brand">${LOGO}<div class="wordmark">Tankful</div></div>
    <h1>${t.heading}</h1>
    <ul>${t.points.map((p) => `<li>${p}</li>`).join("")}</ul>
  </div>
  <div class="trip">
    <div class="route">${t.route}</div>
    <div class="meta">${t.meta}</div>
    <div class="cost">${t.cost}</div>
    <div class="person">${t.person}</div>
  </div>
</div>
</body>
</html>`;
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tankful-og-"));
for (const [lang, texts] of Object.entries(TEXTS)) {
  const html = path.join(tmp, `og-${lang}.html`);
  fs.writeFileSync(html, page(texts));
  const out = path.join(ROOT, "site/public", `og-${lang}.png`);
  screenshot(html, 1200, 630, out, { waitMs: 5000 });
  flattenPng(out, [0x1b, 0x24, 0x30]);
  console.log(path.relative(ROOT, out));
}
fs.rmSync(tmp, { recursive: true, force: true });
