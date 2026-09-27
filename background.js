importScripts("settings.js");

const AUTOCENTRUM_URL = "https://www.autocentrum.pl/paliwa/ceny-paliw/";
const EU_BULLETIN_URL = "https://energy.ec.europa.eu/document/download/264c2d0f-f161-4ea3-a777-78faae59bea0_en";
const NBP_URL = "https://api.nbp.pl/api/exchangerates/tables/a/?format=json";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";

const HOUR = 60 * 60 * 1000;
const MAX_AGE = { national: 6 * HOUR, regional: 6 * HOUR, eu: 24 * HOUR, nbp: 12 * HOUR };

const EU_COLUMNS = { B: "pb", C: "on", G: "lpg" };
const EU_NAMES = {
  Austria: "AT", Belgium: "BE", Bulgaria: "BG", Croatia: "HR", Cyprus: "CY", Czechia: "CZ",
  Denmark: "DK", Estonia: "EE", Finland: "FI", France: "FR", Germany: "DE", Greece: "GR",
  Hungary: "HU", Ireland: "IE", Italy: "IT", Latvia: "LV", Lithuania: "LT", Luxembourg: "LU",
  Malta: "MT", Netherlands: "NL", Poland: "PL", Portugal: "PT", Romania: "RO", Slovakia: "SK",
  Slovenia: "SI", Spain: "ES", Sweden: "SE",
};

const isStale = (entry, maxAge) => !entry?.fetchedAt || Date.now() - entry.fetchedAt > maxAge;

function parseAutocentrum(html) {
  const prices = {};
  for (const m of html.matchAll(/class="station-detail-wrapper\s+(\w+)[^"]*"([\s\S]*?)<\/a>/g)) {
    const price = m[2].match(/<div class="price">\s*(\d+,\d+)/)?.[1];
    const value = price ? parseFloat(price.replace(",", ".")) : 0;
    if (value > 0 && !(m[1] in prices)) prices[m[1]] = value;
  }
  if (!Object.keys(prices).length) throw new Error(mapkaT("error_autocentrum"));
  return prices;
}

async function fetchAutocentrum(slug = "") {
  const url = AUTOCENTRUM_URL + (slug ? `${slug}/` : "");
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`autocentrum.pl: HTTP ${res.status}`);
  return { prices: parseAutocentrum(await res.text()), fetchedAt: Date.now(), source: url };
}

async function refreshNational() {
  const fuelPrices = await fetchAutocentrum();
  await chrome.storage.local.set({ fuelPrices });
  return fuelPrices;
}

async function ensureRegion(slug, force = false) {
  const { regionalPrices = {} } = await chrome.storage.local.get("regionalPrices");
  if (!force && !isStale(regionalPrices[slug], MAX_AGE.regional)) return;
  regionalPrices[slug] = await fetchAutocentrum(slug);
  await chrome.storage.local.set({ regionalPrices });
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
  if (!res.ok) throw new Error(`Biuletyn UE: HTTP ${res.status}`);
  const files = await unzip(await res.arrayBuffer(), ["xl/sharedStrings.xml", "xl/worksheets/sheet1.xml"]);
  const euPrices = { ...parseEuBulletin(files), fetchedAt: Date.now() };
  await chrome.storage.local.set({ euPrices });
}

async function refreshNbp() {
  const res = await fetch(NBP_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`NBP: HTTP ${res.status}`);
  const [table] = await res.json();
  const rates = Object.fromEntries(table.rates.map((r) => [r.code, r.mid]));
  await chrome.storage.local.set({ nbpRates: { rates, date: table.effectiveDate, fetchedAt: Date.now() } });
}

async function refreshAll(force = false) {
  const data = await chrome.storage.local.get(["fuelPrices", "euPrices", "nbpRates"]);
  const jobs = [];
  if (force || isStale(data.fuelPrices, MAX_AGE.national)) jobs.push(refreshNational());
  if (force || isStale(data.euPrices, MAX_AGE.eu)) jobs.push(refreshEu());
  if (force || isStale(data.nbpRates, MAX_AGE.nbp)) jobs.push(refreshNbp());
  const results = await Promise.allSettled(jobs);
  const errors = results.filter((r) => r.status === "rejected").map((r) => String(r.reason?.message || r.reason));
  await chrome.storage.local.set({ fuelPricesError: errors.length ? errors.join("; ") : null });
  return { ok: !errors.length, errors };
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

async function locate(lat, lng) {
  const geo = await geocode(lat, lng);
  const slug = mapkaRegionSlug(geo);
  if (geo.cc === "pl" && slug) await ensureRegion(slug).catch(() => {});
  return geo;
}

chrome.runtime.onInstalled.addListener(({ reason }) => {
  chrome.alarms.create("refreshPrices", { periodInMinutes: 60 });
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
    locate(msg.lat, msg.lng)
      .then((geo) => sendResponse({ ok: true, geo }))
      .catch((e) => sendResponse({ ok: false, error: String(e.message || e) }));
    return true;
  }
  if (msg?.type === "openHistory") {
    chrome.tabs.create({ url: "history.html" });
  }
});
