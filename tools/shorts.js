const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { screenshot } = require("./chrome");
const { context, prices } = require("./guides");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "store/shorts");
const W = 1080;
const H = 1920;
const FPS = 30;
const FADE = 0.35;
const SITES = { pl: "koszt-paliwa.pl", de: "spritkosten-europa.de" };
const NEIGHBOURS = ["CZ", "DE", "SK", "LT"];
const ROUTES = ["warszawa-gdansk", "krakow-zakopane", "wroclaw-praga", "warszawa-zakopane", "poznan-berlin", "krakow-budapeszt", "katowice-gdansk", "warszawa-wilno", "wroclaw-berlin", "krakow-wieden", "lodz-gdansk", "szczecin-berlin"];
const EU = ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE"];
const IN_PL = { CZ: "w Czechach", DE: "w Niemczech", SK: "na Słowacji", LT: "na Litwie", PL: "w Polsce", MT: "na Malcie", DK: "w Danii", NL: "w Holandii", FI: "w Finlandii", BG: "w Bułgarii", CY: "na Cyprze", RO: "w Rumunii", SI: "w Słowenii", LU: "w Luksemburgu", HU: "na Węgrzech", LV: "na Łotwie", EE: "w Estonii", AT: "w Austrii", FR: "we Francji", IT: "we Włoszech", ES: "w Hiszpanii", PT: "w Portugalii", GR: "w Grecji", IE: "w Irlandii", BE: "w Belgii", SE: "w Szwecji", HR: "w Chorwacji" };
const NAME_PL = { CZ: "Czechy", DE: "Niemcy", SK: "Słowacja", LT: "Litwa", PL: "Polska" };

const args = process.argv.slice(2);
const local = args.includes("--local");
const dateArg = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const day = (iso, lang) => new Intl.DateTimeFormat(lang === "de" ? "de-DE" : "pl-PL", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(iso));
const weekNumber = (iso) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  return Math.ceil(((d - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
};

async function load(name, file) {
  if (local) return JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8"));
  const res = await fetch(`https://koszt-paliwa.pl/${name}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  return res.json();
}

const FONTS = `<link href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@900&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">`;
const GAUGE = `<svg class="gauge" viewBox="0 0 128 128" aria-hidden="true"><path d="M31.1 91 A38 38 0 1 1 96.9 91" fill="none" stroke="#F2A516" stroke-width="13" stroke-linecap="round"/><line x1="64" y1="74" x2="87" y2="51" stroke="#FAF7F0" stroke-width="9" stroke-linecap="round"/><circle cx="64" cy="74" r="10" fill="#FAF7F0"/></svg>`;
const CSS = `
html, body { margin: 0; }
.slide { position: relative; overflow: hidden; width: ${W}px; height: ${H}px; box-sizing: border-box; padding: 200px 96px 460px; display: flex; flex-direction: column; justify-content: center;
  background: radial-gradient(circle at 80% 10%, #2B3848 0, #1B2430 60%); color: #FAF7F0; font-family: 'IBM Plex Sans', system-ui, sans-serif; }
.slide::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 16px; background: linear-gradient(90deg, #F2A516, #F7C45E 60%, transparent); }
.top { position: absolute; top: 110px; left: 96px; display: flex; align-items: center; gap: 20px; }
.gauge { width: 72px; height: 72px; }
.brand { font-family: 'Big Shoulders Display', sans-serif; font-weight: 900; font-size: 44px; letter-spacing: 0.04em; text-transform: uppercase; color: #F2A516; }
.hook { margin: 0; font-size: 116px; line-height: 1.04; font-weight: 600; letter-spacing: -0.02em; }
.hook em { font-style: normal; color: #F2A516; }
.kicker { margin: 0 0 32px; font-size: 46px; color: #B8C0CB; }
.rows { display: grid; gap: 26px; }
.row { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 24px; padding: 44px 48px; border-radius: 36px; background: #26313F; }
.row .name { font-size: 52px; font-weight: 500; }
.row .note { font-size: 36px; color: #B8C0CB; }
.row .note.good { color: #86D9A0; }
.row .note.bad { color: #F38E8D; }
.row .value { font-size: 96px; font-weight: 600; color: #F2A516; font-variant-numeric: tabular-nums; white-space: nowrap; }
.big { margin: 0; font-size: 230px; line-height: 1; font-weight: 600; color: #F2A516; letter-spacing: -0.03em; }
.line { margin: 28px 0 0; font-size: 58px; line-height: 1.3; }
.line b { color: #F2A516; font-weight: 600; }
.cta { margin: 0; font-size: 92px; line-height: 1.1; font-weight: 600; }
.url { margin: 48px 0 0; display: inline-block; align-self: flex-start; padding: 22px 40px; border-radius: 999px; background: #F2A516; color: #1B2430; font-size: 56px; font-weight: 600; }
.small { margin: 36px 0 0; font-size: 38px; color: #B8C0CB; }
`;

function slideHtml(body, brand) {
  return `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>${CSS}</style></head><body><div class="slide"><div class="top">${GAUGE}<div class="brand">${esc(brand)}</div></div>${body}</div></body></html>`;
}

function weekly(lang, data, history) {
  const { pln, eur } = prices(data);
  const last = history.dates.length - 1;
  const was = (fuel) => history.prices.PL[fuel][last] * history.plnPerEur[last];
  const zl = (v) => new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
  const rows = [["Benzyna 95", "pb"], ["Diesel", "on"], ["LPG", "lpg"]].map(([name, fuel]) => {
    const now = pln("PL", fuel);
    const change = now - was(fuel);
    const note = Math.abs(change) < 0.02 ? "bez zmian w tydzień" : `${change > 0 ? "▲ +" : "▼ −"}${zl(Math.abs(change))} w tydzień`;
    return { name, now, note, cls: Math.abs(change) < 0.02 ? "" : change < 0 ? "good" : "bad" };
  });
  const ranked = EU.map((cc) => ({ cc, p: pln(cc, "pb") })).filter((r) => r.p).sort((a, b) => a.p - b.p);
  const rank = ranked.findIndex((r) => r.cc === "PL") + 1;
  const eu = (v) => new Intl.NumberFormat("pl-PL", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v / eur);
  const date = day(data.fuelPrices.orlen?.date || data.fuelPrices.date, "pl");
  const slides = [
    [2.6, `<p class="kicker">${esc(date)}</p><p class="hook">Ile dziś kosztuje <em>paliwo</em> w Polsce?</p>`],
    [3.6, `<p class="kicker">Średnie ceny, ${esc(date)}</p><div class="rows">${rows.map((r) => `<div class="row"><div><div class="name">${r.name}</div><div class="note ${r.cls}">${esc(r.note)}</div></div><div class="value">${esc(zl(r.now))}</div></div>`).join("")}</div>`],
    [3.2, `<p class="kicker">Benzyna w Unii Europejskiej</p><p class="big">${rank}.</p><p class="line">miejsce Polski na ${ranked.length} krajów, od najtańszego</p><p class="line">Najtaniej ${IN_PL[ranked[0].cc]}: <b>${esc(eu(ranked[0].p))}</b><br>Najdrożej ${IN_PL[ranked.at(-1).cc]}: <b>${esc(eu(ranked.at(-1).p))}</b></p>`],
    [3, `<p class="cta">Ile wyjdzie paliwo na Twojej trasie?</p><p class="url">${SITES.pl}</p><p class="small">Za darmo, ze spalaniem Twojego auta. Link w bio.</p>`],
  ];
  const text = `Ceny paliw w Polsce, ${date}: benzyna 95 ${zl(rows[0].now)}, diesel ${zl(rows[1].now)}, LPG ${zl(rows[2].now)}. Polska na ${rank}. miejscu w UE. Koszt paliwa na Twojej trasie policzysz na ${SITES.pl} (link w bio).

#cenypaliw #benzyna #diesel #lpg #paliwo #kierowcy #samochód`;
  return { slides, text, brand: SITES.pl };
}

function border(lang, data, cc) {
  const { pln } = prices(data);
  const ctx = context("pl", data, { dates: [], prices: {}, plnPerEur: [] });
  const fuels = [["Benzyna 95", "pb"], ["Diesel", "on"], ["LPG", "lpg"]].filter(([, f]) => pln("PL", f) && pln(cc, f));
  const tiles = fuels.map(([name, f]) => {
    const a = pln("PL", f);
    const b = pln(cc, f);
    const same = Math.abs(a - b) < 0.01 * Math.min(a, b);
    return { name, f, same, where: a < b ? "PL" : cc, tank: ctx.inline.tank("PL", cc, f, "50") };
  });
  const best = tiles.filter((t) => !t.same).sort((x, y) => parseFloat(y.tank.replace(/[^\d,]/g, "").replace(",", ".")) - parseFloat(x.tank.replace(/[^\d,]/g, "").replace(",", ".")))[0];
  const slides = [
    [2.6, `<p class="kicker">Pełny bak, 50 litrów</p><p class="hook">Tankować w Polsce czy <em>${esc(IN_PL[cc])}</em>?</p>`],
    [3.6, `<p class="kicker">Średnie ceny za litr</p><div class="rows">${fuels.map(([name, f]) => `<div class="row"><div><div class="name">${name}</div><div class="note">Polska / ${esc(NAME_PL[cc])}</div></div><div class="value" style="font-size:72px">${esc(ctx.inline.price("PL", f))}<br>${esc(ctx.inline.price(cc, f))}</div></div>`).join("")}</div>`],
    [3.6, `<p class="kicker">Ile oszczędzasz na 50 l</p><div class="rows">${tiles.map((t) => `<div class="row"><div><div class="name">${t.name}</div><div class="note ${t.same ? "" : "good"}">${t.same ? "tyle samo" : `taniej ${IN_PL[t.where]}`}</div></div><div class="value">${t.same ? "≈ 0" : esc(t.tank)}</div></div>`).join("")}</div>`],
    [3, `<p class="cta">Policz koszt całej trasy z tankowaniem po drodze</p><p class="url">${SITES.pl}</p><p class="small">Ceny z biuletynu Komisji Europejskiej. Link w bio.</p>`],
  ];
  const text = `Tankować w Polsce czy ${IN_PL[cc]}? ${best ? `Na pełnym baku (50 l) ${best.name.toLowerCase()} wychodzi ${best.tank} taniej ${IN_PL[best.where]}.` : "Ceny są praktycznie takie same."} Aktualne ceny i kalkulator trasy: ${SITES.pl} (link w bio).

#tankowanie #cenypaliw #${NAME_PL[cc].toLowerCase()} #paliwo #podróże #kierowcy`;
  return { slides, text, brand: SITES.pl };
}

function trip(lang, data, cities, route) {
  const ctx = context("pl", data, { dates: [], prices: {}, plnPerEur: [] });
  const name = `${cities[route.from].pl} → ${cities[route.to].pl}`;
  const hours = `${Math.floor(route.minutes / 60)} h ${route.minutes % 60} min`;
  const rows = [["Benzyna", "7 l/100 km", ctx.inline.trip(route.pl, "pb", 7)], ["Diesel", "6 l/100 km", ctx.inline.trip(route.pl, "on", 6)], ["LPG", "9 l/100 km", ctx.inline.trip(route.pl, "lpg", 9)]];
  const perPerson = ctx.inline.trip(route.pl, "pb", 7, "4");
  const slides = [
    [2.6, `<p class="kicker">Paliwo w jedną stronę</p><p class="hook">Ile kosztuje trasa <em>${esc(name)}</em>?</p>`],
    [2.6, `<p class="big" style="font-size:190px">${new Intl.NumberFormat("pl-PL").format(Math.round(route.km))} km</p><p class="line">ok. ${hours} jazdy</p>`],
    [3.6, `<p class="kicker">Przy dzisiejszych cenach</p><div class="rows">${rows.map(([n, c, v]) => `<div class="row"><div><div class="name">${n}</div><div class="note">${c}</div></div><div class="value">${esc(v)}</div></div>`).join("")}</div>`],
    [2.8, `<p class="kicker">We czwórkę, benzyną</p><p class="big" style="font-size:200px">${esc(perPerson)}</p><p class="line">na osobę w jedną stronę</p>`],
    [3, `<p class="cta">A ile wyjdzie Twoim autem?</p><p class="url">${SITES.pl}</p><p class="small">Wpisz trasę i spalanie. Link w bio.</p>`],
  ];
  const text = `Ile kosztuje paliwo na trasie ${name}? ${new Intl.NumberFormat("pl-PL").format(Math.round(route.km))} km, benzyną (7 l/100 km) ${rows[0][2]}, dieslem ${rows[1][2]}, na LPG ${rows[2][2]}. We czwórkę ${perPerson} na osobę. Policz swoje auto: ${SITES.pl} (link w bio).

#podróże #wakacje #roadtrip #cenypaliw #paliwo #${cities[route.to].pl.toLowerCase().replace(/[^a-ząćęłńóśźż]/g, "")}`;
  return { slides, text, brand: SITES.pl };
}

function polen(data) {
  const { pln, eur } = prices(data);
  const ctx = context("de", data, { dates: [], prices: {}, plnPerEur: [] });
  const tankEur = (f) => `${Math.round((Math.abs(pln("DE", f) - pln("PL", f)) / eur) * 50)} €`;
  const fuels = [["Super 95", "pb"], ["Diesel", "on"], ["Autogas", "lpg"]].filter(([, f]) => pln("DE", f) && pln("PL", f));
  const tiles = fuels.map(([name, f]) => ({ name, cheaper: pln("PL", f) < pln("DE", f), tank: tankEur(f) }));
  const slides = [
    [2.6, `<p class="kicker">Volltanken, 50 Liter</p><p class="hook">Lohnt sich <em>Tanken in Polen</em>?</p>`],
    [3.6, `<p class="kicker">Durchschnittspreise pro Liter</p><div class="rows">${fuels.map(([name, f]) => `<div class="row"><div><div class="name">${name}</div><div class="note">Deutschland / Polen</div></div><div class="value" style="font-size:72px">${esc(ctx.inline.price("DE", f))}<br>${esc(ctx.inline.price("PL", f))}</div></div>`).join("")}</div>`],
    [3.6, `<p class="kicker">So viel sparst du pro Tankfüllung</p><div class="rows">${tiles.map((t) => `<div class="row"><div><div class="name">${t.name}</div><div class="note ${t.cheaper ? "good" : ""}">${t.cheaper ? "günstiger in Polen" : "günstiger in Deutschland"}</div></div><div class="value">${esc(t.tank)}</div></div>`).join("")}</div>`],
    [3, `<p class="cta">Spritkosten für deine Strecke berechnen</p><p class="url">${SITES.de}</p><p class="small">Kostenlos, mit deinem Verbrauch. Link in der Bio.</p>`],
  ];
  const best = tiles.filter((t) => t.cheaper).sort((a, b) => parseFloat(b.tank.replace(/[^\d,]/g, "").replace(",", ".")) - parseFloat(a.tank.replace(/[^\d,]/g, "").replace(",", ".")))[0];
  const text = `Tanken in Polen: ${best ? `${best.name} kostet pro 50-Liter-Tankfüllung ${best.tank} weniger als in Deutschland.` : "Die Preise sind aktuell fast gleich."} Aktuelle Preise und Spritkostenrechner: ${SITES.de} (Link in der Bio).

#tankeninpolen #spritpreise #tanken #polen #benzinpreise #sparen`;
  return { slides, text, brand: SITES.de };
}

function renderVideo(name, { slides, text, brand }, dir) {
  const tmp = fs.mkdtempSync(path.join(dir, `.${name}-`));
  const inputs = [];
  const filters = [];
  slides.forEach(([seconds, body], i) => {
    const html = path.join(tmp, `${i}.html`);
    const png = path.join(tmp, `${i}.png`);
    fs.writeFileSync(html, slideHtml(body, brand));
    screenshot(html, W, H, png, { waitMs: 3000 });
    inputs.push("-framerate", String(FPS), "-loop", "1", "-t", String(seconds), "-i", png);
    filters.push(`[${i}:v]scale=${W * 2}:${H * 2},zoompan=z='1+0.0009*on':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${W}x${H}:fps=${FPS},setsar=1,format=yuv420p[v${i}]`);
  });
  let label = "v0";
  let offset = 0;
  for (let i = 1; i < slides.length; i++) {
    offset += slides[i - 1][0] - FADE;
    filters.push(`[${label}][v${i}]xfade=transition=fade:duration=${FADE}:offset=${offset.toFixed(2)}[x${i}]`);
    label = `x${i}`;
  }
  const total = slides.reduce((s, [d]) => s + d, 0) - FADE * (slides.length - 1);
  const out = path.join(dir, `${name}.mp4`);
  execFileSync(
    "ffmpeg",
    ["-y", "-loglevel", "error", ...inputs, "-f", "lavfi", "-t", total.toFixed(2), "-i", "anullsrc=r=44100:cl=stereo", "-filter_complex", filters.join(";"), "-map", `[${label}]`, "-map", `${slides.length}:a`, "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-r", String(FPS), "-c:a", "aac", "-shortest", "-movflags", "+faststart", out],
    { stdio: "inherit" }
  );
  fs.copyFileSync(path.join(tmp, "0.png"), path.join(dir, `${name}-cover.png`));
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.writeFileSync(path.join(dir, `${name}.txt`), `${text}\n`);
  return total;
}

(async () => {
  const data = await load("prices.json", "_prices.json");
  const history = await load("history.json", "_history.json");
  const today = dateArg || new Date().toISOString().slice(0, 10);
  const week = weekNumber(today);
  const { cities, routes } = JSON.parse(fs.readFileSync(path.join(ROOT, "site/src/lib/routes.json"), "utf8"));
  const route = routes.find((r) => r.pl === ROUTES[week % ROUTES.length]);
  const dir = path.join(OUT, today);
  fs.mkdirSync(dir, { recursive: true });
  const videos = [
    ["1-ceny-tygodnia", weekly("pl", data, history)],
    ["2-tankowanie-" + NEIGHBOURS[week % NEIGHBOURS.length].toLowerCase(), border("pl", data, NEIGHBOURS[week % NEIGHBOURS.length])],
    ["3-trasa-" + route.pl, trip("pl", data, cities, route)],
    ["4-tanken-in-polen", polen(data)],
  ];
  for (const [name, video] of videos) console.log(`${path.relative(ROOT, path.join(dir, name))}.mp4 – ${renderVideo(name, video, dir).toFixed(1)} s`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
