const fs = require("fs");
const path = require("path");
const { screenshot } = require("./chrome");
const { context, loadGuides } = require("./guides");

const ROOT = path.join(__dirname, "..");
const SITE = "https://koszt-paliwa.pl/";
const OUT = path.join(ROOT, "store/facebook/posts");
const REF = "?ref=fb";
const EU = ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE"];
const TIP_GROUPS = ["lpg", "lpg-calc", "fuel-saving", "consumption", "mileage", "border", "split", "per-100-km", "how-to-calculate", "commute", "ev-trip", "germany", "czechia"];
const WEEKEND_ROUTES = ["warszawa-gdansk", "krakow-zakopane", "wroclaw-praga", "warszawa-zakopane", "poznan-berlin", "krakow-budapeszt", "katowice-gdansk", "warszawa-wilno", "wroclaw-berlin", "krakow-wieden", "lodz-gdansk", "szczecin-berlin"];

const args = process.argv.slice(2);
const local = args.includes("--local");
const dateArg = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));

const money = (v, digits = 2) => new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v);
const euro = (v) => new Intl.NumberFormat("pl-PL", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
const STEADY = 0.02;
const signed = (v) => (Math.abs(v) < STEADY ? "bez zmian" : `${v > 0 ? "+" : "−"}${money(Math.abs(v))}`);
const km = (v) => new Intl.NumberFormat("pl-PL").format(Math.round(v));
const day = (iso) => new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(iso));
const countryIn = { MT: "na Malcie", DK: "w Danii", NL: "w Holandii", FI: "w Finlandii", BG: "w Bułgarii", CY: "na Cyprze", RO: "w Rumunii", SI: "w Słowenii", LU: "w Luksemburgu", HU: "na Węgrzech", LT: "na Litwie", LV: "na Łotwie", EE: "w Estonii", CZ: "w Czechach", SK: "na Słowacji", DE: "w Niemczech", AT: "w Austrii", FR: "we Francji", IT: "we Włoszech", ES: "w Hiszpanii", PT: "w Portugalii", GR: "w Grecji", IE: "w Irlandii", BE: "w Belgii", SE: "w Szwecji", HR: "w Chorwacji", PL: "w Polsce" };
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const weekNumber = (iso) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  return Math.ceil(((d - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
};

async function load(name, file) {
  if (local) return JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8"));
  const res = await fetch(`${SITE}${name}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  return res.json();
}

const FONTS = `<link href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@900&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">`;
const GAUGE = `<svg class="gauge" viewBox="0 0 128 128" aria-hidden="true"><path d="M31.1 91 A38 38 0 1 1 96.9 91" fill="none" stroke="#F2A516" stroke-width="13" stroke-linecap="round"/><line x1="64" y1="74" x2="87" y2="51" stroke="#FAF7F0" stroke-width="9" stroke-linecap="round"/><circle cx="64" cy="74" r="10" fill="#FAF7F0"/></svg>`;
const BASE_CSS = `
html, body { margin: 0; }
.card { position: relative; overflow: hidden; width: 1080px; height: 1350px; box-sizing: border-box; padding: 80px 80px 72px; display: flex; flex-direction: column;
  background: radial-gradient(circle at 85% 12%, #2B3848 0, #1B2430 55%); color: #FAF7F0; font-family: 'IBM Plex Sans', system-ui, sans-serif; }
.card::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 12px; background: linear-gradient(90deg, #F2A516, #F7C45E 60%, transparent); }
.top { display: flex; align-items: center; gap: 18px; }
.gauge { width: 64px; height: 64px; }
.brand { font-family: 'Big Shoulders Display', sans-serif; font-weight: 900; font-size: 40px; letter-spacing: 0.04em; text-transform: uppercase; color: #F2A516; }
h1 { margin: 56px 0 8px; font-size: 76px; line-height: 1.05; font-weight: 600; letter-spacing: -0.015em; }
.sub { margin: 0; font-size: 32px; color: #B8C0CB; }
.foot { margin-top: auto; font-size: 30px; color: #B8C0CB; }
.foot b { color: #FAF7F0; font-weight: 600; }
`;

function render(html, file) {
  const htmlFile = file.replace(/\.png$/, ".html");
  fs.writeFileSync(htmlFile, html);
  screenshot(htmlFile, 1080, 1350, file, { waitMs: 3000 });
  fs.rmSync(htmlFile);
}

function weeklyPost(data, history) {
  const eur = data.nbpRates.rates.EUR;
  const pl = data.fuelPrices.prices;
  const last = history.dates.length - 1;
  const was = (fuel) => history.prices.PL[fuel][last] * history.plnPerEur[last];
  const since = history.dates[last];
  const ranked = EU.map((cc) => ({ cc, pb: cc === "PL" ? pl.pb / eur : data.euPrices.prices[cc]?.pb }))
    .filter((r) => r.pb)
    .sort((a, b) => a.pb - b.pb);
  const rank = ranked.findIndex((r) => r.cc === "PL") + 1;
  const cheapest = ranked[0];
  const priciest = ranked.at(-1);
  const rows = [["Benzyna 95", "pb"], ["Diesel", "on"], ["LPG", "lpg"]].map(([name, fuel]) => ({ name, now: pl[fuel], change: pl[fuel] - was(fuel) }));

  const html = `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>${BASE_CSS}
.rows { margin-top: 64px; display: grid; gap: 22px; }
.row { display: grid; grid-template-columns: 1fr auto; align-items: center; padding: 30px 40px; border-radius: 28px; background: #26313F; }
.row .name { font-size: 40px; font-weight: 500; }
.row .chg { font-size: 28px; color: #B8C0CB; }
.row .chg.down { color: #86D9A0; }
.row .chg.up { color: #F38E8D; }
.row .price { font-size: 76px; font-weight: 600; color: #F2A516; font-variant-numeric: tabular-nums; }
.eu { margin-top: 48px; font-size: 34px; line-height: 1.45; color: #DCE1E8; }
.eu b { color: #F2A516; font-weight: 600; }
</style></head><body><div class="card">
<div class="top">${GAUGE}<div class="brand">koszt-paliwa.pl</div></div>
<h1>Ceny paliw w Polsce</h1>
<p class="sub">Średnie ceny, stan na ${esc(day(data.fuelPrices.orlen?.date || data.fuelPrices.date))}</p>
<div class="rows">${rows
    .map(
      (r) => `<div class="row"><div><div class="name">${r.name}</div><div class="chg ${r.change <= -STEADY ? "down" : r.change >= STEADY ? "up" : ""}">${esc(signed(r.change))} od ${esc(day(since))}</div></div><div class="price">${esc(money(r.now))}</div></div>`
    )
    .join("")}</div>
<p class="eu">Benzyna w Polsce: <b>${rank}. miejsce</b> na ${ranked.length} krajów UE (od najtańszego). Najtaniej ${countryIn[cheapest.cc]} (${esc(euro(cheapest.pb))}/l), najdrożej ${countryIn[priciest.cc]} (${esc(euro(priciest.pb))}/l).</p>
<div class="foot">Koszt paliwa na Twojej trasie: <b>koszt-paliwa.pl</b></div>
</div></body></html>`;

  const text = `Ceny paliw w Polsce, stan na ${day(data.fuelPrices.orlen?.date || data.fuelPrices.date)}:

⛽ Benzyna 95: ${money(rows[0].now)}/l (${signed(rows[0].change)} od ${day(since)})
⛽ Diesel: ${money(rows[1].now)}/l (${signed(rows[1].change)})
⛽ LPG: ${money(rows[2].now)}/l (${signed(rows[2].change)})

Benzyna w Polsce jest na ${rank}. miejscu na ${ranked.length} krajów UE. Najtaniej ${countryIn[cheapest.cc]}, najdrożej ${countryIn[priciest.cc]}.

Ile wyjdzie paliwo na Twojej trasie? Policzysz za darmo: ${SITE}${REF}

#cenypaliw #benzyna #diesel`;
  return { html, text };
}

function tipPost(guide) {
  const photo = path.join(ROOT, "site/guides/img", `${guide.photo}.jpg`).replace(/\\/g, "/");
  const url = `${SITE}poradniki/${guide.slug}${REF}`;
  const html = `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>${BASE_CSS}
.photo { margin: 56px -80px 0; height: 440px; background: url("file:///${photo}") center / cover; }
h1 { margin-top: 48px; font-size: 60px; }
.foot { padding-top: 32px; }
.desc { margin: 24px 0 0; font-size: 32px; line-height: 1.45; color: #B8C0CB; }
.tag { display: inline-block; margin-top: 56px; padding: 10px 22px; border-radius: 999px; background: #F2A516; color: #1B2430; font-size: 28px; font-weight: 600; }
</style></head><body><div class="card">
<div class="top">${GAUGE}<div class="brand">koszt-paliwa.pl</div></div>
<div class="photo"></div>
<h1>${esc(guide.heading)}</h1>
<p class="desc">${esc(guide.description)}</p>
<div class="foot">Cały poradnik: <b>koszt-paliwa.pl</b></div>
</div></body></html>`;
  const text = `${guide.heading}

${guide.description}

Cały poradnik, z cenami aktualizowanymi kilka razy dziennie: ${url}

#paliwo #poradnik #kierowcy`;
  return { html, text };
}

function weekendPost(ctx, route, cities) {
  const name = `${cities[route.from].pl} – ${cities[route.to].pl}`;
  const url = `${SITE}trasa/${route.pl}${REF}`;
  const cost = (fuel, c) => ctx.inline.trip(route.pl, fuel, c);
  const perPerson = ctx.inline.trip(route.pl, "pb", 7, "4");
  const rows = [["Benzyna, 7 l/100 km", cost("pb", 7)], ["Diesel, 6 l/100 km", cost("on", 6)], ["LPG, 9 l/100 km", cost("lpg", 9)]];
  const hours = `${Math.floor(route.minutes / 60)} h ${route.minutes % 60} min`;
  const html = `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>${BASE_CSS}
.meta { margin-top: 12px; font-size: 34px; color: #B8C0CB; }
.rows { margin-top: 64px; display: grid; gap: 22px; }
.row { display: flex; justify-content: space-between; align-items: center; padding: 30px 40px; border-radius: 28px; background: #26313F; font-size: 38px; }
.row b { font-size: 64px; font-weight: 600; color: #F2A516; }
.person { margin-top: 40px; font-size: 36px; color: #DCE1E8; }
.person b { color: #F2A516; }
</style></head><body><div class="card">
<div class="top">${GAUGE}<div class="brand">koszt-paliwa.pl</div></div>
<h1>Na weekend: ${esc(name)}</h1>
<div class="meta">${km(route.km)} km w jedną stronę · ok. ${hours}</div>
<div class="rows">${rows.map(([label, value]) => `<div class="row">${esc(label)}<b>${esc(value)}</b></div>`).join("")}</div>
<p class="person">We czwórkę benzyną: <b>${esc(perPerson)}</b> na osobę</p>
<div class="foot">Policz swoje auto: <b>koszt-paliwa.pl</b></div>
</div></body></html>`;
  const text = `Weekendowy wyjazd ${name}? Paliwo w jedną stronę (${km(route.km)} km) przy dzisiejszych cenach:

🚗 Benzyna (7 l/100 km): ${rows[0][1]}
🚗 Diesel (6 l/100 km): ${rows[1][1]}
🚗 LPG (9 l/100 km): ${rows[2][1]}

We czwórkę benzyną to ${perPerson} na osobę. Ze spalaniem Twojego auta, tam i z powrotem: ${url}

#weekend #podróże #cenypaliw`;
  return { html, text };
}

(async () => {
  const data = await load("prices.json", "_prices.json");
  const history = await load("history.json", "_history.json");
  const today = dateArg || new Date().toISOString().slice(0, 10);
  const week = weekNumber(today);
  const ctx = context("pl", data, history);
  const guides = loadGuides().pl;
  const tips = TIP_GROUPS.map((id) => guides.find((g) => g.id === id)).filter(Boolean);
  const { cities, routes } = JSON.parse(fs.readFileSync(path.join(ROOT, "site/src/lib/routes.json"), "utf8"));
  const route = routes.find((r) => r.pl === WEEKEND_ROUTES[week % WEEKEND_ROUTES.length]);

  const dir = path.join(OUT, today);
  fs.mkdirSync(dir, { recursive: true });
  const posts = [
    ["1-podsumowanie", weeklyPost(data, history)],
    ["2-porada", tipPost(tips[week % tips.length])],
    ["3-weekend", weekendPost(ctx, route, cities)],
  ];
  for (const [name, { html, text }] of posts) {
    render(html, path.join(dir, `${name}.png`));
    fs.writeFileSync(path.join(dir, `${name}.txt`), `${text}\n`);
  }
  console.log(`${path.relative(ROOT, dir)}: ${posts.map(([n]) => n).join(", ")}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
