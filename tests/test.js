const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const zlib = require("zlib");

const ROOT = path.join(__dirname, "..");
const source = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

function i18n(lang) {
  const messages = JSON.parse(source(`_locales/${lang}/messages.json`));
  return {
    getUILanguage: () => lang,
    getMessage: (key, subs = []) =>
      messages[key] ? messages[key].message.replace(/\$(\d|\$)/g, (_, n) => (n === "$" ? "$" : subs[n - 1] ?? "")) : "",
  };
}

function loadExtension({ fetch, lang = "pl" } = {}) {
  const store = {};
  const listener = { addListener() {} };
  const context = vm.createContext({
    console,
    TextDecoder,
    URL,
    Blob: global.Blob,
    Response: global.Response,
    DecompressionStream: global.DecompressionStream,
    setTimeout: (fn) => fn(),
    fetch,
    chrome: {
      i18n: i18n(lang),
      runtime: { onInstalled: listener, onStartup: listener, onMessage: listener },
      alarms: { onAlarm: listener, create() {} },
      storage: {
        local: {
          get: async (keys) => Object.fromEntries([].concat(keys).filter((k) => k in store).map((k) => [k, store[k]])),
          set: async (items) => Object.assign(store, items),
        },
      },
    },
  });
  context.importScripts = (file) => vm.runInContext(source(file), context, { filename: file });
  vm.runInContext(source("background.js"), context, { filename: "background.js" });
  return context;
}

const ext = loadExtension();
const DEFAULTS = vm.runInContext("MAPKA_DEFAULTS", ext);

const same = (actual, expected) => assert.deepStrictEqual(JSON.parse(JSON.stringify(actual)), expected);
const close = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `expected ${expected}, got ${actual}`);

function zip(files, deflate = false) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const nameBuf = Buffer.from(name);
    const raw = Buffer.from(text);
    const data = deflate ? zlib.deflateRawSync(raw) : raw;
    const method = deflate ? 8 : 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuf, data);
    centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + data.length;
  }
  const dir = Buffer.concat(centrals);
  const count = Object.keys(files).length;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(count, 8);
  eocd.writeUInt16LE(count, 10);
  eocd.writeUInt32LE(dir.length, 12);
  eocd.writeUInt32LE(offset, 16);
  const buf = Buffer.concat([...locals, dir, eocd]);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test("mapkaParseKm: Google Maps distance formats", () => {
  const cases = {
    "339 km": 339,
    "(339 km)": 339,
    "1,234 km": 1234,
    "1 234 km": 1234,
    "1 234 km": 1234,
    "1 234 km": 1234,
    "4,6 km": 4.6,
    "4.6 km": 4.6,
    "1.234,5 km": 1234.5,
    "1,234.5 km": 1234.5,
    "800 m": 0.8,
    "12 mi": 12 * 1.609344,
    "1000 ft": 0.3048,
  };
  for (const [text, km] of Object.entries(cases)) close(ext.mapkaParseKm(text), km);
});

test("mapkaParseKm: text that is not a distance", () => {
  for (const text of ["3 hr 43 min", "", "km", "via S7"]) assert.strictEqual(ext.mapkaParseKm(text), null, text);
});

const BULLETIN = { prices: { PL: { pb: 1.82, on: 2.04, lpg: 0.72 } }, date: "2026-09-21" };
const wholesale = (values, start = "2026-09-15") =>
  values.map((value, i) => ({ date: new Date(Date.parse(start) + i * 86400000).toISOString().slice(0, 10), value }));

test("polandPrices: the EU bulletin in PLN at the NBP rate of the bulletin date", () => {
  same(ext.polandPrices(BULLETIN, 4.35), { pb: 7.92, on: 8.87, lpg: 3.13, onp: 8.87 });
  assert.throws(() => ext.polandPrices({ prices: { DE: { pb: 1.8 } } }, 4.35), /brak cen dla Polski/);
});

test("polandPrices: Orlen wholesale shifts the price and gives Pb98", () => {
  same(ext.polandPrices(BULLETIN, 4.35, { pb: 0.3, on: 0, pbpSpread: 0.81 }), { pb: 8.22, on: 8.87, lpg: 3.13, pbp: 9.03, onp: 8.87 });
});

test("orlenShift: only lasting moves above the threshold count, with VAT", () => {
  const flat = wholesale([6300, 6400, 6250, 6350, 6300, 6400, 6250, 6350, 6300, 6280]);
  assert.strictEqual(ext.orlenShift(flat, "2026-09-19"), 0);
  const rising = wholesale([6000, 6000, 6000, 6000, 6000, 6000, 6300, 6300, 6300, 6300, 6300]);
  close(ext.orlenShift(rising, "2026-09-19"), 0.37);
  assert.strictEqual(ext.orlenShift(rising.slice(0, 5), "2026-09-19"), 0);
});

const SHARED_STRINGS = `<?xml version="1.0"?><sst>
  <si><t>Poland</t></si>
  <si><t>Germany</t></si>
  <si><r><t>Czech</t></r><r><t xml:space="preserve">ia</t></r></si>
  <si><t>Prices &amp; taxes</t></si>
</sst>`;
const SHEET = `<?xml version="1.0"?><worksheet><sheetData>
  <row r="1"><c r="A1" t="s"><v>3</v></c></row>
  <row r="2"><c r="A2"><v>45658</v></c></row>
  <row r="3"><c r="A3" t="s"><v>0</v></c><c r="B3"><v>1450.5</v></c><c r="C3"><v>1500</v></c><c r="G3"><v>700</v></c></row>
  <row r="4"><c r="A4" t="s"><v>1</v></c><c r="B4"><v>1800</v></c><c r="C4"><v>1650</v></c><c r="G4"/></row>
  <row r="5"><c r="A5" t="s"><v>2</v></c><c r="B5"><v>0</v></c><c r="C5"><v>1400</v></c></row>
</sheetData></worksheet>`;
const EXPECTED_EU = {
  prices: { PL: { pb: 1.4505, on: 1.5, lpg: 0.7 }, DE: { pb: 1.8, on: 1.65 }, CZ: { on: 1.4 } },
  date: "2025-01-01",
};

test("parseEuBulletin: prices in EUR/l, bulletin date, formatted text", () => {
  same(ext.parseEuBulletin({ "xl/sharedStrings.xml": SHARED_STRINGS, "xl/worksheets/sheet1.xml": SHEET }), EXPECTED_EU);
});

test("parseEuBulletin: a sheet without known countries is an error", () => {
  const sheet = `<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>3</v></c></row></sheetData></worksheet>`;
  assert.throws(
    () => ext.parseEuBulletin({ "xl/sharedStrings.xml": SHARED_STRINGS, "xl/worksheets/sheet1.xml": sheet }),
    /nie znaleziono cen/
  );
});

test("xmlText: XML entities", () => {
  assert.strictEqual(ext.xmlText("a &lt;b&gt; &quot;c&quot; &apos;d&apos; &amp;lt;"), `a <b> "c" 'd' &lt;`);
});

test("unzip + parseEuBulletin: stored entries", async () => {
  const files = { "xl/sharedStrings.xml": SHARED_STRINGS, "xl/worksheets/sheet1.xml": SHEET, "docProps/app.xml": "<x/>" };
  const out = await ext.unzip(zip(files), ["xl/sharedStrings.xml", "xl/worksheets/sheet1.xml"]);
  same(Object.keys(out).sort(), ["xl/sharedStrings.xml", "xl/worksheets/sheet1.xml"]);
  same(ext.parseEuBulletin(out), EXPECTED_EU);
});

test("unzip: deflate-compressed entries", async () => {
  if (!global.DecompressionStream) return "skipped – DecompressionStream needs Node 18+";
  const out = await ext.unzip(zip({ "xl/worksheets/sheet1.xml": SHEET }, true), ["xl/worksheets/sheet1.xml"]);
  assert.strictEqual(out["xl/worksheets/sheet1.xml"], SHEET);
});

test("unzip: a file that is not a ZIP", async () => {
  await assert.rejects(ext.unzip(new ArrayBuffer(100), ["a"]), /nieprawidłowy plik XLSX/);
});

const DATA = {
  fuelPrices: { prices: { pb: 6.2, on: 6.3 } },
  euPrices: { prices: { DE: { pb: 1.8, on: 1.7 } } },
  nbpRates: { rates: { EUR: 4.3, GBP: 5.0 } },
};
const settings = (over) => ({ ...DEFAULTS, currency: "PLN", configured: true, ...over });
const WARSAW = { cc: "pl", region: "PL-14", regionName: "województwo mazowieckie" };
const BERLIN = { cc: "de", region: "DE-BE", regionName: "Berlin" };

test("mapkaResolvePrice: manual price when automatic prices are off", () => {
  const p = ext.mapkaResolvePrice(settings({ autoPrice: false, price: 5.55 }), DATA, null);
  same(p, { low: 5.55, high: 5.55, unit: "l", auto: false, source: "cena ręczna" });
});

test("mapkaResolvePrice: missing price data shows in the description", () => {
  const p = ext.mapkaResolvePrice(settings({ price: 5.55 }), {}, null);
  assert.strictEqual(p.auto, false);
  assert.strictEqual(p.low, 5.55);
  assert.strictEqual(p.source, "brak aktualnych cen – cena ręczna");
});

test("mapkaResolvePrice: national average, with or without a location", () => {
  for (const geo of [null, { origin: WARSAW, dest: WARSAW }]) {
    const p = ext.mapkaResolvePrice(settings(), DATA, geo);
    assert.strictEqual(p.low, 6.2);
    assert.strictEqual(p.auto, true);
    assert.ok(p.source.startsWith("średnia PL"), p.source);
  }
});

test("mapkaResolvePrice: premium fuels fall back to the regular price", () => {
  assert.strictEqual(ext.mapkaResolvePrice(settings({ fuelType: "onp" }), DATA, null).low, 6.3);
  assert.strictEqual(ext.mapkaResolvePrice(settings({ fuelType: "pbp" }), DATA, null).low, 6.2);
});

test("mapkaResolvePrice: trip abroad – average of start and destination", () => {
  const p = ext.mapkaResolvePrice(settings(), DATA, { origin: WARSAW, dest: BERLIN });
  close(p.low, (6.2 + 1.8 * 4.3) / 2);
  assert.ok(p.source.includes("Niemcy"), p.source);
});

test("mapkaResolvePrice: without local prices a destination abroad is ignored", () => {
  const p = ext.mapkaResolvePrice(settings({ localPrices: false }), DATA, { origin: WARSAW, dest: BERLIN });
  assert.strictEqual(p.low, 6.2);
});

vm.runInContext(source("borders.js"), ext, { filename: "borders.js" });
const PLACES = {
  warszawa: { lng: 21.01, lat: 52.23 },
  paryz: { lng: 2.35, lat: 48.86 },
  berlin: { lng: 13.4, lat: 52.52 },
  szczecin: { lng: 14.55, lat: 53.43 },
  rzeszow: { lng: 22.0, lat: 50.04 },
  zakopane: { lng: 19.95, lat: 49.3 },
  zurych: { lng: 8.54, lat: 47.37 },
  mediolan: { lng: 9.19, lat: 45.46 },
};

test("borders.js: borders cover exactly the countries in the EC bulletin", () => {
  const eu = vm.runInContext("Object.values(EU_NAMES)", ext);
  same(vm.runInContext("Object.keys(MAPKA_BORDERS)", ext).sort(), [...eu].sort());
});

test("mapkaCountryAt: cities in the EU, outside it and at sea", () => {
  assert.strictEqual(ext.mapkaCountryAt(PLACES.warszawa), "PL");
  assert.strictEqual(ext.mapkaCountryAt(PLACES.paryz), "FR");
  assert.strictEqual(ext.mapkaCountryAt(PLACES.zurych), null);
  assert.strictEqual(ext.mapkaCountryAt({ lng: 18.0, lat: 55.0 }), null);
});

test("mapkaRouteShares: Warsaw → Paris through Germany", () => {
  const shares = ext.mapkaRouteShares([PLACES.warszawa, PLACES.paryz]);
  close(Object.values(shares).reduce((a, b) => a + b, 0), 1);
  assert.ok(shares.PL > 0.3 && shares.PL < 0.45, JSON.stringify(shares));
  assert.ok(shares.DE > 0.35 && shares.DE < 0.55, JSON.stringify(shares));
  assert.ok(shares.FR > 0.1 && shares.FR < 0.3, JSON.stringify(shares));
});

test("mapkaRouteShares: a stop abroad on an out-and-back trip", () => {
  const shares = ext.mapkaRouteShares([PLACES.szczecin, PLACES.berlin, PLACES.szczecin]);
  same(Object.keys(shares).sort(), ["DE", "PL"]);
});

test("mapkaRouteShares: a single-country trip and stops outside the EU → null", () => {
  assert.strictEqual(ext.mapkaRouteShares([PLACES.rzeszow, PLACES.zakopane]), null);
  assert.strictEqual(ext.mapkaRouteShares([PLACES.zurych, PLACES.mediolan]), null);
});

test("mapkaResolvePrice: price weighted by countries on the route", () => {
  const data = { ...DATA, euPrices: { prices: { DE: { pb: 1.8 }, FR: { pb: 1.9 } } } };
  const shares = { DE: 0.5, PL: 0.3, FR: 0.2 };
  const p = ext.mapkaResolvePrice(settings(), data, { origin: WARSAW, dest: { cc: "fr" }, shares });
  close(p.low, 0.5 * 1.8 * 4.3 + 0.3 * 6.2 + 0.2 * 1.9 * 4.3);
  assert.ok(p.source.startsWith("średnio na trasie: Niemcy 50%"), p.source);
  assert.ok(p.source.includes("średnia PL 30%"), p.source);
});

test("mapkaResolvePrice: a country without a price drops out, the rest is rescaled", () => {
  const shares = { DE: 0.5, PL: 0.25, FR: 0.25 };
  const p = ext.mapkaResolvePrice(settings(), DATA, { origin: WARSAW, dest: { cc: "fr" }, shares });
  close(p.low, (0.5 * 1.8 * 4.3 + 0.25 * 6.2) / 0.75);
});

test("mapkaResolvePrice: currency conversion at the NBP rate", () => {
  close(ext.mapkaResolvePrice(settings({ currency: "EUR" }), DATA, null).low, 6.2 / 4.3);
  const p = ext.mapkaResolvePrice(settings({ currency: "CZK", price: 150 }), DATA, null);
  assert.strictEqual(p.low, 150);
  assert.ok(p.source.startsWith("brak kursu CZK"), p.source);
});

test("mapkaResolvePrice: the price source is shown in the chosen currency", () => {
  const en = loadExtension({ lang: "en" });
  const single = en.mapkaResolvePrice(settings({ currency: "EUR" }), DATA, { origin: WARSAW, dest: WARSAW, shares: null });
  assert.ok(single.source.includes("€1.44"), single.source);
  assert.ok(!single.source.includes("PLN"), single.source);
  const abroad = en.mapkaResolvePrice(settings({ currency: "EUR", localPrices: true }), DATA, { origin: WARSAW, dest: BERLIN, shares: null });
  assert.ok(abroad.source.includes("€1.44") && abroad.source.includes("€1.80"), abroad.source);
});

test("mapkaResolvePrice: EV – home-to-charger range", () => {
  const p = ext.mapkaResolvePrice(settings({ fuelType: "ev", evHomePrice: 1, evFastPrice: 3 }), DATA, null);
  assert.strictEqual(p.low, 1);
  assert.strictEqual(p.high, 3);
  assert.strictEqual(p.unit, "kWh");
});

test("mapkaMileage: mileage allowance rates and currency", () => {
  close(ext.mapkaMileage(100, settings({ mileage: "small" }), DATA), 89);
  close(ext.mapkaMileage(100, settings({ mileage: "large" }), DATA), 115);
  close(ext.mapkaMileage(100, settings({ mileage: "large", currency: "EUR" }), DATA), 115 / 4.3);
  assert.strictEqual(ext.mapkaMileage(100, settings({ mileage: "off" }), DATA), null);
});

test("geocode: Nominatim gets coordinates rounded to ~1 km, the result is cached", async () => {
  const urls = [];
  const fetch = async (url) => {
    urls.push(url);
    return {
      ok: true,
      json: async () => ({ address: { country_code: "pl", "ISO3166-2-lvl4": "PL-14", state: "województwo mazowieckie" } }),
    };
  };
  const bg = loadExtension({ fetch });
  const geo = await bg.geocode(52.229676, 21.012229);
  same(geo, WARSAW);
  assert.strictEqual(urls.length, 1);
  const params = new URL(urls[0]).searchParams;
  assert.strictEqual(params.get("lat"), "52.23");
  assert.strictEqual(params.get("lon"), "21.01");
  await bg.geocode(52.231, 21.009);
  assert.strictEqual(urls.length, 1);
});

const SITE_URL = "https://michalskii.github.io/tankful/prices.json";
const BULLETIN_URL = "https://energy.ec.europa.eu/document/download/264c2d0f-f161-4ea3-a777-78faae59bea0_en";

function sitePrices(age) {
  const at = Date.now() - age;
  return {
    updatedAt: new Date(at).toISOString(),
    fuelPrices: { prices: { pb: 6.5, on: 6.8 }, date: "2026-09-22", fetchedAt: at },
    euPrices: { prices: { PL: { pb: 1.5, on: 1.6 }, DE: { pb: 1.8 } }, date: "2026-09-22", fetchedAt: at },
    nbpRates: { rates: { EUR: 4.3 }, date: "2026-09-26", fetchedAt: at },
  };
}

function priceServer(site) {
  const urls = [];
  const fetch = async (url) => {
    urls.push(url);
    if (url === SITE_URL) {
      if (!site) return { ok: false, status: 503 };
      return { ok: true, json: async () => JSON.parse(JSON.stringify(site)) };
    }
    if (url === BULLETIN_URL) {
      return { ok: true, arrayBuffer: async () => zip({ "xl/sharedStrings.xml": SHARED_STRINGS, "xl/worksheets/sheet1.xml": SHEET }) };
    }
    if (url.startsWith("https://api.nbp.pl/api/exchangerates/rates/a/eur/")) {
      return { ok: true, json: async () => ({ rates: [{ effectiveDate: "2026-09-21", mid: 4.1 }, { effectiveDate: "2026-09-22", mid: 4.2 }] }) };
    }
    if (url.startsWith("https://api.nbp.pl/")) {
      return { ok: true, json: async () => [{ effectiveDate: "2026-09-28", rates: [{ code: "EUR", mid: 4.25 }] }] };
    }
    return { ok: false, status: 404 };
  };
  return { urls, bg: loadExtension({ fetch }) };
}

const stored = (bg, keys) => bg.chrome.storage.local.get(keys);

test("refreshAll: fresh prices from prices.json, no requests to the sources", async () => {
  const { urls, bg } = priceServer(sitePrices(2 * 60 * 60 * 1000));
  const result = await bg.refreshAll(true);
  same(urls, [SITE_URL]);
  assert.strictEqual(result.ok, true);
  const data = await stored(bg, ["fuelPrices", "euPrices", "nbpRates"]);
  same(data.fuelPrices.prices, { pb: 6.5, on: 6.8 });
  same(data.euPrices.prices.DE, { pb: 1.8 });
  same(data.nbpRates.rates, { EUR: 4.3 });
});

test("refreshAll: prices.json at most every 3 h unless forced", async () => {
  const { urls, bg } = priceServer(sitePrices(60 * 60 * 1000));
  await bg.refreshAll();
  await bg.refreshAll();
  assert.strictEqual(urls.length, 1);
  await bg.refreshAll(true);
  assert.strictEqual(urls.length, 2);
});

test("refreshAll: site down → Polish prices from the EU bulletin at the NBP rate of its date, never Orlen", async () => {
  const { urls, bg } = priceServer(null);
  const result = await bg.refreshAll(true);
  assert.strictEqual(result.ok, true, result.errors.join("; "));
  assert.ok(urls.includes(BULLETIN_URL));
  assert.ok(urls.some((u) => u.includes("/rates/a/eur/2024-12-25/2025-01-01/")), urls.join("\n"));
  assert.ok(!urls.some((u) => u.includes("orlen")));
  const { fuelPrices } = await stored(bg, "fuelPrices");
  same(fuelPrices.prices, { pb: 6.09, on: 6.3, lpg: 2.94, onp: 6.3 });
  assert.strictEqual(fuelPrices.date, "2025-01-01");
});

test("refreshAll: stale Polish prices in prices.json are recomputed, and older site data never overwrites newer", async () => {
  const { urls, bg } = priceServer(sitePrices(30 * 60 * 60 * 1000));
  await bg.refreshAll(true);
  assert.ok(!urls.includes(BULLETIN_URL));
  same((await stored(bg, "fuelPrices")).fuelPrices.prices, { pb: 6.3, on: 6.72, onp: 6.72 });
  await bg.refreshAll(true);
  same((await stored(bg, "fuelPrices")).fuelPrices.prices, { pb: 6.3, on: 6.72, onp: 6.72 });
});

const LANGS = fs.readdirSync(path.join(ROOT, "_locales"));
const catalog = (lang) => JSON.parse(source(`_locales/${lang}/messages.json`));
const placeholders = (text) => [...new Set(text.match(/\$\d/g) || [])].sort().join(",");

test("_locales: every language has the same keys and $1…$9 placeholders as English", () => {
  const en = catalog("en");
  for (const lang of LANGS) {
    const msgs = catalog(lang);
    same(Object.keys(msgs).filter((k) => !/_(few|many)$/.test(k)).sort(), Object.keys(en).filter((k) => !/_(few|many)$/.test(k)).sort());
    for (const [key, { message }] of Object.entries(msgs)) {
      if (en[key]) assert.strictEqual(placeholders(message), placeholders(en[key].message), `${lang}: ${key}`);
    }
  }
});

test("_locales: name and description fit the Chrome Web Store limits (75 and 132 characters)", () => {
  for (const lang of LANGS) {
    const msgs = catalog(lang);
    assert.ok(msgs.appName.message.length <= 75, `${lang}: the name has ${msgs.appName.message.length} characters`);
    assert.ok(msgs.appDescription.message.length <= 132, `${lang}: the description has ${msgs.appDescription.message.length} characters`);
  }
});

test("_locales: every key used in code and HTML exists in all languages", () => {
  const files = fs.readdirSync(ROOT).filter((f) => /\.(js|html|json)$/.test(f));
  const used = new Set();
  for (const f of files) {
    const text = source(f).split("\n").filter((line) => !line.trim().startsWith("//")).join("\n");
    for (const m of text.matchAll(/mapkaT\(\s*"(\w+)"/g)) used.add(m[1]);
    for (const m of text.matchAll(/data-i18n(?:-title)?="(\w+)"/g)) used.add(m[1]);
    for (const m of text.matchAll(/__MSG_(\w+)__/g)) used.add(m[1]);
  }
  assert.ok(used.size > 50, `only ${used.size} keys found`);
  for (const lang of LANGS) {
    const missing = [...used].filter((k) => !catalog(lang)[k]);
    same(missing, []);
  }
});

test("mapkaPlural: Polish and English plurals", () => {
  same([1, 2, 5, 22, 25].map((n) => ext.mapkaPlural("trips", n)), ["1 przejazd", "2 przejazdy", "5 przejazdów", "22 przejazdy", "25 przejazdów"]);
  const en = loadExtension({ lang: "en" });
  same([1, 2, 5].map((n) => en.mapkaPlural("trips", n)), ["1 trip", "2 trips", "5 trips"]);
});

test("mapkaFormatNumber: decimal separator follows the language", () => {
  assert.strictEqual(ext.mapkaFormatNumber(7.5), "7,5");
  assert.strictEqual(ext.mapkaFormatNumber(295.04), "295");
  assert.strictEqual(loadExtension({ lang: "en" }).mapkaFormatNumber(7.5), "7.5");
});

test("English version: price descriptions and country names", () => {
  const en = loadExtension({ lang: "en" });
  const s = { ...vm.runInContext("MAPKA_DEFAULTS", en), currency: "PLN", configured: true };
  assert.ok(en.mapkaResolvePrice(s, DATA, null).source.startsWith("Poland avg."));
  assert.ok(en.mapkaResolvePrice(s, DATA, { origin: WARSAW, dest: BERLIN }).source.includes("Germany"));
  assert.strictEqual(en.mapkaResolvePrice({ ...s, autoPrice: false }, DATA, null).source, "manual price");
  assert.strictEqual(vm.runInContext("MAPKA_FUELS.on", en), "Diesel");
});

test("mapkaUserCountry: time zone takes precedence over language", () => {
  assert.strictEqual(ext.mapkaUserCountry("Europe/Warsaw", "en-US"), "PL");
  assert.strictEqual(ext.mapkaUserCountry("Europe/Berlin", "pl"), "DE");
  assert.strictEqual(ext.mapkaUserCountry("Atlantic/Canary", "en"), "ES");
  assert.strictEqual(ext.mapkaUserCountry("America/Chicago", "de"), "DE");
  assert.strictEqual(ext.mapkaUserCountry("UTC", "en-GB"), "GB");
});

test("mapkaCountryCurrency: the country's currency, euro for the eurozone", () => {
  const cases = { PL: "PLN", DE: "EUR", BG: "EUR", HR: "EUR", CZ: "CZK", HU: "HUF", GB: "GBP", CH: "CHF", SE: "SEK" };
  for (const [cc, cur] of Object.entries(cases)) assert.strictEqual(ext.mapkaCountryCurrency(cc), cur, cc);
  assert.strictEqual(ext.mapkaCountryCurrency(null), "EUR");
});

test("mapkaStartPrice: starting manual prices in the country's currency", () => {
  assert.strictEqual(ext.mapkaStartPrice(6.2, "PLN"), 6.2);
  assert.strictEqual(ext.mapkaStartPrice(6.2, "EUR"), 1.43);
  assert.strictEqual(ext.mapkaStartPrice(6.2, "HUF"), 558);
  assert.strictEqual(ext.mapkaStartPrice(1.1, "EUR"), 0.25);
});

test("currencies: each one has an NBP rate and a rough starting rate", () => {
  const currencies = vm.runInContext("MAPKA_CURRENCIES", ext);
  const rough = vm.runInContext("MAPKA_ROUGH_PER_PLN", ext);
  const countryCurrencies = Object.values(vm.runInContext("MAPKA_COUNTRY_CURRENCY", ext));
  for (const cur of [...currencies, ...countryCurrencies]) {
    assert.ok(currencies.includes(cur), `${cur} is not in the currency list`);
    assert.ok(rough[cur], `${cur} has no starting rate`);
  }
});

test("manifest: Google Maps in every EU country and for every listed time zone", () => {
  const matches = JSON.parse(source("manifest.json")).content_scripts[0].matches;
  const hosts = new Set(matches.map((m) => new URL(m.replace("*", "")).host));
  const tld = { GB: "co.uk", CY: "com.cy", MT: "com.mt" };
  const countries = new Set(Object.values(vm.runInContext("MAPKA_TIMEZONES", ext)));
  for (const cc of countries) {
    const t = tld[cc] || cc.toLowerCase();
    assert.ok(hosts.has(`www.google.${t}`) && hosts.has(`maps.google.${t}`), `missing google.${t}`);
  }
  assert.ok(hosts.has("www.google.com"));
});

test("manifest: every icon exists and has its declared size (PNG with transparency)", () => {
  const m = JSON.parse(source("manifest.json"));
  const all = { ...m.icons, ...m.action.default_icon };
  assert.ok(all["128"], "missing the 128 px icon required by the Chrome Web Store");
  for (const [size, file] of Object.entries(all)) {
    const png = fs.readFileSync(path.join(ROOT, file));
    assert.strictEqual(png.toString("ascii", 1, 4), "PNG", file);
    assert.strictEqual(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, `${size}x${size}`, file);
    assert.strictEqual(png[25], 6, `${file}: no alpha channel`);
  }
});

test("store: promo graphics have the required size and are 24-bit PNG without alpha", () => {
  const graphics = [["store/promo-tile-440x280.png", "440x280"]];
  const langs = fs.readdirSync(path.join(ROOT, "store"), { withFileTypes: true }).filter((e) => e.isDirectory() && /^[a-z]{2}$/.test(e.name));
  assert.ok(langs.length >= 1, "no screenshot folders in store/<language>");
  for (const { name: lang } of langs) {
    const shots = fs.readdirSync(path.join(ROOT, "store", lang)).filter((f) => /^screenshot-.*\.png$/.test(f));
    assert.ok(shots.length >= 1 && shots.length <= 5, `${lang}: the store accepts 1–5 screenshots, found ${shots.length}`);
    graphics.push(...shots.map((f) => [`store/${lang}/${f}`, "1280x800"]));
  }
  for (const [file, size] of graphics) {
    const png = fs.readFileSync(path.join(ROOT, file));
    assert.strictEqual(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, size, file);
    assert.strictEqual(png[25], 2, `${file}: should be RGB without an alpha channel`);
  }
});

test("site: language from the URL, old ?lang= redirects to /en or the home page", () => {
  const run = (href) => {
    let redirect = null;
    const ctx = {
      URL,
      MAPKA_MESSAGES: { pl: {}, en: {} },
      location: { href, replace: (u) => (redirect = String(u)) },
      window: {},
    };
    vm.runInNewContext(source("site/public/boot.js"), ctx);
    return { lang: ctx.window.chrome.i18n.getUILanguage(), redirect };
  };
  const base = "https://michalskii.github.io/tankful/";
  same(run(base), { lang: "pl", redirect: null });
  same(run(`${base}en`), { lang: "en", redirect: null });
  same(run(`${base}en.html?from=x`), { lang: "en", redirect: null });
  same(run(`${base}?lang=en&from=x`).redirect, `${base}en?from=x`);
  same(run(`${base}en?lang=pl&from=x`).redirect, `${base}?from=x`);
  same(run(`${base}?lang=pl`).redirect, null);
  same(run(`${base}route/warsaw-krakow`), { lang: "en", redirect: null });
  same(run(`${base}trasa/warszawa-krakow?from=x`), { lang: "pl", redirect: null });
});

test("site: routes have known cities, unique URLs and OSRM data", () => {
  const { cities, routes } = JSON.parse(source("site/src/lib/routes.json"));
  const regions = vm.runInContext("MAPKA_REGIONS", ext);
  for (const [key, c] of Object.entries(cities)) {
    assert.ok(c.pl && c.en && Math.abs(c.lat) <= 90 && Math.abs(c.lng) <= 180, key);
    if (c.cc === "pl") assert.ok(regions[c.region], `${key}: unknown region ${c.region}`);
  }
  for (const lang of ["pl", "en"]) {
    const slugs = routes.map((r) => r[lang]);
    same(slugs.filter((x, i) => slugs.indexOf(x) !== i), []);
    for (const slug of slugs) assert.match(slug, /^[a-z0-9]+(-[a-z0-9]+)+$/);
  }
  for (const r of routes) {
    assert.ok(cities[r.from] && cities[r.to], r.pl);
    assert.ok(r.km > 10 && r.minutes > 10, r.pl);
    if (r.shares) assert.ok(Math.abs(Object.values(r.shares).reduce((a, b) => a + b, 0) - 1) < 0.01, `${r.pl}: country shares do not add up to 100%`);
  }
});

test("site: PL and EN texts have the same keys and every key used in site/ exists", () => {
  const code = source("site/src/lib/strings.ts").replace(/^export /gm, "").split("\ntype Key")[0];
  const strings = vm.runInNewContext(`${code}; SITE_STRINGS`);
  same(Object.keys(strings.en).sort(), Object.keys(strings.pl).sort());
  const walk = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? (e.name === "ui" ? [] : walk(path.join(dir, e.name))) : [path.join(dir, e.name)]
    );
  const files = walk(path.join(ROOT, "site/src")).filter((f) => /\.tsx?$/.test(f));
  const used = new Set();
  for (const f of files) {
    const text = fs.readFileSync(f, "utf8");
    for (const m of text.matchAll(/\bT\("(\w+)"/g)) used.add(m[1]);
    for (const m of text.matchAll(/mapkaT\("(\w+)"/g)) {
      for (const lang of LANGS) assert.ok(catalog(lang)[m[1]], `${lang}: missing ${m[1]}`);
    }
  }
  assert.ok(used.size > 20, `only ${used.size} keys found`);
  same([...used].filter((k) => !strings.pl[k]), []);
});

test("package: contains every file the extension references and nothing else", () => {
  const files = new Set(require("../tools/pack").packageFiles());
  const m = JSON.parse(source("manifest.json"));
  const needed = new Set([
    "manifest.json",
    m.background.service_worker,
    m.action.default_popup,
    ...Object.values(m.icons),
    ...Object.values(m.action.default_icon),
    ...m.content_scripts.flatMap((c) => [...c.js, ...(c.css || [])]),
    `_locales/${m.default_locale}/messages.json`,
  ]);
  for (const f of [...files].filter((f) => /\.(html|js)$/.test(f))) {
    const text = source(f);
    for (const r of text.matchAll(/(?:src|href)="([^":]+\.(?:js|css))"/g)) needed.add(r[1]);
    for (const r of text.matchAll(/importScripts\("([^"]+)"\)/g)) needed.add(r[1]);
    for (const r of text.matchAll(/url: "([\w-]+\.html)"/g)) needed.add(r[1]);
  }
  same([...needed].filter((f) => !files.has(f)), []);
  same([...files].filter((f) => /^(tests|tools|store|dist|\.idea)\//.test(f) || f.endsWith(".svg")), []);
});

test("privacy policy: names every permitted domain and uses the UI labels", () => {
  const policy = source("docs/privacy.html");
  const m = JSON.parse(source("manifest.json"));
  same(policy.match(/\[[A-ZĄĆĘŁŃÓŚŹŻ][A-ZĄĆĘŁŃÓŚŹŻ -]+\]/g) || [], []);
  for (const host of m.host_permissions.map((h) => new URL(h.replace("*", "")).host)) {
    const name = host.replace(/^www\./, "").replace(/^nominatim\./, "");
    assert.ok(policy.includes(name), `the policy does not mention ${host}`);
  }
  assert.deepStrictEqual(m.permissions.slice().sort(), ["alarms", "storage"], "new permission – update the privacy policy");
  for (const [lang, keys] of [["en", ["popup_local_prices", "float_copy", "float_save", "history_export"]], ["pl", ["popup_local_prices", "float_copy", "float_save", "history_export"]]]) {
    const msgs = catalog(lang);
    for (const key of keys) {
      const label = msgs[key].message.replace(/^[^\p{L}]+/u, "");
      assert.ok(policy.includes(label), `${lang}: the policy does not use the label "${label}" (${key})`);
    }
  }
});

(async () => {
  let failed = 0;
  for (const { name, fn } of tests) {
    try {
      const note = await fn();
      console.log(`ok    ${name}${note ? ` (${note})` : ""}`);
    } catch (e) {
      failed++;
      console.log(`FAIL  ${name}\n      ${e.message.split("\n").join("\n      ")}`);
    }
  }
  console.log(`\n${tests.length - failed}/${tests.length} tests passed`);
  process.exitCode = failed ? 1 : 0;
})();
