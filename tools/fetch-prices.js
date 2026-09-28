const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const [out, previousUrl] = process.argv.slice(2);
if (!out) throw new Error("Podaj ścieżkę pliku wyjściowego");

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
  const { errors } = await context.refreshSources(true);
  const slugs = [...new Set(Object.values(vm.runInContext("MAPKA_REGIONS", context)))];
  for (const slug of slugs) {
    await context.ensureRegion(slug, true).catch((e) => errors.push(`${slug}: ${e.message}`));
    await new Promise((r) => setTimeout(r, 1000));
  }

  const old = await previous();
  const result = { updatedAt: new Date().toISOString() };
  for (const key of ["fuelPrices", "euPrices", "nbpRates"]) result[key] = store[key] || old[key] || null;
  result.regionalPrices = { ...old.regionalPrices, ...store.regionalPrices };

  const missing = ["fuelPrices", "euPrices", "nbpRates"].filter((k) => !result[k]);
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(result));
  for (const e of errors) console.warn(`uwaga: ${e}`);
  console.log(`${out}: ${Object.keys(result.regionalPrices).length} województw, kraje UE: ${Object.keys(result.euPrices?.prices || {}).length}`);
  if (missing.length) {
    console.error(`brak danych: ${missing.join(", ")}`);
    process.exit(1);
  }
})();
