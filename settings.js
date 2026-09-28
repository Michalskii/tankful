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

const MAPKA_DEFAULTS = {
  consumption: 7.0,
  price: mapkaStartPrice(6.2, MAPKA_CURRENCY),
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

const MAPKA_DATA_KEYS = { fuelPrices: null, euPrices: null, nbpRates: null, ukPrices: null };

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

function mapkaLocalPricePln(s, data, geo) {
  const cc = geo?.cc?.toUpperCase();
  if (!cc || cc === "PL" || !s.localPrices) {
    const prices = data.fuelPrices?.prices;
    const national = prices?.[s.fuelType] ?? prices?.[MAPKA_EU_FUEL[s.fuelType]];
    return national ? { price: national, label: mapkaT("price_national") } : null;
  }
  if (cc === "GB") {
    const gbp = data.ukPrices?.prices?.[MAPKA_EU_FUEL[s.fuelType]];
    const gbpRate = data.nbpRates?.rates?.GBP;
    return gbp && gbpRate ? { price: gbp * gbpRate, label: mapkaCountryName(cc) } : null;
  }
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

function mapkaShownUnitPrice(pln, currency, data) {
  const local = mapkaFromPln(pln, currency, data);
  return local == null ? mapkaFormatUnitPrice(pln, "PLN") : mapkaFormatUnitPrice(local, currency);
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
        .map((p) => `${p.label} ${Math.round((p.share / total) * 100)}% ${mapkaShownUnitPrice(p.price, s.currency, data)}`)
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
  let source = mapkaT("price_single", origin.label, mapkaShownUnitPrice(origin.price, cur, data));

  const originCc = (geo?.origin?.cc || "pl").toUpperCase();
  const destCc = geo?.dest?.cc?.toUpperCase();
  const route = s.localPrices && geo?.shares ? mapkaRoutePricePln(s, data, geo) : null;
  if (route) {
    pln = route.price;
    source = route.source;
  } else if (s.localPrices && destCc && destCc !== originCc) {
    const dest = mapkaLocalPricePln(s, data, geo.dest);
    if (dest) {
      pln = (origin.price + dest.price) / 2;
      source = mapkaT(
        "price_average",
        origin.label,
        mapkaShownUnitPrice(origin.price, cur, data),
        dest.label,
        mapkaShownUnitPrice(dest.price, cur, data)
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

function mapkaUnit(fuelType) {
  return fuelType === "ev" ? "kWh" : "l";
}

function mapkaConsumptionLabel(fuelType) {
  return mapkaT(fuelType === "ev" ? "consumption_ev" : "consumption_fuel", mapkaUnit(fuelType));
}

function mapkaFormatNumber(value, maxDigits = 1) {
  return new Intl.NumberFormat(MAPKA_LOCALE, { maximumFractionDigits: maxDigits }).format(value);
}
