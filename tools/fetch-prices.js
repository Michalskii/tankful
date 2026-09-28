const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const [out, previousUrl] = process.argv.slice(2);
if (!out) throw new Error("Pass the output file path");

const messages = JSON.parse(fs.readFileSync(path.join(ROOT, "_locales/pl/messages.json"), "utf8"));
const store = {};
const listener = { addListener() {} };
const context = vm.createContext({
  console, TextDecoder, URL, Blob, Response, DecompressionStream, setTimeout, fetch,
  chrome: {
    i18n: { getUILanguage: () => "pl", getMessage: (key) => messages[key]?.message || "" },
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
const run = (file) => vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), context, { filename: file });
context.importScripts = run;
run("background.js");

async function previous() {
  if (!previousUrl) return {};
  try {
    const res = await fetch(previousUrl, { cache: "no-store" });
    return res.ok ? await res.json() : {};
  } catch {
    return {};
  }
}

(async () => {
  const { errors } = await context.refreshSources(true, { orlen: true, uk: true });

  const old = await previous();
  const result = { updatedAt: new Date().toISOString() };
  for (const key of ["fuelPrices", "euPrices", "nbpRates", "ukPrices"]) result[key] = store[key] || old[key] || null;

  const missing = ["fuelPrices", "euPrices", "nbpRates"].filter((k) => !result[k]);
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(result));
  for (const e of errors) console.warn(`warning: ${e}`);
  const pl = result.fuelPrices;
  console.log(`${out}: Poland ${JSON.stringify(pl?.prices)} (bulletin ${pl?.date}, Orlen shift ${JSON.stringify(pl?.orlen)}), EU countries: ${Object.keys(result.euPrices?.prices || {}).length}, UK ${JSON.stringify(result.ukPrices?.prices)} (${result.ukPrices?.date})`);
  if (missing.length) {
    console.error(`missing data: ${missing.join(", ")}`);
    process.exit(1);
  }
})();
