const fs = require("fs");
const os = require("os");
const path = require("path");
const { screenshotAsync, flattenPng } = require("./chrome");
const { context, FUELS } = require("./guides");
const { LOGO, FONTS } = require("./render-og");

const ROOT = path.join(__dirname, "..");
const { cities: CITIES } = JSON.parse(fs.readFileSync(path.join(ROOT, "site/src/lib/routes.json"), "utf8"));
const CONSUMPTION = { pb: 7, on: 6, lpg: 9 };
const DOMAIN = { pl: "koszt-paliwa.pl", en: "koszt-paliwa.pl", de: "spritkosten-europa.de" };
const INTL = { pl: "pl-PL", en: "en-GB", de: "de-DE" };
const BACKGROUND = [0x1b, 0x24, 0x30];

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const cityName = (key, lang) => CITIES[key][lang] ?? CITIES[key].en;

function duration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h ? `${h} h ${String(m).padStart(2, "0")} min` : `${m} min`;
}

function card({ lang, from, to, km, minutes, costs }) {
  const distance = new Intl.NumberFormat(INTL[lang], { maximumFractionDigits: 0 }).format(km);
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
${FONTS}
<style>
  html, body { margin: 0; background: #1B2430; }
  .card {
    width: 1200px; height: 630px; box-sizing: border-box; padding: 64px 80px;
    display: flex; flex-direction: column; justify-content: space-between;
    background: radial-gradient(circle at 85% 15%, #2B3848 0, #1B2430 55%); color: #FAF7F0;
    font-family: 'IBM Plex Sans', system-ui, sans-serif;
  }
  .top { display: flex; align-items: center; justify-content: space-between; }
  .brand { display: flex; align-items: center; gap: 18px; }
  .brand svg { width: 72px; height: 72px; }
  .wordmark { font-family: 'Big Shoulders Display', sans-serif; font-size: 52px; font-weight: 900; letter-spacing: 0.02em; text-transform: uppercase; }
  .domain { font-size: 26px; color: #B8C0CB; }
  h1 { margin: 0; font-size: 76px; line-height: 1.05; font-weight: 600; letter-spacing: -0.01em; }
  .meta { margin-top: 14px; font-size: 30px; color: #B8C0CB; }
  .costs { display: grid; grid-template-columns: repeat(${costs.length}, 1fr); gap: 24px; }
  .cost { padding: 26px 30px; background: #26313F; border-radius: 24px; }
  .label { font-size: 24px; color: #B8C0CB; }
  .label::first-letter { text-transform: uppercase; }
  .value { margin-top: 8px; font-size: 54px; font-weight: 600; color: #F2A516; font-variant-numeric: tabular-nums; line-height: 1.1; }
</style>
</head>
<body>
<div class="card">
  <div class="top">
    <div class="brand">${LOGO}<div class="wordmark">Tankful</div></div>
    <div class="domain">${DOMAIN[lang]}</div>
  </div>
  <div>
    <h1>${esc(from)} → ${esc(to)}</h1>
    <div class="meta">${distance} km · ${duration(minutes)}</div>
  </div>
  <div class="costs">
${costs.map((c) => `    <div class="cost"><div class="label">${esc(c.label)} · ${c.consumption} l/100 km</div><div class="value">≈ ${esc(c.value)}</div></div>`).join("\n")}
  </div>
</div>
</body>
</html>`;
}

const imagePath = (page) => `og/${page.file.replace(/\.html$/, ".png")}`;

async function renderRouteImages(pages, data, history, site) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tankful-route-og-"));
  const contexts = {};
  const queue = [...pages];
  const worker = async () => {
    for (let page = queue.shift(); page; page = queue.shift()) {
      const ctx = (contexts[page.lang] ??= context(page.lang, data, history));
      const slug = page.route[page.lang];
      const costs = Object.entries(CONSUMPTION)
        .map(([fuel, consumption]) => ({ label: FUELS[page.lang][fuel], consumption, value: ctx.routeCost(slug, fuel, consumption) }))
        .filter((c) => c.value);
      const html = path.join(tmp, `${page.lang}-${slug}.html`);
      fs.writeFileSync(html, card({ lang: page.lang, from: cityName(page.route.from, page.lang), to: cityName(page.route.to, page.lang), km: page.route.km, minutes: page.route.minutes, costs }));
      const out = path.join(site, imagePath(page));
      fs.mkdirSync(path.dirname(out), { recursive: true });
      await screenshotAsync(html, 1200, 630, out, { waitMs: 3000 });
      flattenPng(out, BACKGROUND);
    }
  };
  try {
    await Promise.all(Array.from({ length: 4 }, worker));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

module.exports = { renderRouteImages, imagePath };
