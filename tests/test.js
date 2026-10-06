process.env.TZ = "Europe/Warsaw";
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

const NOW = Date.parse("2026-09-30T12:00:00Z");
class FixedDate extends Date {
  constructor(...args) {
    super(...(args.length ? args : [NOW]));
  }
  static now() {
    return NOW;
  }
}

function loadExtension({ fetch, lang = "pl" } = {}) {
  const store = {};
  const listener = { addListener() {} };
  const context = vm.createContext({
    console,
    Date: FixedDate,
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
  same(ext.polandPrices(BULLETIN, 4.35, null, "2026-09-22"), { pb: 7.92, on: 8.87, lpg: 3.13, onp: 8.87 });
  assert.throws(() => ext.polandPrices({ prices: { DE: { pb: 1.8 } } }, 4.35), /brak cen dla Polski/);
});

test("polandPrices: Orlen net wholesale shift gets VAT and gives Pb98", () => {
  same(ext.polandPrices(BULLETIN, 4.35, { pb: 0.3, on: 0, pbpSpread: 0.81 }, "2026-09-22"), { pb: 8.29, on: 8.87, lpg: 3.13, pbp: 9.28, onp: 8.87 });
});

test("polandPrices: reduced 8% VAT on petrol and diesel from 3 October 2026, not on LPG", () => {
  same(ext.polandPrices(BULLETIN, 4.35, null, "2026-10-03"), { pb: 6.95, on: 7.79, lpg: 3.13, onp: 7.79 });
  same(ext.polandPrices(BULLETIN, 4.35, null, "2027-01-01"), { pb: 7.92, on: 8.87, lpg: 3.13, onp: 8.87 });
  same(ext.polandPrices({ ...BULLETIN, date: "2026-10-05" }, 4.35, null, "2026-10-06"), { pb: 7.92, on: 8.87, lpg: 3.13, onp: 8.87 });
});

test("mapkaLocalPricePln: without a route the user's own country, Poland only as a fallback", () => {
  const data = { fuelPrices: { prices: { pb: 6.75 } }, euPrices: { prices: { FR: { pb: 1.8 } } }, nbpRates: { rates: { EUR: 4.3 } } };
  const s = { fuelType: "pb", localPrices: true };
  close(ext.mapkaLocalPricePln(s, data, null, "FR").price, 1.8 * 4.3);
  close(ext.mapkaLocalPricePln({ ...s, localPrices: false }, data, { cc: "pl" }, "FR").price, 1.8 * 4.3);
  close(ext.mapkaLocalPricePln(s, data, null, "PL").price, 6.75);
  close(ext.mapkaLocalPricePln(s, data, null, "CH").price, 6.75);
  close(ext.mapkaLocalPricePln(s, data, { cc: "pl" }, "FR").price, 6.75);
  assert.strictEqual(ext.mapkaLocalPricePln(s, data, { cc: "ch" }, "FR"), null);
});

test("mapkaReviewDue: ask after a week of real use, never after rating, not while snoozed", () => {
  const day = 86400000;
  const now = Date.parse("2026-10-20T12:00:00Z");
  const used = { installedAt: now - 10 * day, routes: 20 };
  assert.strictEqual(ext.mapkaReviewDue(used, 0, now), true);
  assert.strictEqual(ext.mapkaReviewDue({ ...used, routes: 19 }, 0, now), false);
  assert.strictEqual(ext.mapkaReviewDue({ ...used, routes: 0 }, 3, now), true);
  assert.strictEqual(ext.mapkaReviewDue({ ...used, installedAt: now - 6 * day }, 0, now), false);
  assert.strictEqual(ext.mapkaReviewDue({ ...used, done: true }, 0, now), false);
  assert.strictEqual(ext.mapkaReviewDue({ ...used, snoozeUntil: now + day }, 0, now), false);
  assert.strictEqual(ext.mapkaReviewDue({ ...used, snoozeUntil: now - day }, 0, now), true);
  assert.strictEqual(ext.mapkaReviewDue({ routes: 50 }, 5, now), false);
  assert.strictEqual(ext.mapkaReviewDue(undefined, 5, now), false);
});

test("orlenShift: the latest net wholesale price against the bulletin week, above the threshold", () => {
  const flat = wholesale([6300, 6400, 6250, 6350, 6300, 6400, 6250, 6350, 6300, 6280]);
  assert.strictEqual(ext.orlenShift(flat, "2026-09-19"), 0);
  const rising = wholesale([6000, 6000, 6000, 6000, 6000, 6000, 6300, 6300, 6300, 6300, 6300]);
  close(ext.orlenShift(rising, "2026-09-19"), 0.3);
  const cut = wholesale([6300, 6300, 6300, 6300, 6300, 6300, 6300, 6050]);
  close(ext.orlenShift(cut, "2026-09-19"), -0.25);
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

const history = require("../tools/history");
const HISTORY_STRINGS = `<sst>
  <si><t>PL_exchange_rate</t></si>
  <si><t>PL_price_with_tax_euro95</t></si>
  <si><t>PL_price_with_tax_LPG</t></si>
  <si><t>DE_price_with_tax_diesel</t></si>
  <si><t>UK_price_with_tax_euro95</t></si>
  <si><t>Date</t></si>
</sst>`;
const HISTORY_SHEET = `<worksheet><sheetData>
  <row r="1"><c r="B1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c><c r="D1" t="s"><v>2</v></c><c r="E1" t="s"><v>3</v></c><c r="F1" t="s"><v>4</v></c></row>
  <row r="2"><c r="A2" t="s"><v>5</v></c></row>
  <row r="3"><c r="A3"><v>45665</v></c><c r="B3"><v>0.25</v></c><c r="C3"><v>1500</v></c><c r="D3"><v>700</v></c><c r="E3"><v>1650.4</v></c><c r="F3"><v>1600</v></c></row>
  <row r="4"><c r="A4"><v>45658</v></c><c r="B4"><v>0.2</v></c><c r="C4"><v>1400</v></c><c r="E4"><v>0</v></c></row>
</sheetData></worksheet>`;
const EXPECTED_HISTORY = {
  dates: ["2025-01-01", "2025-01-08"],
  plnPerEur: [5, 4],
  prices: { PL: { pb: [1.4, 1.5], lpg: [null, 0.7] }, DE: { on: [null, 1.65] } },
};

test("parseHistory: weekly EUR/l series oldest first, PLN rate, EU countries only", () => {
  same(history.parseHistory(HISTORY_STRINGS, HISTORY_SHEET), EXPECTED_HISTORY);
});

test("parseHistory: no Polish data is an error", () => {
  assert.throws(() => history.parseHistory("<sst><si><t>DE_price_with_tax_diesel</t></si></sst>", `<worksheet><sheetData>
  <row r="1"><c r="B1" t="s"><v>0</v></c></row><row r="2"><c r="A2"><v>45658</v></c><c r="B2"><v>1600</v></c></row>
</sheetData></worksheet>`), /no data for Poland/);
});

test("history unzip: deflate-compressed entries", () => {
  const files = { "xl/sharedStrings.xml": HISTORY_STRINGS, "xl/worksheets/sheet1.xml": HISTORY_SHEET };
  const out = history.unzip(Buffer.from(zip(files, true)), Object.keys(files));
  same(history.parseHistory(out["xl/sharedStrings.xml"], out["xl/worksheets/sheet1.xml"]), EXPECTED_HISTORY);
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

test("borders.js: borders cover exactly the EC bulletin countries and the UK", () => {
  const eu = vm.runInContext("Object.values(EU_NAMES)", ext);
  same(vm.runInContext("Object.keys(MAPKA_BORDERS)", ext).sort(), [...eu, "GB"].sort());
});

test("mapkaCountryAt: cities in the EU, outside it and at sea", () => {
  assert.strictEqual(ext.mapkaCountryAt(PLACES.warszawa), "PL");
  assert.strictEqual(ext.mapkaCountryAt(PLACES.paryz), "FR");
  assert.strictEqual(ext.mapkaCountryAt({ lng: -0.13, lat: 51.51 }), "GB");
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

const UK_CSV = "\uFEFFDate,ULSP Pump price in pence/litre,ULSD Pump price in pence/litre,ULSP Duty,ULSD Duty,ULSP VAT,ULSD VAT\r\n" +
  "14/09/2026,168.14,190.72,52.95,52.95,20,20\r\n21/09/2026,172.01,195.53,52.95,52.95,20,20\r\n";

test("parseUkFuelCsv: the latest weekly UK pump prices in GBP per litre", () => {
  same(ext.parseUkFuelCsv(UK_CSV), { prices: { pb: 1.7201, on: 1.9553 }, date: "2026-09-21" });
  assert.throws(() => ext.parseUkFuelCsv("Date,ULSP,ULSD\n"), /no data/);
});

test("mapkaResolvePrice: UK prices converted at the NBP GBP rate, premium fuels at the regular price", () => {
  const data = { ...DATA, ukPrices: { prices: { pb: 1.72, on: 1.96 }, date: "2026-09-21" } };
  const LONDON = { cc: "gb", region: null, regionName: null };
  close(ext.mapkaResolvePrice(settings(), data, { origin: LONDON, dest: LONDON }).low, 1.72 * 5.0);
  close(ext.mapkaResolvePrice(settings({ fuelType: "onp", currency: "GBP" }), data, { origin: LONDON, dest: LONDON }).low, 1.96);
  const noUk = ext.mapkaResolvePrice(settings({ price: 7 }), DATA, { origin: LONDON, dest: LONDON });
  assert.strictEqual(noUk.auto, false);
});

const EIA_RSS = fs.readFileSync(path.join(__dirname, "eia-rss.xml"), "latin1");

test("parseEiaRss: US national, regional and state gasoline and diesel in USD per litre", () => {
  const { prices, areas, date } = ext.parseEiaRss(EIA_RSS);
  const gal = (v) => Math.round(v * 3.785411784 * 1000) / 1000;
  assert.strictEqual(date, "2026-09-28");
  same({ pb: gal(prices.pb), on: gal(prices.on) }, { pb: 4.465, on: 6.382 });
  same({ pb: gal(areas.CA.pb), on: gal(areas.CA.on) }, { pb: 6.189, on: 8.181 });
  same({ pb: gal(areas["5XCA"].pb), on: gal(areas["5XCA"].on) }, { pb: 5.153, on: 6.643 });
  same({ pb: gal(areas["3"].pb), on: gal(areas["3"].on) }, { pb: 3.924, on: 5.955 });
  assert.strictEqual(gal(areas.TX.pb), 3.841);
  assert.strictEqual(areas.TX.on, undefined);
  same(Object.keys(areas).sort(), ["1A", "1B", "1C", "2", "3", "4", "5", "5XCA", "CA", "CO", "FL", "MA", "MN", "NY", "OH", "TX", "WA"]);
  assert.throws(() => ext.parseEiaRss("<rss><channel></channel></rss>"), /no data/);
});

test("mapkaResolvePrice: US state price, else the state's EIA region, else the national average", () => {
  const data = {
    ...DATA,
    nbpRates: { rates: { ...DATA.nbpRates.rates, USD: 4.0 } },
    usPrices: { prices: { pb: 1.2, on: 1.6 }, areas: { CA: { pb: 1.6, on: 2.1 }, "5XCA": { pb: 1.4, on: 1.8 }, "3": { pb: 1.0, on: 1.5 }, TX: { pb: 0.98 } } },
  };
  const at = (region, regionName = null) => ({ cc: "us", region, regionName });
  const usd = (fuelType, origin, dest = origin) => ext.mapkaResolvePrice(settings({ fuelType, currency: "USD" }), data, { origin, dest });
  close(usd("pb", at("US-CA", "California")).low, 1.6);
  const oregon = usd("pb", at("US-OR", "Oregon"));
  close(oregon.low, 1.4);
  assert.ok(oregon.source.includes("Oregon"), oregon.source);
  close(usd("pb", at("US-TX")).low, 0.98);
  close(usd("on", at("US-TX")).low, 1.5);
  close(usd("pb", at(null)).low, 1.2);
  close(usd("pb", at("US-NY")).low, 1.2);
  const cross = usd("pb", at("US-TX", "Texas"), at("US-CA", "California"));
  close(cross.low, (0.98 + 1.6) / 2);
  assert.ok(cross.source.includes("Texas") && cross.source.includes("California"), cross.source);
  close(usd("pb", at("US-CA", "California"), at("US-CA", "California")).low, 1.6);
});

test("mapkaResolvePrice: US prices converted at the NBP USD rate and shown per gallon", () => {
  const data = { ...DATA, nbpRates: { rates: { ...DATA.nbpRates.rates, USD: 4.0 } }, usPrices: { prices: { pb: 1.2, on: 1.6 }, date: "2026-09-28" } };
  const DENVER = { cc: "us", region: null, regionName: null };
  close(ext.mapkaResolvePrice(settings(), data, { origin: DENVER, dest: DENVER }).low, 1.2 * 4.0);
  const usd = ext.mapkaResolvePrice(settings({ fuelType: "onp", currency: "USD", units: "us" }), data, { origin: DENVER, dest: DENVER });
  close(usd.low, 1.6);
  assert.ok(usd.source.includes("/gal"), usd.source);
  assert.strictEqual(ext.mapkaResolvePrice(settings({ price: 7 }), DATA, { origin: DENVER, dest: DENVER }).auto, false);
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

const SITE_URL = "https://koszt-paliwa.pl/prices.json";
const OLD_SITE_URL = "https://michalskii.github.io/tankful/prices.json";
const BULLETIN_URL = "https://energy.ec.europa.eu/document/download/264c2d0f-f161-4ea3-a777-78faae59bea0_en";

function sitePrices(age) {
  const at = NOW - age;
  return {
    updatedAt: new Date(at).toISOString(),
    fuelPrices: { prices: { pb: 6.5, on: 6.8 }, date: "2026-09-22", fetchedAt: at },
    euPrices: { prices: { PL: { pb: 1.5, on: 1.6 }, DE: { pb: 1.8 } }, date: "2026-09-22", fetchedAt: at },
    nbpRates: { rates: { EUR: 4.3 }, date: "2026-09-26", fetchedAt: at },
  };
}

function priceServer(site, siteUrl = SITE_URL) {
  const urls = [];
  const fetch = async (url) => {
    urls.push(url);
    if (url === siteUrl) {
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

test("refreshAll: prices.json from the old GitHub Pages address when the domain fails", async () => {
  const { urls, bg } = priceServer(sitePrices(2 * 60 * 60 * 1000), OLD_SITE_URL);
  const result = await bg.refreshAll(true);
  same(urls, [SITE_URL, OLD_SITE_URL]);
  assert.strictEqual(result.ok, true);
  const { fuelPrices } = await stored(bg, "fuelPrices");
  same(fuelPrices.prices, { pb: 6.5, on: 6.8 });
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

test("units: US display converts to and from the metric values that are stored", () => {
  close(ext.mapkaToConsumption(7, "pb", "us"), 378.5411784 / 1.609344 / 7);
  close(ext.mapkaFromConsumption(ext.mapkaToConsumption(6.4, "on", "us"), "on", "us"), 6.4);
  close(ext.mapkaToConsumption(17, "ev", "us"), 17 * 1.609344);
  close(ext.mapkaFromConsumption(27.358848, "ev", "us"), 17);
  assert.strictEqual(ext.mapkaToConsumption(7, "pb", "metric"), 7);
  assert.strictEqual(ext.mapkaFromConsumption(0, "pb", "us"), 0);
  close(ext.mapkaToDistance(160.9344, "us"), 100);
  close(ext.mapkaToVolume(3.785411784, "pb", "us"), 1);
  assert.strictEqual(ext.mapkaToVolume(20, "ev", "us"), 20);
  close(ext.mapkaFromUnitPrice(ext.mapkaToUnitPrice(1.5, "pb", "us"), "pb", "us"), 1.5);
  assert.strictEqual(ext.mapkaToUnitPrice(0.3, "ev", "us"), 0.3);
  assert.strictEqual(ext.mapkaRoundConsumption(8.4, "pb", "us"), 28);
});

test("units: labels, the fuel formula and the price description in US units", () => {
  assert.strictEqual(ext.mapkaConsumptionUnit("pb", "us"), "mpg");
  assert.strictEqual(ext.mapkaConsumptionUnit("ev", "us"), "kWh/100 mi");
  assert.strictEqual(ext.mapkaConsumptionUnit("pb"), "l/100 km");
  assert.strictEqual(ext.mapkaFormatDistance(160.9344, "us", 0), "100 mi");
  const us = settings({ units: "us" });
  assert.strictEqual(ext.mapkaFuelFormula(160.9344, us), "100 mi ÷ 33,6 mpg = 3 gal");
  assert.strictEqual(ext.mapkaFuelFormula(100, settings()), "100 km × 7 l/100 km = 7 l");
  close(ext.mapkaCostPer100(us, 1), 7 * 1.609344);
  const p = ext.mapkaResolvePrice(us, DATA, null);
  assert.strictEqual(p.low, 6.2);
  assert.ok(/23,47\s*zł\/gal$/.test(p.source), p.source);
  assert.ok(/6,20\s*zł\/l$/.test(ext.mapkaResolvePrice(settings(), DATA, null).source));
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
  const base = "https://koszt-paliwa.pl/";
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
    assert.ok(c.pl && c.en && c.de && Math.abs(c.lat) <= 90 && Math.abs(c.lng) <= 180, key);
    if (c.cc === "pl") assert.ok(regions[c.region], `${key}: unknown region ${c.region}`);
  }
  for (const lang of ["pl", "en", "de"]) {
    const slugs = routes.map((r) => r[lang]).filter(Boolean);
    same(slugs.filter((x, i) => slugs.indexOf(x) !== i), []);
    for (const slug of slugs) assert.match(slug, /^[a-z0-9]+(-[a-z0-9]+)+$/);
  }
  for (const r of routes) {
    assert.ok(cities[r.from] && cities[r.to], r.pl ?? r.de);
    assert.ok(r.deOnly ? r.de && !r.pl && !r.en : r.pl && r.en, `${r.pl ?? r.de}: slugs`);
    assert.ok(r.km > 10 && r.minutes > 10, r.pl);
    if (r.shares) assert.ok(Math.abs(Object.values(r.shares).reduce((a, b) => a + b, 0) - 1) < 0.01, `${r.pl}: country shares do not add up to 100%`);
  }
});

test("site: every language has the same texts keys and every key used in site/ exists", () => {
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
  same([...files].filter((f) => f.startsWith("icons/") && !needed.has(f)), []);
  same([...files].filter((f) => /^(tests|tools|store|dist|\.idea)\//.test(f) || f.endsWith(".svg")), []);
});

test("package: Firefox manifest loads the background as scripts and keeps everything else", () => {
  const m = JSON.parse(source("manifest.json"));
  const ff = require("../tools/pack").firefoxManifest(m);
  same(ff.background, { scripts: ["settings.js", m.background.service_worker] });
  assert.match(ff.browser_specific_settings.gecko.id, /^[\w.-]+@[\w.-]+$/);
  same(ff.browser_specific_settings.gecko.data_collection_permissions.required, ["locationInfo"]);
  const { background, browser_specific_settings, ...rest } = ff;
  same({ ...rest, background: m.background }, m);
});

test("manifest: every Google Maps pattern is also a host permission, so open tabs get the script on install", () => {
  const m = JSON.parse(source("manifest.json"));
  same(m.content_scripts[0].matches.filter((p) => !m.host_permissions.includes(p)), []);
  assert.ok(m.permissions.includes("scripting"));
  assert.match(source("background.js"), /reason === "install"\) injectIntoOpenMaps\(\)/);
  assert.match(source("content.js"), /if \(globalThis\.mapkaStarted\) return;/);
});

test("review link: each browser goes to the store it installs from", () => {
  const url = (userAgent) => {
    ext.navigator = { userAgent };
    return vm.runInContext("mapkaReviewUrl()", ext);
  };
  assert.match(url("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"), /^https:\/\/chromewebstore\.google\.com\/detail\/fiogjemolijaleckapbcngibelfbpfgp\/reviews/);
  assert.match(url("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0"), /^https:\/\/addons\.mozilla\.org\/firefox\/addon\/tankful\/reviews\/$/);
  assert.match(url("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 OPR/124.0.0.0"), /^https:\/\/addons\.opera\.com\/extensions\/details\/tankful-fuel-cost-for-every-route\/$/);
  delete ext.navigator;
});

test("privacy policy: names every permitted domain and uses the UI labels", () => {
  const policy = source("docs/privacy.html");
  const m = JSON.parse(source("manifest.json"));
  same(policy.match(/\[[A-ZĄĆĘŁŃÓŚŹŻ][A-ZĄĆĘŁŃÓŚŹŻ -]+\]/g) || [], []);
  const maps = m.content_scripts[0].matches;
  for (const host of m.host_permissions.filter((h) => !maps.includes(h)).map((h) => new URL(h.replace("*", "")).host)) {
    const name = host.replace(/^www\./, "").replace(/^nominatim\./, "");
    assert.ok(policy.includes(name), `the policy does not mention ${host}`);
  }
  assert.ok(policy.includes("already open"), "the policy does not explain starting in Google Maps tabs that are already open");
  assert.deepStrictEqual(m.permissions.slice().sort(), ["alarms", "scripting", "storage"], "new permission – update the privacy policy");
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
