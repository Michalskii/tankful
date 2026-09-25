// Wspólne ustawienia i wyliczanie ceny – używane przez content script, popup, stronę powitalną i historię.

// ---------- Tłumaczenia (_locales/<język>/messages.json) ----------

// Tekst w języku przeglądarki; $1…$9 w komunikacie zastępują kolejne argumenty.
function mapkaT(key, ...subs) {
  return chrome.i18n.getMessage(key, subs.map(String)) || key;
}

// Odmiana przez liczbę: klucze <base>_one / _few / _many / _other (zasady z Intl.PluralRules).
function mapkaPlural(base, n) {
  const form = new Intl.PluralRules(MAPKA_LOCALE).select(n);
  return chrome.i18n.getMessage(`${base}_${form}`, [String(n)]) || mapkaT(`${base}_other`, n);
}

// Strony HTML: <el data-i18n="klucz"> dostaje tekst, <el data-i18n-title="klucz"> podpowiedź.
function mapkaLocalizePage(root = document) {
  for (const el of root.querySelectorAll("[data-i18n]")) el.textContent = mapkaT(el.dataset.i18n);
  for (const el of root.querySelectorAll("[data-i18n-title]")) el.title = mapkaT(el.dataset.i18nTitle);
  if (root === document) document.documentElement.lang = MAPKA_LOCALE;
}

// Język interfejsu przeglądarki – do formatowania liczb, dat i walut.
const MAPKA_LOCALE = chrome.i18n.getUILanguage();

// ---------- Kraj użytkownika i waluta ----------

// Strefa czasowa systemu → kraj. Pewniejsza niż język: przeglądarka po angielsku w Polsce to wciąż Polska.
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

// Kraje spoza strefy euro; pozostałe kraje UE (od 2026 r. także Bułgaria) płacą w EUR.
const MAPKA_COUNTRY_CURRENCY = {
  PL: "PLN", CZ: "CZK", HU: "HUF", RO: "RON", SE: "SEK", DK: "DKK",
  GB: "GBP", CH: "CHF", NO: "NOK", IS: "ISK", US: "USD",
};

// Waluty do wyboru – wszystkie są w tabeli A kursów NBP, przez którą przeliczamy ceny.
const MAPKA_CURRENCIES = ["PLN", "EUR", "CZK", "HUF", "RON", "SEK", "DKK", "GBP", "CHF", "NOK", "ISK", "USD"];

// "PL", "DE"… albo null. Najpierw strefa czasowa, potem region z języka ("de" → "DE", "en-GB" → "GB").
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

// Orientacyjne kursy (ile jednostek waluty za 1 zł) – tylko do startowych cen ręcznych, żeby w Niemczech
// nie startować od „6,20 €/l”. Właściwe przeliczenia cen idą po bieżących kursach NBP.
const MAPKA_ROUGH_PER_PLN = {
  PLN: 1, EUR: 0.23, CZK: 5.8, HUF: 90, RON: 1.15, SEK: 2.6, DKK: 1.7, GBP: 0.2, CHF: 0.21, NOK: 2.7, ISK: 34, USD: 0.26,
};

function mapkaStartPrice(pln, currency) {
  const value = pln * (MAPKA_ROUGH_PER_PLN[currency] || 1);
  return value >= 10 ? Math.round(value) : Math.round(value * 100) / 100;
}

const MAPKA_DEFAULTS = {
  consumption: 7.0,    // spalanie [l lub kWh / 100 km]
  price: mapkaStartPrice(6.2, MAPKA_CURRENCY), // cena ręczna (w wybranej walucie) – gdy autoPrice = false lub brak danych
  autoPrice: true,     // pobieraj średnie ceny paliw
  localPrices: true,   // ceny z województwa startu i krajów UE (wysyła współrzędne do OpenStreetMap)
  fuelType: "pb",      // pb, pbp, on, onp, lpg, ev
  evHomePrice: mapkaStartPrice(1.1, MAPKA_CURRENCY), // cena kWh w domu (w wybranej walucie)
  evFastPrice: mapkaStartPrice(2.8, MAPKA_CURRENCY), // cena kWh na szybkiej ładowarce
  currency: MAPKA_CURRENCY, // domyślnie waluta kraju użytkownika
  passengers: 1,       // > 1 pokazuje też koszt na osobę
  mileage: "off",      // kilometrówka: off, small (≤ 900 cm³), large (> 900 cm³ i elektryczne)
  showRoundTrip: true, // druga linia z kosztem tam i z powrotem
  showFloating: true,  // pływający panel w prawym górnym rogu mapy
  configured: false,   // true po pierwszym wyborze paliwa i spalania
};

const MAPKA_FUELS = Object.fromEntries(["pb", "pbp", "on", "onp", "lpg", "ev"].map((f) => [f, mapkaT(`fuel_${f}`)]));

// Polska kilometrówka: stawki za 1 km w PLN z rozporządzenia MI z 25.03.2002 (w brzmieniu od 2023 r.).
const MAPKA_MILEAGE = {
  small: { rate: 0.89, label: mapkaT("mileage_small_label") },
  large: { rate: 1.15, label: mapkaT("mileage_large_label") },
};

// Biuletyn UE ma tylko benzynę 95, diesel i LPG.
const MAPKA_EU_FUEL = { pb: "pb", pbp: "pb", on: "on", onp: "on", lpg: "lpg" };

// Nazwa kraju w języku przeglądarki ("DE" → "Niemcy" / "Germany").
function mapkaCountryName(cc) {
  try {
    return new Intl.DisplayNames(MAPKA_LOCALE, { type: "region" }).of(cc);
  } catch {
    return cc;
  }
}

// Kody ISO 3166-2 województw (OSM podaje stare numeryczne, nowsze źródła literowe) → adresy na autocentrum.pl.
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

const MAPKA_DATA_KEYS = { fuelPrices: null, regionalPrices: {}, euPrices: null, nbpRates: null };

function mapkaLoadSettings() {
  return new Promise((resolve) => chrome.storage.sync.get(MAPKA_DEFAULTS, resolve));
}

function mapkaLoadData() {
  return new Promise((resolve) => chrome.storage.local.get(MAPKA_DATA_KEYS, resolve));
}

function mapkaRegionSlug(geo) {
  const code = geo?.region?.split("-")[1];
  return code ? MAPKA_REGIONS[code] || null : null;
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

// Cena za litr / kWh – zawsze z groszami.
function mapkaFormatUnitPrice(value, currency) {
  try {
    return new Intl.NumberFormat(MAPKA_LOCALE, { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

// PLN → wybrana waluta po kursie średnim NBP; null, gdy brak kursu.
function mapkaFromPln(pln, currency, data) {
  if (currency === "PLN") return pln;
  const rate = data?.nbpRates?.rates?.[currency];
  return rate ? pln / rate : null;
}

// Cena paliwa w PLN za litr dla danego miejsca: województwo → średnia krajowa → kraj UE.
function mapkaLocalPricePln(s, data, geo) {
  const cc = geo?.cc?.toUpperCase();
  if (!cc || cc === "PL" || !s.localPrices) {
    const slug = s.localPrices ? mapkaRegionSlug(geo) : null;
    const regional = slug && data.regionalPrices?.[slug]?.prices?.[s.fuelType];
    if (regional) return { price: regional, label: (geo.regionName || slug).replace(/^województwo /, "woj. ") };
    const national = data.fuelPrices?.prices?.[s.fuelType];
    return national ? { price: national, label: mapkaT("price_national") } : null;
  }
  const eur = data.euPrices?.prices?.[cc]?.[MAPKA_EU_FUEL[s.fuelType]];
  const rate = data.nbpRates?.rates?.EUR;
  return eur && rate ? { price: eur * rate, label: mapkaCountryName(cc) } : null;
}

/**
 * Cena za jednostkę paliwa w wybranej walucie.
 * Zwraca { low, high, unit, auto, source } – low/high różnią się tylko dla EV (dom vs szybka ładowarka).
 * geo = { origin, dest } z content scriptu albo null (popup, strona powitalna).
 */
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
  // Widoczny sygnał, że pobieranie cen przestało działać (np. zmieniła się strona autocentrum.pl).
  if (!origin) return { ...manual, source: mapkaT("price_missing") };
  let pln = origin.price;
  let source = mapkaT("price_single", origin.label, mapkaFormatUnitPrice(origin.price, "PLN"));

  const originCc = (geo?.origin?.cc || "pl").toUpperCase();
  const destCc = geo?.dest?.cc?.toUpperCase();
  if (s.localPrices && destCc && destCc !== originCc) {
    const dest = mapkaLocalPricePln(s, data, geo.dest);
    if (dest) {
      pln = (origin.price + dest.price) / 2;
      source = mapkaT(
        "price_average",
        origin.label,
        mapkaFormatUnitPrice(origin.price, "PLN"),
        dest.label,
        mapkaFormatUnitPrice(dest.price, "PLN")
      );
    }
  }

  const price = mapkaFromPln(pln, cur, data);
  if (price == null) return { ...manual, source: mapkaT("price_no_rate", cur) };
  return { low: price, high: price, unit: "l", auto: true, source };
}

// Kwota kilometrówki w wybranej walucie albo null.
function mapkaMileage(km, s, data) {
  const m = MAPKA_MILEAGE[s.mileage];
  if (!m) return null;
  return mapkaFromPln(km * m.rate, s.currency, data);
}

// "339 km", "1,234 km", "1 234 km", "4,6 km", "4.6 km", "800 m", "12 mi", "(339 km)" → km albo null
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
    // "1,234" = tysiące, "4,6" = ułamek dziesiętny
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

// "Spalanie (l na 100 km)" albo dla EV "Zużycie (kWh na 100 km)"
function mapkaConsumptionLabel(fuelType) {
  return mapkaT(fuelType === "ev" ? "consumption_ev" : "consumption_fuel", mapkaUnit(fuelType));
}

// Liczba w formacie języka przeglądarki: 7.5 → "7,5" po polsku, "7.5" po angielsku.
function mapkaFormatNumber(value, maxDigits = 1) {
  return new Intl.NumberFormat(MAPKA_LOCALE, { maximumFractionDigits: maxDigits }).format(value);
}
