importScripts("settings.js");

const EU_BULLETIN_URL = "https://energy.ec.europa.eu/document/download/264c2d0f-f161-4ea3-a777-78faae59bea0_en";
const NBP_URL = "https://api.nbp.pl/api/exchangerates/tables/a/?format=json";
const NBP_EUR_URL = "https://api.nbp.pl/api/exchangerates/rates/a/eur/";
const ORLEN_URL = "https://tool.orlen.pl/api/wholesalefuelprices/ByProduct";
const UK_FUEL_PAGE = "https://www.gov.uk/api/content/government/statistics/weekly-road-fuel-prices";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";
const SITE_PRICES_URL = `${MAPKA_SITE_URL}prices.json`;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const SITE_INTERVAL = 3 * HOUR;
const MAX_AGE = { national: 24 * HOUR, eu: 72 * HOUR, nbp: 48 * HOUR, uk: 72 * HOUR };

const ORLEN_PRODUCTS = { pb: 41, pbp: 42, on: 43 };
const FUEL_VAT = 1.23;
const ORLEN_THRESHOLD = 0.15;

const EU_COLUMNS = { B: "pb", C: "on", G: "lpg" };
const EU_NAMES = {
  Austria: "AT", Belgium: "BE", Bulgaria: "BG", Croatia: "HR", Cyprus: "CY", Czechia: "CZ",
  Denmark: "DK", Estonia: "EE", Finland: "FI", France: "FR", Germany: "DE", Greece: "GR",
  Hungary: "HU", Ireland: "IE", Italy: "IT", Latvia: "LV", Lithuania: "LT", Luxembourg: "LU",
  Malta: "MT", Netherlands: "NL", Poland: "PL", Portugal: "PT", Romania: "RO", Slovakia: "SK",
  Slovenia: "SI", Spain: "ES", Sweden: "SE",
};

const isStale = (entry, maxAge) => !entry?.fetchedAt || Date.now() - entry.fetchedAt > maxAge;
const isoDay = (time) => new Date(time).toISOString().slice(0, 10);
const average = (list) => list.reduce((sum, r) => sum + r.value, 0) / list.length;
const round2 = (value) => Math.round(value * 100) / 100;

async function fetchEurRate(date) {
  const res = await fetch(`${NBP_EUR_URL}${isoDay(Date.parse(date) - 7 * DAY)}/${date}/?format=json`, { cache: "no-store" });
  if (!res.ok) throw new Error(`NBP: HTTP ${res.status}`);
  const { rates } = await res.json();
  return rates[rates.length - 1].mid;
}

async function fetchOrlen(productId, from, to) {
  const res = await fetch(`${ORLEN_URL}?productId=${productId}&from=${from}&to=${to}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Orlen: HTTP ${res.status}`);
  return (await res.json())
    .map((r) => ({ date: r.effectiveDate.slice(0, 10), value: r.value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function orlenShift(history, bulletinDate) {
  const before = history.filter((r) => r.date <= bulletinDate).slice(-5);
  const recent = history.slice(-5);
  if (before.length < 3 || recent.length < 3 || recent[recent.length - 1].date <= bulletinDate) return 0;
  const shift = ((average(recent) - average(before)) * FUEL_VAT) / 1000;
  return Math.abs(shift) > ORLEN_THRESHOLD ? round2(shift) : 0;
}

async function fetchOrlenCorrection(bulletinDate) {
  const from = isoDay(Date.parse(bulletinDate) - 14 * DAY);
  const to = isoDay(Date.now());
  const [pb, pbp, on] = await Promise.all(["pb", "pbp", "on"].map((f) => fetchOrlen(ORLEN_PRODUCTS[f], from, to)));
  if (!pb.length || !pbp.length || !on.length) throw new Error("Orlen: no wholesale prices");
  return {
    pb: orlenShift(pb, bulletinDate),
    on: orlenShift(on, bulletinDate),
    pbpSpread: round2((pbp[pbp.length - 1].value - pb[pb.length - 1].value) / 1000),
    date: pb[pb.length - 1].date,
  };
}

function polandPrices(euPrices, eurRate, orlen = null) {
  const base = euPrices?.prices?.PL;
  if (!base?.pb) throw new Error(mapkaT("error_poland_prices"));
  const prices = {};
  for (const fuel of ["pb", "on", "lpg"]) if (base[fuel]) prices[fuel] = base[fuel] * eurRate;
  if (orlen) {
    prices.pb += orlen.pb;
    if (prices.on) prices.on += orlen.on;
    if (orlen.pbpSpread > 0) prices.pbp = prices.pb + orlen.pbpSpread;
  }
  if (prices.on) prices.onp = prices.on;
  return Object.fromEntries(Object.entries(prices).map(([fuel, value]) => [fuel, round2(value)]));
}

async function refreshNational({ orlen = false } = {}) {
  const { euPrices } = await chrome.storage.local.get("euPrices");
  if (!euPrices?.date) throw new Error(mapkaT("error_poland_prices"));
  const eurRate = await fetchEurRate(euPrices.date);
  let correction = null;
  let orlenError = null;
  if (orlen) {
    try {
      correction = await fetchOrlenCorrection(euPrices.date);
    } catch (e) {
      orlenError = String(e.message || e);
    }
  }
  const fuelPrices = {
    prices: polandPrices(euPrices, eurRate, correction),
    date: euPrices.date,
    eurRate,
    orlen: correction,
    fetchedAt: Date.now(),
  };
  await chrome.storage.local.set({ fuelPrices });
  if (orlenError) throw new Error(orlenError);
  return fuelPrices;
}

async function unzip(buffer, names) {
  const dv = new DataView(buffer);
  let eocd = -1;
  for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error(mapkaT("error_eu_file"));
  const decoder = new TextDecoder();
  const out = {};
  let p = dv.getUint32(eocd + 16, true);
  const count = dv.getUint16(eocd + 10, true);
  for (let n = 0; n < count && dv.getUint32(p, true) === 0x02014b50; n++) {
    const method = dv.getUint16(p + 10, true);
    const size = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const offset = dv.getUint32(p + 42, true);
    const name = decoder.decode(new Uint8Array(buffer, p + 46, nameLen));
    if (names.includes(name)) {
      const start = offset + 30 + dv.getUint16(offset + 26, true) + dv.getUint16(offset + 28, true);
      const raw = new Uint8Array(buffer, start, size);
      const bytes =
        method === 0
          ? raw
          : new Uint8Array(
              await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer()
            );
      out[name] = decoder.decode(bytes);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

function xmlText(s) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function parseEuBulletin(files) {
  const strings = [...files["xl/sharedStrings.xml"].matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    xmlText([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("")).trim()
  );
  const prices = {};
  let date = null;
  for (const row of files["xl/worksheets/sheet1.xml"].matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = {};
    for (const c of row[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const v = c[3]?.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      if (v == null) continue;
      cells[c[1]] = /t="s"/.test(c[2]) ? strings[+v] : parseFloat(v);
    }
    if (typeof cells.A === "number" && !date) {
      date = new Date(Date.UTC(1899, 11, 30) + cells.A * 86400000).toISOString().slice(0, 10);
      continue;
    }
    const cc = EU_NAMES[cells.A];
    if (!cc) continue;
    prices[cc] = {};
    for (const [col, fuel] of Object.entries(EU_COLUMNS)) {
      if (typeof cells[col] === "number" && cells[col] > 0) prices[cc][fuel] = cells[col] / 1000;
    }
  }
  if (!Object.keys(prices).length) throw new Error(mapkaT("error_eu_prices"));
  return { prices, date };
}

async function refreshEu() {
  const res = await fetch(EU_BULLETIN_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`EU Weekly Oil Bulletin: HTTP ${res.status}`);
  const files = await unzip(await res.arrayBuffer(), ["xl/sharedStrings.xml", "xl/worksheets/sheet1.xml"]);
  const euPrices = { ...parseEuBulletin(files), fetchedAt: Date.now() };
  await chrome.storage.local.set({ euPrices });
}

function parseUkFuelCsv(csv) {
  const rows = csv.replace(/^\uFEFF/, "").trim().split(/\r?\n/).slice(1).map((line) => line.split(","));
  const last = rows.filter((r) => /^\d{2}\/\d{2}\/\d{4}$/.test(r[0]) && parseFloat(r[1]) > 0).pop();
  if (!last) throw new Error("UK road fuel prices: no data");
  const [day, month, year] = last[0].split("/");
  const prices = { pb: parseFloat(last[1]) / 100 };
  if (parseFloat(last[2]) > 0) prices.on = parseFloat(last[2]) / 100;
  return { prices, date: `${year}-${month}-${day}` };
}

async function refreshUk() {
  const page = await fetch(UK_FUEL_PAGE, { cache: "no-store" });
  if (!page.ok) throw new Error(`GOV.UK: HTTP ${page.status}`);
  const { details } = await page.json();
  const csv = details?.attachments?.find((a) => a.content_type === "text/csv" && /2018/.test(a.title));
  if (!csv) throw new Error("GOV.UK: no CSV with weekly road fuel prices");
  const res = await fetch(csv.url, { cache: "no-store" });
  if (!res.ok) throw new Error(`GOV.UK: HTTP ${res.status}`);
  const ukPrices = { ...parseUkFuelCsv(await res.text()), fetchedAt: Date.now() };
  await chrome.storage.local.set({ ukPrices });
}

async function refreshNbp() {
  const res = await fetch(NBP_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`NBP: HTTP ${res.status}`);
  const [table] = await res.json();
  const rates = Object.fromEntries(table.rates.map((r) => [r.code, r.mid]));
  await chrome.storage.local.set({ nbpRates: { rates, date: table.effectiveDate, fetchedAt: Date.now() } });
}

async function refreshSources(force = false, options = {}) {
  const data = await chrome.storage.local.get(["fuelPrices", "euPrices", "nbpRates", "ukPrices"]);
  const errors = [];
  const run = (job) => job().catch((e) => errors.push(String(e?.message || e)));
  const euStale = force || isStale(data.euPrices, MAX_AGE.eu);
  await Promise.all([
    euStale ? run(refreshEu) : null,
    force || isStale(data.nbpRates, MAX_AGE.nbp) ? run(refreshNbp) : null,
    options.uk && (force || isStale(data.ukPrices, MAX_AGE.uk)) ? run(refreshUk) : null,
  ]);
  if (euStale || isStale(data.fuelPrices, MAX_AGE.national)) await run(() => refreshNational(options));
  await chrome.storage.local.set({ fuelPricesError: errors.length ? errors.join("; ") : null });
  return { ok: !errors.length, errors };
}

const isEntry = (e) => typeof e?.fetchedAt === "number" && typeof (e.prices || e.rates) === "object";
const isNewer = (entry, local) => isEntry(entry) && !(local?.fetchedAt >= entry.fetchedAt);

async function refreshFromSite() {
  const res = await fetch(SITE_PRICES_URL, { cache: "no-cache" });
  if (!res.ok) throw new Error(`prices.json: HTTP ${res.status}`);
  const site = await res.json();
  const local = await chrome.storage.local.get(["fuelPrices", "euPrices", "nbpRates", "ukPrices"]);
  const update = { sitePricesCheckedAt: Date.now() };
  for (const key of ["fuelPrices", "euPrices", "nbpRates", "ukPrices"]) {
    if (isNewer(site[key], local[key])) update[key] = site[key];
  }
  await chrome.storage.local.set(update);
}

async function refreshAll(force = false) {
  const { sitePricesCheckedAt = 0 } = await chrome.storage.local.get("sitePricesCheckedAt");
  if (force || Date.now() - sitePricesCheckedAt > SITE_INTERVAL) await refreshFromSite().catch(() => {});
  return refreshSources();
}

let geocodeQueue = Promise.resolve();

function geocode(lat, lng) {
  const [rLat, rLng] = [lat.toFixed(2), lng.toFixed(2)];
  const key = `${MAPKA_LOCALE}:${rLat},${rLng}`;
  const task = geocodeQueue.then(async () => {
    const { geoCache = {} } = await chrome.storage.local.get("geoCache");
    if (geoCache[key]) return geoCache[key];
    const url = `${NOMINATIM_URL}?format=jsonv2&zoom=5&accept-language=${encodeURIComponent(MAPKA_LOCALE)}&lat=${rLat}&lon=${rLng}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Nominatim: HTTP ${res.status}`);
    const a = (await res.json()).address || {};
    const geo = { cc: a.country_code || null, region: a["ISO3166-2-lvl4"] || null, regionName: a.state || null };
    geoCache[key] = geo;
    await chrome.storage.local.set({ geoCache });
    await new Promise((r) => setTimeout(r, 1100));
    return geo;
  });
  geocodeQueue = task.catch(() => {});
  return task;
}

chrome.runtime.onInstalled.addListener(({ reason }) => {
  chrome.alarms.create("refreshPrices", { periodInMinutes: 60 });
  chrome.storage.local.remove("regionalPrices");
  refreshAll(true);
  if (reason === "install") chrome.tabs.create({ url: "welcome.html" });
});

chrome.runtime.onStartup.addListener(() => refreshAll());

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "refreshPrices") refreshAll();
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "refreshPrices") {
    refreshAll(true).then(sendResponse);
    return true;
  }
  if (msg?.type === "locate") {
    geocode(msg.lat, msg.lng)
      .then((geo) => sendResponse({ ok: true, geo }))
      .catch((e) => sendResponse({ ok: false, error: String(e.message || e) }));
    return true;
  }
  if (msg?.type === "openHistory") {
    chrome.tabs.create({ url: "history.html" });
  }
});
