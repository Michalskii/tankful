function mapkaT(key, ...subs) {
  return chrome.i18n.getMessage(key, subs.map(String)) || key;
}

function mapkaPlural(base, n) {
  const form = new Intl.PluralRules(MAPKA_LOCALE).select(n);
  return chrome.i18n.getMessage(`${base}_${form}`, [String(n)]) || mapkaT(`${base}_other`, n);
}

function mapkaLocalizePage(root = document) {
  for (const el of root.querySelectorAll("[data-i18n]")) el.textContent = mapkaT(el.dataset.i18n);
  for (const el of root.querySelectorAll("[data-i18n-title]")) el.title = mapkaT(el.dataset.i18nTitle);
  if (root === document) document.documentElement.lang = MAPKA_LOCALE;
}

const MAPKA_LOCALE = chrome.i18n.getUILanguage();

const MAPKA_TIMEZONES = {
  "Europe/Warsaw": "PL", "Europe/Berlin": "DE", "Europe/Busingen": "DE", "Europe/Paris": "FR",
  "Europe/Madrid": "ES", "Atlantic/Canary": "ES", "Africa/Ceuta": "ES", "Europe/Rome": "IT",
  "Europe/Amsterdam": "NL", "Europe/Brussels": "BE", "Europe/Luxembourg": "LU", "Europe/Vienna": "AT",
  "Europe/Zurich": "CH", "Europe/Prague": "CZ", "Europe/Bratislava": "SK", "Europe/Budapest": "HU",
  "Europe/Bucharest": "RO", "Europe/Sofia": "BG", "Europe/Athens": "GR", "Europe/Lisbon": "PT",
  "Atlantic/Madeira": "PT", "Atlantic/Azores": "PT", "Europe/Dublin": "IE", "Europe/London": "GB",
  "Europe/Copenhagen": "DK", "Europe/Stockholm": "SE", "Europe/Oslo": "NO", "Europe/Helsinki": "FI",
  "Europe/Tallinn": "EE", "Europe/Riga": "LV", "Europe/Vilnius": "LT", "Europe/Ljubljana": "SI",
  "Europe/Zagreb": "HR", "Asia/Nicosia": "CY", "Europe/Nicosia": "CY", "Europe/Malta": "MT",
  "Atlantic/Reykjavik": "IS",
};

const MAPKA_COUNTRY_CURRENCY = {
  PL: "PLN", CZ: "CZK", HU: "HUF", RO: "RON", SE: "SEK", DK: "DKK",
  GB: "GBP", CH: "CHF", NO: "NOK", IS: "ISK", US: "USD",
};

const MAPKA_CURRENCIES = ["PLN", "EUR", "CZK", "HUF", "RON", "SEK", "DKK", "GBP", "CHF", "NOK", "ISK", "USD"];

function mapkaUserCountry(timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone, locale = MAPKA_LOCALE) {
  if (MAPKA_TIMEZONES[timeZone]) return MAPKA_TIMEZONES[timeZone];
  try {
    return new Intl.Locale(locale).maximize().region || null;
  } catch {
    return null;
  }
}

function mapkaCountryCurrency(country) {
  return MAPKA_COUNTRY_CURRENCY[country] || "EUR";
}

const MAPKA_COUNTRY = mapkaUserCountry();
const MAPKA_CURRENCY = mapkaCountryCurrency(MAPKA_COUNTRY);

const MAPKA_ROUGH_PER_PLN = {
  PLN: 1, EUR: 0.23, CZK: 5.8, HUF: 90, RON: 1.15, SEK: 2.6, DKK: 1.7, GBP: 0.2, CHF: 0.21, NOK: 2.7, ISK: 34, USD: 0.26,
};

function mapkaStartPrice(pln, currency) {
  const value = pln * (MAPKA_ROUGH_PER_PLN[currency] || 1);
  return value >= 10 ? Math.round(value) : Math.round(value * 100) / 100;
}

const MAPKA_UNITS = MAPKA_COUNTRY === "US" ? "us" : "metric";

function mapkaFallbackPrice(currency) {
  return currency === "USD" ? 0.9 : mapkaStartPrice(6.2, currency);
}

const MAPKA_DEFAULTS = {
  units: MAPKA_UNITS,
  consumption: 7.0,
  price: mapkaFallbackPrice(MAPKA_CURRENCY),
  autoPrice: true,
  localPrices: true,
  fuelType: "pb",
  evHomePrice: mapkaStartPrice(1.1, MAPKA_CURRENCY),
  evFastPrice: mapkaStartPrice(2.8, MAPKA_CURRENCY),
  currency: MAPKA_CURRENCY,
  passengers: 1,
  mileage: "off",
  showRoundTrip: true,
  showFloating: true,
  summaryLink: true,
  configured: false,
};

const MAPKA_SITE_URL = "https://michalskii.github.io/tankful/";

const MAPKA_FUELS = Object.fromEntries(["pb", "pbp", "on", "onp", "lpg", "ev"].map((f) => [f, mapkaT(`fuel_${f}`)]));

const MAPKA_MILEAGE = {
  small: { rate: 0.89, label: mapkaT("mileage_small_label") },
  large: { rate: 1.15, label: mapkaT("mileage_large_label") },
};

const MAPKA_EU_FUEL = { pb: "pb", pbp: "pb", on: "on", onp: "on", lpg: "lpg" };

function mapkaCountryName(cc) {
  try {
    return new Intl.DisplayNames(MAPKA_LOCALE, { type: "region" }).of(cc);
  } catch {
    return cc;
  }
}

const MAPKA_REGIONS = {
  "02": "dolnoslaskie", DS: "dolnoslaskie",
  "04": "kujawsko-pomorskie", KP: "kujawsko-pomorskie",
  "06": "lubelskie", LU: "lubelskie",
  "08": "lubuskie", LB: "lubuskie",
  "10": "lodzkie", LD: "lodzkie",
  "12": "malopolskie", MA: "malopolskie",
  "14": "mazowieckie", MZ: "mazowieckie",
  "16": "opolskie", OP: "opolskie",
  "18": "podkarpackie", PK: "podkarpackie",
  "20": "podlaskie", PD: "podlaskie",
  "22": "pomorskie", PM: "pomorskie",
  "24": "slaskie", SL: "slaskie",
  "26": "swietokrzyskie", SK: "swietokrzyskie",
  "28": "warminsko-mazurskie", WN: "warminsko-mazurskie",
  "30": "wielkopolskie", WP: "wielkopolskie",
  "32": "zachodniopomorskie", ZP: "zachodniopomorskie",
};

const MAPKA_OWN_SOURCES = { GB: { key: "ukPrices", currency: "GBP" }, US: { key: "usPrices", currency: "USD" } };

const MAPKA_US_STATES = {
  CT: ["Connecticut", "1A"], ME: ["Maine", "1A"], MA: ["Massachusetts", "1A"], NH: ["New Hampshire", "1A"],
  RI: ["Rhode Island", "1A"], VT: ["Vermont", "1A"],
  DE: ["Delaware", "1B"], DC: ["District of Columbia", "1B"], MD: ["Maryland", "1B"], NJ: ["New Jersey", "1B"],
  NY: ["New York", "1B"], PA: ["Pennsylvania", "1B"],
  FL: ["Florida", "1C"], GA: ["Georgia", "1C"], NC: ["North Carolina", "1C"], SC: ["South Carolina", "1C"],
  VA: ["Virginia", "1C"], WV: ["West Virginia", "1C"],
  IL: ["Illinois", "2"], IN: ["Indiana", "2"], IA: ["Iowa", "2"], KS: ["Kansas", "2"], KY: ["Kentucky", "2"],
  MI: ["Michigan", "2"], MN: ["Minnesota", "2"], MO: ["Missouri", "2"], NE: ["Nebraska", "2"],
  ND: ["North Dakota", "2"], SD: ["South Dakota", "2"], OH: ["Ohio", "2"], OK: ["Oklahoma", "2"],
  TN: ["Tennessee", "2"], WI: ["Wisconsin", "2"],
  AL: ["Alabama", "3"], AR: ["Arkansas", "3"], LA: ["Louisiana", "3"], MS: ["Mississippi", "3"],
  NM: ["New Mexico", "3"], TX: ["Texas", "3"],
  CO: ["Colorado", "4"], ID: ["Idaho", "4"], MT: ["Montana", "4"], UT: ["Utah", "4"], WY: ["Wyoming", "4"],
  AK: ["Alaska", "5"], AZ: ["Arizona", "5"], CA: ["California", "5"], HI: ["Hawaii", "5"], NV: ["Nevada", "5"],
  OR: ["Oregon", "5"], WA: ["Washington", "5"],
};

const MAPKA_DATA_KEYS ={ fuelPrices: null, euPrices: null, nbpRates: null, ukPrices: null, usPrices: null };

function mapkaLoadSettings() {
  return new Promise((resolve) => chrome.storage.sync.get(MAPKA_DEFAULTS, resolve));
}

function mapkaLoadData() {
  return new Promise((resolve) => chrome.storage.local.get(MAPKA_DATA_KEYS, resolve));
}

function mapkaFormatMoney(value, currency) {
  try {
    return new Intl.NumberFormat(MAPKA_LOCALE, {
      style: "currency",
      currency,
      maximumFractionDigits: value < 10 ? 2 : 0,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

function mapkaFormatUnitPrice(value, currency) {
  try {
    return new Intl.NumberFormat(MAPKA_LOCALE, { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

function mapkaFromPln(pln, currency, data) {
  if (currency === "PLN") return pln;
  const rate = data?.nbpRates?.rates?.[currency];
  return rate ? pln / rate : null;
}

function mapkaUsAreas(region) {
  const state = /^US-[A-Z]{2}$/.test(region || "") ? region.slice(3) : null;
  const padd = MAPKA_US_STATES[state]?.[1];
  if (!padd) return [];
  return [state, padd === "5" && state !== "CA" ? "5XCA" : padd];
}

function mapkaOwnPricePln(s, data, cc, geo) {
  const own = MAPKA_OWN_SOURCES[cc];
  const entry = data[own.key];
  const fuel = MAPKA_EU_FUEL[s.fuelType];
  const rate = data.nbpRates?.rates?.[own.currency];
  const area = cc === "US" ? mapkaUsAreas(geo?.region).find((a) => entry?.areas?.[a]?.[fuel]) : null;
  const value = area ? entry.areas[area][fuel] : entry?.prices?.[fuel];
  if (!value || !rate) return null;
  const state = geo?.regionName || MAPKA_US_STATES[geo?.region?.slice(3)]?.[0];
  return { price: value * rate, label: area && state ? `${state} (${mapkaCountryName(cc)})` : mapkaCountryName(cc) };
}

function mapkaLocalPricePln(s, data, geo) {
  const cc = geo?.cc?.toUpperCase();
  if ((!cc || !s.localPrices) && MAPKA_OWN_SOURCES[MAPKA_COUNTRY]) return mapkaOwnPricePln(s, data, MAPKA_COUNTRY, null);
  if (!cc || cc === "PL" || !s.localPrices) {
    const prices = data.fuelPrices?.prices;
    const national = prices?.[s.fuelType] ?? prices?.[MAPKA_EU_FUEL[s.fuelType]];
    return national ? { price: national, label: mapkaT("price_national") } : null;
  }
  if (MAPKA_OWN_SOURCES[cc]) return mapkaOwnPricePln(s, data, cc, geo);
  const eur = data.euPrices?.prices?.[cc]?.[MAPKA_EU_FUEL[s.fuelType]];
  const rate = data.nbpRates?.rates?.EUR;
  return eur && rate ? { price: eur * rate, label: mapkaCountryName(cc) } : null;
}

let mapkaBorderIndex = null;

function mapkaBorderRings(borders) {
  if (mapkaBorderIndex?.borders === borders) return mapkaBorderIndex.rings;
  const rings = [];
  for (const [cc, list] of Object.entries(borders)) {
    for (const r of list) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (let i = 0; i < r.length; i += 2) {
        minX = Math.min(minX, r[i]), maxX = Math.max(maxX, r[i]);
        minY = Math.min(minY, r[i + 1]), maxY = Math.max(maxY, r[i + 1]);
      }
      rings.push({ cc, r, minX, maxX, minY, maxY });
    }
  }
  mapkaBorderIndex = { borders, rings };
  return rings;
}

function mapkaCountryAt(point, borders = MAPKA_BORDERS) {
  const x = point.lng * 100;
  const y = point.lat * 100;
  const inside = {};
  for (const { cc, r, minX, maxX, minY, maxY } of mapkaBorderRings(borders)) {
    if (x < minX || x > maxX || y < minY || y > maxY) continue;
    for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
      if (r[i + 1] > y !== r[j + 1] > y && x < ((r[j] - r[i]) * (y - r[i + 1])) / (r[j + 1] - r[i + 1]) + r[i]) {
        inside[cc] = !inside[cc];
      }
    }
  }
  return Object.keys(inside).find((cc) => inside[cc]) || null;
}

function mapkaRouteShares(points, borders = MAPKA_BORDERS) {
  const stops = new Set(points.map((p) => mapkaCountryAt(p, borders)).filter(Boolean));
  if (stops.size < 2) return null;
  const km = {};
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const kx = 111.32 * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
    const dist = Math.hypot((b.lng - a.lng) * kx, (b.lat - a.lat) * 110.57);
    const n = Math.max(1, Math.ceil(dist / 5));
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      const cc = mapkaCountryAt({ lng: a.lng + (b.lng - a.lng) * t, lat: a.lat + (b.lat - a.lat) * t }, borders);
      if (cc) km[cc] = (km[cc] || 0) + dist / n;
    }
  }
  const total = Object.values(km).reduce((sum, v) => sum + v, 0);
  const kept = Object.entries(km).filter(([, v]) => v / total >= 0.02);
  const keptTotal = kept.reduce((sum, [, v]) => sum + v, 0);
  if (kept.length < 2) return null;
  return Object.fromEntries(kept.sort((x, y) => y[1] - x[1]).map(([cc, v]) => [cc, v / keptTotal]));
}

function mapkaShownUnitPrice(pln, s, data) {
  const local = mapkaFromPln(pln, s.currency, data);
  const value = local == null ? pln : local;
  const unit = mapkaUnit(s.fuelType, s.units);
  return `${mapkaFormatUnitPrice(mapkaToUnitPrice(value, s.fuelType, s.units), local == null ? "PLN" : s.currency)}/${unit}`;
}

function mapkaRoutePricePln(s, data, geo) {
  const parts = [];
  for (const [cc, share] of Object.entries(geo.shares)) {
    const place = [geo.origin, geo.dest].find((g) => g?.cc?.toUpperCase() === cc) || { cc };
    const local = mapkaLocalPricePln(s, data, place);
    if (local) parts.push({ ...local, share });
  }
  if (parts.length < 2) return null;
  const total = parts.reduce((sum, p) => sum + p.share, 0);
  return {
    price: parts.reduce((sum, p) => sum + (p.price * p.share) / total, 0),
    source: mapkaT(
      "price_route",
      parts
        .map((p) => `${p.label} ${Math.round((p.share / total) * 100)}% ${mapkaShownUnitPrice(p.price, s, data)}`)
        .join(" · ")
    ),
  };
}

function mapkaResolvePrice(s, data, geo) {
  const cur = s.currency;
  if (s.fuelType === "ev") {
    return {
      low: s.evHomePrice,
      high: s.evFastPrice,
      unit: "kWh",
      auto: false,
      source: mapkaT("price_ev", mapkaFormatUnitPrice(s.evHomePrice, cur), mapkaFormatUnitPrice(s.evFastPrice, cur)),
    };
  }
  const manual = { low: s.price, high: s.price, unit: "l", auto: false, source: mapkaT("price_manual") };
  if (!s.autoPrice) return manual;

  const origin = mapkaLocalPricePln(s, data, geo?.origin);
  if (!origin) return { ...manual, source: mapkaT("price_missing") };
  let pln = origin.price;
  let source = mapkaT("price_single", origin.label, mapkaShownUnitPrice(origin.price, s, data));

  const originCc = (geo?.origin?.cc || "pl").toUpperCase();
  const destCc = geo?.dest?.cc?.toUpperCase();
  const route = s.localPrices && geo?.shares ? mapkaRoutePricePln(s, data, geo) : null;
  if (route) {
    pln = route.price;
    source = route.source;
  } else if (s.localPrices && destCc && (destCc !== originCc || geo.dest.region !== geo.origin?.region)) {
    const dest = mapkaLocalPricePln(s, data, geo.dest);
    if (dest && dest.label !== origin.label) {
      pln = (origin.price + dest.price) / 2;
      source = mapkaT(
        "price_average",
        origin.label,
        mapkaShownUnitPrice(origin.price, s, data),
        dest.label,
        mapkaShownUnitPrice(dest.price, s, data)
      );
    }
  }

  const price = mapkaFromPln(pln, cur, data);
  if (price == null) return { ...manual, source: mapkaT("price_no_rate", cur) };
  return { low: price, high: price, unit: "l", auto: true, source };
}

function mapkaMileage(km, s, data) {
  const m = MAPKA_MILEAGE[s.mileage];
  if (!m) return null;
  return mapkaFromPln(km * m.rate, s.currency, data);
}

function mapkaParseKm(text) {
  const m = text.replace(/[()]/g, "").trim().match(/^([\d\s  .,]+)\s*(km|m|mi|ft)$/i);
  if (!m) return null;
  let num = m[1].replace(/[\s  ]/g, "");
  const lastComma = num.lastIndexOf(",");
  const lastDot = num.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    const dec = lastComma > lastDot ? "," : ".";
    num = num.split(dec === "," ? "." : ",").join("").replace(",", ".");
  } else if (lastComma > -1) {
    num = /^\d{1,3}(,\d{3})+$/.test(num) ? num.replace(/,/g, "") : num.replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(num) && num.split(".").length > 2) {
    num = num.replace(/\./g, "");
  }
  const value = parseFloat(num);
  if (!isFinite(value)) return null;
  const unit = m[2].toLowerCase();
  if (unit === "km") return value;
  if (unit === "m") return value / 1000;
  if (unit === "mi") return value * 1.609344;
  if (unit === "ft") return value * 0.0003048;
  return null;
}

const MAPKA_KM_PER_MI = 1.609344;
const MAPKA_L_PER_GAL = 3.785411784;
const MAPKA_MPG = (100 * MAPKA_L_PER_GAL) / MAPKA_KM_PER_MI;

const mapkaUsFuel = (fuelType, units) => units === "us" && fuelType !== "ev";

function mapkaUnit(fuelType, units = "metric") {
  if (fuelType === "ev") return "kWh";
  return units === "us" ? "gal" : "l";
}

function mapkaDistanceUnit(units = "metric") {
  return units === "us" ? "mi" : "km";
}

function mapkaToDistance(km, units = "metric") {
  return units === "us" ? km / MAPKA_KM_PER_MI : km;
}

function mapkaFormatDistance(km, units = "metric", maxDigits = 1) {
  return `${mapkaFormatNumber(mapkaToDistance(km, units), maxDigits)} ${mapkaDistanceUnit(units)}`;
}

function mapkaToVolume(amount, fuelType, units = "metric") {
  return mapkaUsFuel(fuelType, units) ? amount / MAPKA_L_PER_GAL : amount;
}

function mapkaToUnitPrice(perUnit, fuelType, units = "metric") {
  return mapkaUsFuel(fuelType, units) ? perUnit * MAPKA_L_PER_GAL : perUnit;
}

function mapkaFromUnitPrice(shown, fuelType, units = "metric") {
  return mapkaUsFuel(fuelType, units) ? shown / MAPKA_L_PER_GAL : shown;
}

function mapkaToConsumption(metric, fuelType, units = "metric") {
  if (units !== "us") return metric;
  if (fuelType === "ev") return metric * MAPKA_KM_PER_MI;
  return metric > 0 ? MAPKA_MPG / metric : 0;
}

function mapkaFromConsumption(shown, fuelType, units = "metric") {
  if (units !== "us") return shown;
  if (fuelType === "ev") return shown / MAPKA_KM_PER_MI;
  return shown > 0 ? MAPKA_MPG / shown : 0;
}

function mapkaRoundConsumption(metric, fuelType, units = "metric") {
  return Math.round(mapkaToConsumption(metric, fuelType, units) * 10) / 10;
}

function mapkaConsumptionUnit(fuelType, units = "metric") {
  if (units === "us") return fuelType === "ev" ? "kWh/100 mi" : "mpg";
  return `${mapkaUnit(fuelType)}/100 km`;
}

function mapkaFormatConsumption(metric, fuelType, units = "metric") {
  return `${mapkaFormatNumber(mapkaToConsumption(metric, fuelType, units))} ${mapkaConsumptionUnit(fuelType, units)}`;
}

function mapkaConsumptionLabel(fuelType, units = "metric") {
  if (units === "us") return mapkaT(fuelType === "ev" ? "consumption_ev_us" : "consumption_fuel_us");
  return mapkaT(fuelType === "ev" ? "consumption_ev" : "consumption_fuel", mapkaUnit(fuelType));
}

function mapkaFuelFormula(km, s) {
  const fuel = mapkaToVolume((km * s.consumption) / 100, s.fuelType, s.units);
  const op = mapkaUsFuel(s.fuelType, s.units) ? "÷" : "×";
  return `${mapkaFormatDistance(km, s.units)} ${op} ${mapkaFormatConsumption(s.consumption, s.fuelType, s.units)} = ${mapkaFormatNumber(fuel)} ${mapkaUnit(s.fuelType, s.units)}`;
}

function mapkaCostPer100(s, pricePerUnit) {
  const km = s.units === "us" ? 100 * MAPKA_KM_PER_MI : 100;
  return ((km * s.consumption) / 100) * pricePerUnit;
}

function mapkaFormatNumber(value, maxDigits = 1) {
  return new Intl.NumberFormat(MAPKA_LOCALE, { maximumFractionDigits: maxDigits }).format(value);
}
