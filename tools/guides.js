const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const GUIDES = path.join(ROOT, "site/guides");
const PHOTOS = JSON.parse(fs.readFileSync(path.join(GUIDES, "photos.json"), "utf8"));
const { cities: CITIES, routes: ROUTES } = JSON.parse(fs.readFileSync(path.join(ROOT, "site/src/lib/routes.json"), "utf8"));

const BACKGROUND = fs.readFileSync(path.join(ROOT, "background.js"), "utf8");
const FUEL_VAT = Number(BACKGROUND.match(/const FUEL_VAT = ([\d.]+);/)[1]);
const REDUCED_FUEL_VAT = vm.runInNewContext(BACKGROUND.match(/const REDUCED_FUEL_VAT = (\[[^\n]*\]);/)[1]);

const DIRS = { pl: "poradniki", en: "guides", de: "ratgeber" };
const HOME = { pl: "./", en: "en", de: "./" };
const GROUP_IDS = {
  prices: ["fuel-vat", "poland-prices", "weekly", "europe-prices", "price-history", "italy-fuel", "france-fuel", "nl-fuel", "dk-fuel"],
  border: ["border", "germany", "czechia", "poland-fuel", "slubice-fuel", "swinoujscie-fuel", "zgorzelec-fuel", "kostrzyn-fuel", "cheb-fuel", "lux-fuel"],
  tools: ["consumption", "lpg-calc", "mileage", "per-100-km", "how-to-calculate", "commute", "split"],
  trips: ["croatia", "seaside", "austria", "hungary", "west", "italy", "alps"],
  tips: ["lpg", "fuel-saving", "ev-trip"],
};
const GROUP_OVERRIDES = { de: { austria: "prices" } };
const COMPACT_GROUPS = new Set(["prices", "tools"]);
const groupOf = (g) => {
  const group = GROUP_OVERRIDES[g.lang]?.[g.id] ?? Object.keys(GROUP_IDS).find((k) => GROUP_IDS[k].includes(g.id));
  if (!group) throw new Error(`No group for guide "${g.id}"`);
  return group;
};
const THEME_SCRIPT = `    <script>
      let theme = null
      try { theme = localStorage.getItem("tankful-theme") } catch {}
      document.documentElement.classList.toggle("dark", theme ? theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches)
    </script>
`;
const NAV = {
  pl: [["Koszt trasy", null], ["Ceny paliw", "ceny-paliw-w-polsce"], ["Spalanie", "kalkulator-spalania"], ["LPG", "kalkulator-lpg"], ["Kilometrówka", "kilometrowka"]],
  en: [["Trip cost", null], ["Fuel prices", "fuel-prices-europe"], ["Consumption", "fuel-consumption-calculator"], ["LPG", "lpg-calculator"]],
  de: [["Fahrtkosten", null], ["Spritpreise", "spritpreise-europa"], ["Verbrauch", "spritverbrauch-berechnen"], ["Autogas", "autogas-rechner"]],
};
const OG_LOCALE = { pl: "pl_PL", en: "en_GB", de: "de_DE" };
const CURRENCY = { pl: "PLN", en: "EUR", de: "EUR" };
const INTL = { pl: "pl-PL", en: "en-GB", de: "de-DE" };
const EU = ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE"];
const FUELS = {
  pl: { pb: "benzyna 95", on: "diesel", lpg: "LPG", ev: "prąd" },
  en: { pb: "petrol (95)", on: "diesel", lpg: "LPG", ev: "electricity" },
  de: { pb: "Super 95", on: "Diesel", lpg: "Autogas", ev: "Strom" },
};
const FUELS_OF = {
  pl: { pb: "benzyny 95", on: "oleju napędowego", lpg: "LPG" },
  en: { pb: "petrol", on: "diesel", lpg: "LPG" },
  de: { pb: "Super", on: "Diesel", lpg: "Autogas" },
};
const PL_IN = {
  AT: "w Austrii", BE: "w Belgii", BG: "w Bułgarii", HR: "w Chorwacji", CY: "na Cyprze", CZ: "w Czechach", DK: "w Danii",
  EE: "w Estonii", FI: "w Finlandii", FR: "we Francji", DE: "w Niemczech", GR: "w Grecji", HU: "na Węgrzech", IE: "w Irlandii",
  IT: "we Włoszech", LV: "na Łotwie", LT: "na Litwie", LU: "w Luksemburgu", MT: "na Malcie", NL: "w Holandii", PL: "w Polsce",
  PT: "w Portugalii", RO: "w Rumunii", SK: "na Słowacji", SI: "w Słowenii", ES: "w Hiszpanii", SE: "w Szwecji", GB: "w Wielkiej Brytanii",
};
const EN_THE = new Set(["NL", "GB", "CZ"]);
const DE_DER = new Set(["SK", "CH", "TR"]);
const DE_DEN = new Set(["NL"]);
const EV_PLN = { home: 1.1, fast: 2.8 };
const EV_EUR_DE = { home: 0.38, fast: 0.65 };

const TEXT = {
  pl: {
    home: "Kalkulator",
    guides: "Poradniki",
    chartRanges: { "1y": "1 rok", "3y": "3 lata", "5y": "5 lat", all: "Od 2005" },
    chartRangeLabel: "Zakres wykresu",
    chartNow: "Ostatni tydzień",
    chartYear: "Rok temu",
    chartFive: "5 lat temu",
    chartSeries: "Seria",
    weekRank: "Miejsce",
    weekPrice: (date) => `Cena (${date})`,
    weekChange: "Zmiana w tydzień",
    chartCaption: (date) => `Średnie ceny krajowe z cotygodniowego biuletynu naftowego Komisji Europejskiej, przeliczone na złote po kursie z danego tygodnia. Ostatni tydzień: ${date}.`,
    plAdjusted: "Polska: aktualna średnia cena z uwzględnieniem obniżki VAT i zmian cen hurtowych Orlenu – ta sama, z której liczy kalkulator.",
    chartAria: (names) => `Wykres cen: ${names}`,
    euAverage: "średnia UE",
    indexTitle: "Poradniki: ceny paliw i koszt przejazdu | Tankful",
    indexHeading: "Poradniki",
    indexDescription: "Aktualne ceny paliw w Europie, tankowanie przed granicą, koszt 100 km i podział kosztów przejazdu – poradniki z danymi odświeżanymi kilka razy dziennie.",
    notFoundTitle: "Nie ma takiej strony | Tankful",
    notFoundHeading: "Nie ma takiej strony",
    notFoundLead: "Ten adres nie istnieje albo się zmienił. Policz koszt swojej trasy w kalkulatorze albo wybierz jedną z popularnych tras.",
    popularRoutes: "Popularne trasy",

    indexLead: "Konkretne liczby zamiast ogólników. Ceny w poradnikach odświeżają się same, razem z kalkulatorem.",
    updated: (d) => `Oficjalne średnie ceny UE z ${d} · dane sprawdzane co 6 godzin`,
    published: (d) => `Opublikowano ${d}`,
    photo: (author, url) => `Fot. <a href="${url}" rel="noopener">${author}</a> / Unsplash`,
    cta: "Policz swoją trasę",
    ctaText: "Wpisz skąd i dokąd jedziesz – kalkulator poda koszt paliwa z aktualnymi cenami w każdym kraju na trasie.",
    ctaButton: "Otwórz kalkulator",
    more: "Inne poradniki",
    allGuides: "Wszystkie poradniki",
    groups: { prices: "Ceny paliw", border: "Tankowanie przy granicy", tools: "Kalkulatory", trips: "Podróże samochodem", tips: "Porady" },
    sources: "Ceny: biuletyn naftowy Komisji Europejskiej (Polska i kraje UE), w Polsce korygowany przy dużych zmianach cen hurtowych Orlenu, dane rządu Wielkiej Brytanii (GOV.UK), kursy walut NBP. To średnie krajowe – na stacjach przy autostradach bywa drożej.",
    privacy: "Polityka prywatności",
    code: "Kod źródłowy",
    country: "Kraj",
    diff: "Różnica",
    cheaper: "Taniej",
    same: "tak samo",
    tank: (l) => `Na ${l} l`,
    per100: "Koszt 100 km",
    consumption: "Zużycie",
    share: "Część trasy",
    km: "km",
    total: "Średnio na trasie",
    homeCharging: "ładowanie w domu",
    fastCharging: "szybka ładowarka",
    noData: "brak danych",
    verdictSame: (fuel) => `Litr ${fuel} kosztuje praktycznie tyle samo po obu stronach granicy.`,
    verdict: (fuel, where, diff, litres, tank) => `Litr ${fuel} jest tańszy ${where} o ${diff} – na ${litres} litrach oszczędzasz ${tank}.`,
    calcLitres: "Zatankowane litry",
    calcKm: "Przejechane km",
    calcFuel: "Paliwo",
    calcPrice: (cur) => `Cena za litr (${cur})`,
    calcPriceHint: "średnia w Polsce",
    calcResult: "Średnie spalanie",
    calc100: "Koszt 100 km",
    calcKmCost: "Koszt 1 km",
    calcButton: "Policz koszt trasy z tym spalaniem",
    mileKm: "Przejechane km",
    mileVehicle: "Pojazd",
    mileVehicles: { car: "Auto powyżej 900 cm³ – 1,15 zł/km", small: "Auto do 900 cm³ – 0,89 zł/km", moto: "Motocykl – 0,69 zł/km", moped: "Motorower – 0,42 zł/km" },
    mileConsumption: "Spalanie (l/100 km)",
    milePrice: "Cena paliwa (zł/l)",
    milePriceHint: "średnia w Polsce",
    mileResult: "Kilometrówka",
    mileFuel: "Koszt paliwa",
    mileDiff: "Różnica",
    lpgKm: "Roczny przebieg (km)",
    lpgPbCons: "Spalanie benzyny (l/100 km)",
    lpgLpgCons: "Spalanie LPG (l/100 km)",
    lpgLpgConsHint: "zwykle o 20% więcej",
    lpgPbPrice: (cur) => `Cena benzyny (${cur}/l)`,
    lpgLpgPrice: (cur) => `Cena LPG (${cur}/l)`,
    lpgPriceHint: "średnia w Polsce",
    lpgInstall: (cur) => `Koszt instalacji (${cur})`,
    lpgUpkeep: (cur) => `Serwis LPG rocznie (${cur})`,
    lpgUpkeepHint: "przeglądy, filtry, badanie techniczne",
    lpgPer100: "Oszczędność na 100 km",
    lpgYear: "Oszczędność rocznie",
    lpgPayback: "Instalacja zwróci się po",
    lpgPaybackKm: "Czyli po przejechaniu",
    lpgFive: "Bilans po 5 latach",
    lpgUnits: { month: { one: "miesiącu", few: "miesiącach", many: "miesiącach", other: "miesiąca" }, year: { one: "roku", few: "latach", many: "latach", other: "roku" }, never: "nie zwróci się" },
    fuelWord: "paliwo",
    neighbour: "Sąsiad",
    drive: "Napęd",
    route: "Trasa",
    crumbs: "Ścieżka",
  },
  en: {
    home: "Calculator",
    guides: "Guides",
    chartRanges: { "1y": "1 year", "3y": "3 years", "5y": "5 years", all: "Since 2005" },
    chartRangeLabel: "Chart range",
    chartNow: "Latest week",
    chartYear: "A year ago",
    chartFive: "5 years ago",
    chartSeries: "Series",
    weekRank: "Rank",
    weekPrice: (date) => `Price (${date})`,
    weekChange: "Change in a week",
    chartCaption: (date) => `National average prices from the European Commission's Weekly Oil Bulletin, in euro. Latest week: ${date}.`,
    plAdjusted: "Poland: current average price including the VAT cut and changes in Orlen wholesale prices – the same price the calculator uses.",
    chartAria: (names) => `Price chart: ${names}`,
    euAverage: "EU average",
    indexTitle: "Guides: fuel prices and trip costs | Tankful",
    indexHeading: "Guides",
    indexDescription: "Current fuel prices across Europe, filling up before a border, the cost of 100 km and splitting trip costs – guides with data refreshed several times a day.",
    notFoundTitle: "Page not found | Tankful",
    notFoundHeading: "Page not found",
    notFoundLead: "This address doesn't exist or has moved. Work out your trip in the calculator or pick one of the popular routes.",
    popularRoutes: "Popular routes",
    indexLead: "Numbers, not generalities. Prices in these guides update themselves, together with the calculator.",
    updated: (d) => `Official EU average prices from ${d} · data checked every 6 hours`,
    published: (d) => `Published ${d}`,
    photo: (author, url) => `Photo: <a href="${url}" rel="noopener">${author}</a> on Unsplash`,
    cta: "Cost your own trip",
    ctaText: "Enter where you're driving from and to – the calculator works out the fuel cost with current prices in every country on the way.",
    ctaButton: "Open the calculator",
    more: "More guides",
    allGuides: "All guides",
    groups: { prices: "Fuel prices", border: "Filling up near the border", tools: "Calculators", trips: "Road trips", tips: "Tips" },
    sources: "Prices: European Commission Weekly Oil Bulletin (Poland and EU countries), adjusted in Poland when Orlen wholesale prices move significantly, UK government weekly road fuel prices (GOV.UK), National Bank of Poland exchange rates. These are national averages – motorway stations are often more expensive.",
    privacy: "Privacy policy",
    code: "Source code",
    country: "Country",
    diff: "Difference",
    cheaper: "Cheaper in",
    same: "about the same",
    tank: (l) => `On ${l} l`,
    per100: "Cost of 100 km",
    consumption: "Consumption",
    share: "Share of route",
    km: "km",
    total: "Route average",
    homeCharging: "home charging",
    fastCharging: "fast charger",
    noData: "no data",
    verdictSame: (fuel) => `A litre of ${fuel} costs practically the same on both sides of the border.`,
    verdict: (fuel, where, diff, litres, tank) => `A litre of ${fuel} is cheaper ${where} by ${diff} – ${tank} saved on a ${litres}-litre fill-up.`,
    calcLitres: "Litres filled",
    calcKm: "Kilometres driven",
    calcFuel: "Fuel",
    calcPrice: (cur) => `Price per litre (${cur})`,
    calcPriceHint: "EU average",
    calcResult: "Average consumption",
    calc100: "Cost of 100 km",
    calcKmCost: "Cost of 1 km",
    calcButton: "Cost a trip with this consumption",
    mileKm: "Kilometres driven",
    mileVehicle: "Vehicle",
    mileVehicles: { car: "Car over 900 cm³ – PLN 1.15/km", small: "Car up to 900 cm³ – PLN 0.89/km", moto: "Motorcycle – PLN 0.69/km", moped: "Moped – PLN 0.42/km" },
    mileConsumption: "Consumption (l/100 km)",
    milePrice: "Fuel price (PLN/l)",
    milePriceHint: "Polish average",
    mileResult: "Mileage allowance",
    mileFuel: "Fuel cost",
    mileDiff: "Difference",
    lpgKm: "Kilometres a year",
    lpgPbCons: "Petrol use (l/100 km)",
    lpgLpgCons: "LPG use (l/100 km)",
    lpgLpgConsHint: "usually about 20% more",
    lpgPbPrice: (cur) => `Petrol price (${cur}/l)`,
    lpgLpgPrice: (cur) => `LPG price (${cur}/l)`,
    lpgPriceHint: "Polish average",
    lpgInstall: (cur) => `Conversion cost (${cur})`,
    lpgUpkeep: (cur) => `LPG servicing a year (${cur})`,
    lpgUpkeepHint: "inspections, filters, extra tests",
    lpgPer100: "Saving per 100 km",
    lpgYear: "Saving a year",
    lpgPayback: "Pays for itself after",
    lpgPaybackKm: "That is after",
    lpgFive: "Balance after 5 years",
    lpgUnits: { month: { one: "month", other: "months" }, year: { one: "year", other: "years" }, never: "never pays off" },
    fuelWord: "fuel",
    neighbour: "Neighbour",
    drive: "Fuel",
    route: "Route",
    crumbs: "Breadcrumb",
  },
  de: {
    home: "Rechner",
    guides: "Ratgeber",
    chartRanges: { "1y": "1 Jahr", "3y": "3 Jahre", "5y": "5 Jahre", all: "Seit 2005" },
    chartRangeLabel: "Zeitraum",
    chartNow: "Letzte Woche",
    chartYear: "Vor einem Jahr",
    chartFive: "Vor 5 Jahren",
    chartSeries: "Reihe",
    weekRank: "Platz",
    weekPrice: (date) => `Preis (${date})`,
    weekChange: "Veränderung zur Vorwoche",
    chartCaption: (date) => `Landesdurchschnitte aus dem wöchentlichen Oil Bulletin der Europäischen Kommission, in Euro. Letzte Woche: ${date}.`,
    plAdjusted: "Polen: aktueller Durchschnittspreis inklusive Steuersenkung und Änderungen der Orlen-Großhandelspreise – derselbe Preis wie im Rechner.",
    chartAria: (names) => `Preisdiagramm: ${names}`,
    euAverage: "EU-Durchschnitt",
    indexTitle: "Ratgeber: Spritpreise und Fahrtkosten in Europa | Tankful",
    indexHeading: "Ratgeber",
    indexDescription: "Tanken in Polen und Tschechien, Spritpreise in Österreich und Europa, Spritkosten und Verbrauch berechnen – Ratgeber mit stets aktuellen Preisen.",
    notFoundTitle: "Seite nicht gefunden | Tankful",
    notFoundHeading: "Seite nicht gefunden",
    notFoundLead: "Diese Adresse gibt es nicht oder sie hat sich geändert. Berechne deine Strecke im Rechner oder wähle eine der beliebten Strecken.",
    popularRoutes: "Beliebte Strecken",
    indexLead: "Konkrete Zahlen statt Allgemeinplätze. Die Preise in den Ratgebern aktualisieren sich von selbst, zusammen mit dem Rechner.",
    updated: (d) => `Offizielle EU-Durchschnittspreise vom ${d} · Daten alle 6 Stunden geprüft`,
    published: (d) => `Veröffentlicht am ${d}`,
    photo: (author, url) => `Foto: <a href="${url}" rel="noopener">${author}</a> / Unsplash`,
    cta: "Berechne deine Strecke",
    ctaText: "Gib Start und Ziel ein – der Rechner zeigt die Spritkosten mit aktuellen Preisen in jedem Land auf der Strecke.",
    ctaButton: "Zum Rechner",
    more: "Weitere Ratgeber",
    allGuides: "Alle Ratgeber",
    groups: { prices: "Spritpreise", border: "Tanken an der Grenze", tools: "Rechner", trips: "Mit dem Auto unterwegs", tips: "Tipps" },
    sources: "Preise: Weekly Oil Bulletin der Europäischen Kommission (Deutschland, Polen und die anderen EU-Länder), in Polen bei deutlichen Änderungen der Orlen-Großhandelspreise angepasst, Daten der britischen Regierung (GOV.UK), Wechselkurse der Polnischen Nationalbank. Es sind Landesdurchschnitte – an Autobahntankstellen ist es oft teurer.",
    privacy: "Datenschutz",
    code: "Quellcode",
    country: "Land",
    diff: "Unterschied",
    cheaper: "Günstiger in",
    same: "etwa gleich",
    tank: (l) => `Auf ${l} l`,
    per100: "Kosten für 100 km",
    consumption: "Verbrauch",
    share: "Anteil der Strecke",
    km: "km",
    total: "Durchschnitt der Strecke",
    homeCharging: "Laden zu Hause",
    fastCharging: "Schnelllader",
    noData: "keine Daten",
    verdictSame: (fuel) => `Ein Liter ${fuel} kostet auf beiden Seiten der Grenze praktisch gleich viel.`,
    verdict: (fuel, where, diff, litres, tank) => `Ein Liter ${fuel} ist ${where} um ${diff} günstiger – bei ${litres} Litern sparst du ${tank}.`,
    calcLitres: "Getankte Liter",
    calcKm: "Gefahrene km",
    calcFuel: "Kraftstoff",
    calcPrice: (cur) => `Preis pro Liter (${cur})`,
    calcPriceHint: "Durchschnitt in Deutschland",
    calcResult: "Durchschnittsverbrauch",
    calc100: "Kosten für 100 km",
    calcKmCost: "Kosten für 1 km",
    calcButton: "Spritkosten für eine Strecke mit diesem Verbrauch berechnen",
    lpgKm: "Fahrleistung pro Jahr (km)",
    lpgPbCons: "Verbrauch Super (l/100 km)",
    lpgLpgCons: "Verbrauch Autogas (l/100 km)",
    lpgLpgConsHint: "meist etwa 20 % mehr",
    lpgPbPrice: (cur) => `Preis Super (${cur}/l)`,
    lpgLpgPrice: (cur) => `Preis Autogas (${cur}/l)`,
    lpgPriceHint: "Durchschnitt in Deutschland",
    lpgInstall: (cur) => `Kosten der Umrüstung (${cur})`,
    lpgUpkeep: (cur) => `Wartung pro Jahr (${cur})`,
    lpgUpkeepHint: "Inspektion, Filter, Gasprüfung",
    lpgPer100: "Ersparnis pro 100 km",
    lpgYear: "Ersparnis pro Jahr",
    lpgPayback: "Die Anlage rechnet sich nach",
    lpgPaybackKm: "Also nach",
    lpgFive: "Bilanz nach 5 Jahren",
    lpgUnits: { month: { one: "Monat", other: "Monaten" }, year: { one: "Jahr", other: "Jahren" }, never: "rechnet sich nicht" },
    fuelWord: "Kraftstoff",
    neighbour: "Nachbarland",
    drive: "Antrieb",
    route: "Strecke",
    crumbs: "Brotkrumen",
  },
};

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function pricesDate(data) {
  return [data.fuelPrices?.date, data.fuelPrices?.orlen?.date, data.euPrices?.date, data.ukPrices?.date, data.usPrices?.date].filter(Boolean).sort().at(-1);
}

function adjustHistory(history, data) {
  const pl = history.prices.PL;
  const fresh = data.fuelPrices?.prices;
  if (!pl || !fresh) return history;
  const adjusted = { ...pl };
  let changed = false;
  for (const [fuel, values] of Object.entries(pl)) {
    let last = values.length - 1;
    while (last >= 0 && values[last] == null) last--;
    if (last < 0 || fresh[fuel] == null || history.dates[last] !== data.fuelPrices.date) continue;
    const eur = fresh[fuel] / history.plnPerEur[last];
    if (Math.abs(eur - values[last]) < 0.0005) continue;
    adjusted[fuel] = values.map((v, i) => (i === last ? eur : v));
    changed = true;
  }
  return changed ? { ...history, prices: { ...history.prices, PL: adjusted }, adjustedPL: true } : history;
}

function prices(data) {
  const eur = data.nbpRates.rates.EUR;
  const pln = (cc, fuel) => {
    if (fuel === "ev") return null;
    if (cc === "PL") return data.fuelPrices?.prices?.[fuel] ?? null;
    if (cc === "GB") {
      const v = data.ukPrices?.prices?.[fuel];
      return v ? v * data.nbpRates.rates.GBP : null;
    }
    const v = data.euPrices?.prices?.[cc]?.[fuel];
    return v ? v * eur : null;
  };
  return { pln, eur };
}

function context(lang, data, history) {
  const t = TEXT[lang];
  const currency = CURRENCY[lang];
  const { pln, eur } = prices(data);
  const toCur = (v, cur = currency) => (v == null ? null : cur === "PLN" ? v : v / (cur === "EUR" ? eur : data.nbpRates.rates[cur]));
  const num = (v, digits = 0) => new Intl.NumberFormat(INTL[lang], { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(v);
  const money = (v, cur = currency, digits) => {
    const d = digits ?? (v < (cur === "PLN" ? 10 : 100) ? 2 : 0);
    return new Intl.NumberFormat(INTL[lang], { style: "currency", currency: cur, minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
  };
  const unitPrice = (v, cur = currency, unit = "l") => (v == null ? t.noData : `${money(toCur(v, cur), cur, 2)}/${unit}`);
  const name = (cc) => new Intl.DisplayNames(INTL[lang], { type: "region" }).of(cc);
  const inCountry = (cc) =>
    lang === "pl" ? PL_IN[cc] : lang === "de" ? `in ${DE_DER.has(cc) ? "der " : DE_DEN.has(cc) ? "den " : ""}${name(cc)}` : `in ${EN_THE.has(cc) ? "the " : ""}${name(cc)}`;
  const date = (iso) => new Intl.DateTimeFormat(INTL[lang], { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(iso));
  const fuelName = (f) => FUELS[lang][f];
  const ev = (key) => (lang === "de" ? EV_EUR_DE[key] : toCur(EV_PLN[key]));

  const routeBySlug = (slug) => {
    const r = ROUTES.find((x) => x.pl === slug || x.en === slug || x.de === slug);
    if (!r) throw new Error(`Unknown route ${slug}`);
    return r;
  };
  const cityName = (key) => CITIES[key][lang] ?? CITIES[key].en;
  const routePricePln = (r, fuel) => {
    const shares = r.shares || { [CITIES[r.from].cc.toUpperCase()]: 1 };
    let sum = 0;
    let weight = 0;
    for (const [cc, share] of Object.entries(shares)) {
      const p = pln(cc, fuel);
      if (p) {
        sum += p * share;
        weight += share;
      }
    }
    return weight ? sum / weight : null;
  };

  const today = new Date().toISOString().slice(0, 10);
  const reduced = (fuel) => REDUCED_FUEL_VAT.find((p) => p.fuels.includes(fuel) && today >= p.from && today <= p.to);
  const vatRaise = (fuel) => (reduced(fuel) ? FUEL_VAT / reduced(fuel).rate : 1);

  const lpgSaving = (cc, pbCons, lpgCons) => toCur(pln(cc, "pb") * Number(pbCons) - pln(cc, "lpg") * Number(lpgCons)) / 100;

  const inline = {
    date: () => date(data.euPrices.date),
    price: (cc, fuel, cur) => unitPrice(pln(cc, fuel), cur || currency),
    diff: (a, b, fuel, cur) => money(Math.abs(toCur(pln(a, fuel) - pln(b, fuel), cur || currency)), cur || currency, 2),
    tank: (a, b, fuel, litres, cur) => money(Math.abs(toCur(pln(a, fuel) - pln(b, fuel), cur || currency)) * Number(litres), cur || currency),
    verdict: (a, b, fuel, litres = "50") => {
      const pa = pln(a, fuel);
      const pb = pln(b, fuel);
      if (Math.abs(pa - pb) < 0.01 * Math.min(pa, pb)) return t.verdictSame(FUELS_OF[lang][fuel]);
      return t.verdict(FUELS_OF[lang][fuel], inCountry(pa < pb ? a : b), inline.diff(a, b, fuel), litres, inline.tank(a, b, fuel, litres));
    },
    cost100: (cc, fuel, consumption) => money(toCur(pln(cc, fuel)) * Number(consumption)),
    ev100: (consumption, key) => money(ev(key) * Number(consumption)),
    evprice: (key) => `${money(ev(key), currency, 2)}/kWh`,
    fuel: (f) => fuelName(f),
    cheapest: (fuel) => inCountry(ranked(fuel)[0].cc),
    priciest: (fuel) => inCountry(ranked(fuel).at(-1).cc),
    rank: (cc, fuel) => String(ranked(fuel).findIndex((r) => r.cc === cc) + 1),
    count: (fuel) => String(ranked(fuel).length),
    in: (cc) => inCountry(cc),
    km: (slug) => num(routeBySlug(slug).km),
    litres: (slug, consumption) => num((routeBySlug(slug).km * Number(consumption)) / 100),
    trip: (slug, fuel, consumption, people = "1") => {
      const r = routeBySlug(slug);
      return money((toCur(routePricePln(r, fuel)) * r.km * Number(consumption)) / 100 / Number(people));
    },
    evtrip: (slug, consumption, key) => money((ev(key) * routeBySlug(slug).km * Number(consumption)) / 100),
    allowance: (slug, rate) => money(toCur(routeBySlug(slug).km * Number(rate))),
    vatold: (fuel) => unitPrice(pln("PL", fuel) * vatRaise(fuel)),
    vatsave: (fuel, litres) => money(toCur(pln("PL", fuel) * (vatRaise(fuel) - 1)) * Number(litres)),
    vattrip: (slug, fuel, consumption) => {
      const r = routeBySlug(slug);
      const share = r.shares ? r.shares.PL || 0 : CITIES[r.from].cc === "pl" ? 1 : 0;
      return money((toCur(pln("PL", fuel) * (vatRaise(fuel) - 1)) * r.km * share * Number(consumption)) / 100);
    },
    roundtrip: (slug, fuel, consumption) => {
      const r = routeBySlug(slug);
      return money((toCur(routePricePln(r, fuel)) * r.km * 2 * Number(consumption)) / 100);
    },
    triprate: (slug, fuel) => unitPrice(routePricePln(routeBySlug(slug), fuel)),
    cost: (cc, fuel, consumption, km) => money((toCur(pln(cc, fuel)) * Number(consumption) * Number(km)) / 100),
    save: (cc, fuel, from, to, km) => money((toCur(pln(cc, fuel)) * (Number(from) - Number(to)) * Number(km)) / 100),
    lpgsave: (cc, pbCons, lpgCons, km) => money(lpgSaving(cc, pbCons, lpgCons) * Number(km)),
    payback: (cc, pbCons, lpgCons, price) => num(Math.round(Number(price) / lpgSaving(cc, pbCons, lpgCons) / 1000) * 1000),
    rate: (cur) => money(data.nbpRates.rates[cur] * (currency === "PLN" ? 1 : 1 / eur), currency, 2),
  };

  const ranked = (fuel) =>
    [...EU, "GB"]
      .map((cc) => ({ cc, p: pln(cc, fuel) }))
      .filter((r) => r.p)
      .sort((a, b) => a.p - b.p);

  const table = (head, rows, numeric = []) => {
    const cell = (tag, v, i) => `<${tag}${numeric.includes(i) ? ' class="num"' : ""}>${v}</${tag}>`;
    return `<div class="table-wrap"><table>\n<thead><tr>${head.map((h, i) => cell("th", h, i)).join("")}</tr></thead>\n<tbody>\n${rows
      .map((r) => `<tr>${r.map((v, i) => cell("td", v, i)).join("")}</tr>`)
      .join("\n")}\n</tbody>\n</table></div>`;
  };

  const blocks = {
    europe: () => {
      const list = [...EU, "GB"]
        .map((cc) => ({ cc, pb: pln(cc, "pb"), on: pln(cc, "on"), lpg: pln(cc, "lpg") }))
        .sort((a, b) => a.pb - b.pb);
      const low = list[0].pb * 0.8;
      const high = list.at(-1).pb;
      const rows = list
        .map((r) => [
          esc(name(r.cc)),
          `<span class="bar-cell"><span class="price-bar" style="--w:${((r.pb - low) / (high - low)).toFixed(2)}"></span>${unitPrice(r.pb, "EUR")}</span>`,
          unitPrice(r.on, "EUR"),
          r.lpg ? unitPrice(r.lpg, "EUR") : "–",
          ...(lang === "pl" ? [unitPrice(r.pb, "PLN")] : []),
        ]);
      const head = [t.country, cap(fuelName("pb")), cap(fuelName("on")), "LPG", ...(lang === "pl" ? [`${cap(fuelName("pb"))} (zł)`] : [])];
      return table(head, rows, [1, 2, 3, 4]);
    },
    border: (home, ...others) => {
      const rows = [];
      for (const cc of others) {
        for (const fuel of ["pb", "on", "lpg"]) {
          const a = pln(home, fuel);
          const b = pln(cc, fuel);
          if (!a || !b) continue;
          const same = Math.abs(a - b) < 0.01 * Math.min(a, b);
          rows.push([
            `${esc(name(cc))} – ${fuelName(fuel)}`,
            unitPrice(a),
            unitPrice(b),
            money(Math.abs(toCur(a - b)), currency, 2),
            same ? t.same : `<span class="pill">${esc(name(a < b ? home : cc))}</span>`,
            same ? "–" : money(Math.abs(toCur(a - b)) * 50),
          ]);
        }
      }
      return table([`${t.country} – ${t.fuelWord}`, esc(name(home)), t.neighbour, t.diff, t.cheaper, t.tank(50)], rows, [1, 2, 3, 5]);
    },
    per100: (...ccs) => {
      const rows = [
        ...[["pb", 7], ["on", 6], ["lpg", 9]].map(([fuel, c]) => [
          cap(fuelName(fuel)),
          `${num(c)} l`,
          ...ccs.map((cc) => (pln(cc, fuel) ? money(toCur(pln(cc, fuel)) * c) : "–")),
        ]),
        [`${cap(fuelName("ev"))} – ${t.homeCharging}`, "17 kWh", ...ccs.map(() => money(ev("home") * 17))],
        [`${cap(fuelName("ev"))} – ${t.fastCharging}`, "17 kWh", ...ccs.map(() => money(ev("fast") * 17))],
      ];
      return table([t.drive, t.consumption, ...ccs.map((cc) => esc(name(cc)))], rows, ccs.map((_, i) => i + 2));
    },
    route: (slug, fuel = "pb") => {
      const r = routeBySlug(slug);
      const rows = Object.entries(r.shares || {})
        .sort((a, b) => b[1] - a[1])
        .map(([cc, share]) => [esc(name(cc)), `${num(share * 100)}%`, `${num(r.km * share)} ${t.km}`, unitPrice(pln(cc, fuel)), unitPrice(pln(cc, "on"))]);
      rows.push([`<strong>${t.total}</strong>`, "100%", `${num(r.km)} ${t.km}`, `<strong>${unitPrice(routePricePln(r, fuel))}</strong>`, `<strong>${unitPrice(routePricePln(r, "on"))}</strong>`]);
      return table([t.country, t.share, t.km, cap(fuelName("pb")), cap(fuelName("on"))], rows, [1, 2, 3, 4]);
    },
    trips: (...slugs) => {
      const rows = slugs.map((slug) => {
        const r = routeBySlug(slug);
        const cost = (fuel, c) => money((toCur(routePricePln(r, fuel)) * r.km * c) / 100);
        return [`<a href="${lang === "pl" ? `trasa/${r.pl}` : lang === "de" ? (r.de ? `strecke/${r.de}` : `https://koszt-paliwa.pl/route/${r.en}`) : `route/${r.en}`}">${esc(cityName(r.from))} – ${esc(cityName(r.to))}</a>`, `${num(r.km)} ${t.km}`, cost("pb", 7), cost("on", 6), cost("lpg", 9)];
      });
      return table([t.route, t.km, `${cap(fuelName("pb"))} 7 l`, `${cap(fuelName("on"))} 6 l`, "LPG 9 l"], rows, [1, 2, 3, 4]);
    },
  };

  blocks.mileage = () => {
    const rates = { car: 1.15, small: 0.89, moto: 0.69, moped: 0.42 };
    const options = Object.entries(t.mileVehicles).map(([k, label]) => `<option value="${k}">${esc(label)}</option>`).join("");
    const price = Math.round(pln("PL", "pb") * 100) / 100;
    return `<form class="calc" data-kind="mileage" data-rates="${esc(JSON.stringify(rates))}" data-locale="${INTL[lang]}">
<div class="calc-fields">
<label>${t.mileKm}<input name="km" type="number" inputmode="decimal" min="0" step="any" placeholder="300" /></label>
<label>${t.mileVehicle}<select name="vehicle">${options}</select></label>
<label>${t.mileConsumption}<input name="consumption" type="number" inputmode="decimal" min="0" step="0.1" value="7" /></label>
<label>${t.milePrice}<input name="price" type="number" inputmode="decimal" min="0" step="0.01" value="${price}" /><small>${t.milePriceHint}</small></label>
</div>
<div class="calc-result" aria-live="polite">
<div><span>${t.mileResult}</span><output name="allowance">–</output></div>
<div><span>${t.mileFuel}</span><output name="fuel">–</output></div>
<div><span>${t.mileDiff}</span><output name="diff">–</output></div>
</div>
</form>`;
  };

  blocks.lpg = () => {
    const cc = lang === "de" ? "DE" : "PL";
    const round = (v) => Math.round(toCur(pln(cc, v)) * 100) / 100;
    const install = { pl: 4500, en: 1050, de: 2500 }[lang];
    const upkeep = { pl: 300, en: 70, de: 150 }[lang];
    return `<form class="calc" data-kind="lpg" data-currency="${currency}" data-locale="${INTL[lang]}" data-units="${esc(JSON.stringify(t.lpgUnits))}">
<div class="calc-fields">
<label>${t.lpgKm}<input name="km" type="number" inputmode="decimal" min="0" step="1000" value="15000" /></label>
<label>${t.lpgPbCons}<input name="pbCons" type="number" inputmode="decimal" min="0" step="0.1" value="7" /></label>
<label>${t.lpgLpgCons}<input name="lpgCons" type="number" inputmode="decimal" min="0" step="0.1" value="8.4" /><small>${t.lpgLpgConsHint}</small></label>
<label>${esc(t.lpgPbPrice(currency))}<input name="pbPrice" type="number" inputmode="decimal" min="0" step="0.01" value="${round("pb")}" /><small>${t.lpgPriceHint}</small></label>
<label>${esc(t.lpgLpgPrice(currency))}<input name="lpgPrice" type="number" inputmode="decimal" min="0" step="0.01" value="${round("lpg")}" /><small>${t.lpgPriceHint}</small></label>
<label>${esc(t.lpgInstall(currency))}<input name="install" type="number" inputmode="decimal" min="0" step="100" value="${install}" /></label>
<label>${esc(t.lpgUpkeep(currency))}<input name="upkeep" type="number" inputmode="decimal" min="0" step="10" value="${upkeep}" /><small>${t.lpgUpkeepHint}</small></label>
</div>
<div class="calc-result" aria-live="polite">
<div class="calc-main"><span>${t.lpgPayback}</span><output name="payback">–</output><span>${t.lpgPaybackKm} <output name="paybackKm">–</output></span></div>
<div><span>${t.lpgPer100}</span><output name="per100">–</output></div>
<div><span>${t.lpgYear}</span><output name="year">–</output></div>
<div><span>${t.lpgFive}</span><output name="five">–</output></div>
</div>
</form>`;
  };

  blocks.consumption = () => {
    const avg = (fuel) => {
      if (lang === "pl") return pln("PL", fuel);
      if (lang === "de") return pln("DE", fuel);
      const list = EU.map((cc) => pln(cc, fuel)).filter(Boolean);
      return list.reduce((a, b) => a + b, 0) / list.length;
    };
    const fuels = ["pb", "on", "lpg"];
    const priceOf = Object.fromEntries(fuels.map((f) => [f, Math.round(toCur(avg(f)) * 100) / 100]));
    const home = HOME[lang];
    const options = fuels.map((f) => `<option value="${f}">${esc(cap(fuelName(f)))}</option>`).join("");
    return `<form class="calc" data-kind="consumption" data-prices="${esc(JSON.stringify(priceOf))}" data-currency="${currency}" data-locale="${INTL[lang]}" data-home="${home}">
<div class="calc-fields">
<label>${t.calcLitres}<input name="litres" type="number" inputmode="decimal" min="0" step="any" placeholder="42" /></label>
<label>${t.calcKm}<input name="km" type="number" inputmode="decimal" min="0" step="any" placeholder="600" /></label>
<label>${t.calcFuel}<select name="fuel">${options}</select></label>
<label>${esc(t.calcPrice(currency))}<input name="price" type="number" inputmode="decimal" min="0" step="0.01" value="${priceOf.pb}" /><small>${t.calcPriceHint}</small></label>
</div>
<div class="calc-result" aria-live="polite">
<div><span>${t.calcResult}</span><output name="consumption">–</output></div>
<div><span>${t.calc100}</span><output name="cost100">–</output></div>
<div><span>${t.calcKmCost}</span><output name="costkm">–</output></div>
</div>
<a class="button" href="${home}">${t.calcButton}</a>
</form>`;
  };

  const histName = (cc) => (cc === "EU" ? t.euAverage : name(cc));
  const histSeries = (cc, fuel) => {
    const values = history.prices[cc]?.[fuel];
    if (!values) throw new Error(`No price history for ${cc} ${fuel}`);
    return values.map((v, i) => (v == null ? null : currency === "PLN" ? v * history.plnPerEur[i] : v));
  };
  const lastIndex = (values) => {
    for (let i = values.length - 1; i >= 0; i--) if (values[i] != null) return i;
    return -1;
  };
  const weeksAgo = (values, weeks) => {
    const last = lastIndex(values);
    const target = Date.parse(history.dates[last]) - Number(weeks) * 7 * 86400000;
    for (let i = last; i >= 0; i--) if (values[i] != null && Date.parse(history.dates[i]) <= target) return i;
    return -1;
  };
  const histPrice = (v) => (v == null ? t.noData : `${money(v, currency, 2)}/l`);
  const monthYear = (iso) => new Intl.DateTimeFormat(INTL[lang], { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(iso));
  const peakIndex = (values) => values.reduce((best, v, i) => (v != null && (best < 0 || v > values[best]) ? i : best), -1);

  Object.assign(inline, {
    histdate: () => date(history.dates[lastIndex(history.prices.PL.pb)]),
    histstart: () => history.dates[0].slice(0, 4),
    now: (cc, fuel) => histPrice(histSeries(cc, fuel).at(lastIndex(histSeries(cc, fuel)))),
    ago: (cc, fuel, weeks) => {
      const values = histSeries(cc, fuel);
      return histPrice(values[weeksAgo(values, weeks)]);
    },
    change: (cc, fuel, weeks) => {
      const values = histSeries(cc, fuel);
      const now = values[lastIndex(values)];
      const then = values[weeksAgo(values, weeks)];
      const diff = now - then;
      const sign = diff > 0 ? "+" : diff < 0 ? "−" : "";
      return `${sign}${money(Math.abs(diff), currency, 2)} (${sign}${num(Math.abs((diff / then) * 100), 0)}%)`;
    },
    peak: (cc, fuel) => {
      const values = histSeries(cc, fuel);
      return histPrice(values[peakIndex(values)]);
    },
    peakdate: (cc, fuel) => monthYear(history.dates[peakIndex(histSeries(cc, fuel))]),
  });

  const weekly = (fuel) =>
    [...EU, "EU"]
      .map((cc) => {
        const values = history.prices[cc]?.[fuel];
        if (!values) return null;
        const series = histSeries(cc, fuel);
        const last = lastIndex(series);
        const prev = weeksAgo(series, 1);
        if (last < 0 || prev < 0 || history.dates[last] !== history.dates[lastIndex(history.prices.EU[fuel])]) return null;
        return { cc, now: series[last], prev: series[prev] };
      })
      .filter(Boolean);
  const signed = (diff, digits = 2) => {
    const rounded = Math.round(diff * 10 ** digits);
    const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : "";
    return `${sign}${money(Math.abs(diff), currency, digits)}`;
  };
  const movers = (fuel) => weekly(fuel).filter((x) => x.cc !== "EU").sort((a, b) => b.now - b.prev - (a.now - a.prev));

  Object.assign(inline, {
    weekup: (fuel) => {
      const top = movers(fuel)[0];
      return `${histName(top.cc)} (${signed(top.now - top.prev)})`;
    },
    weekdown: (fuel) => {
      const bottom = movers(fuel).at(-1);
      return `${histName(bottom.cc)} (${signed(bottom.now - bottom.prev)})`;
    },
    weekrank: (cc, fuel) => String(weekly(fuel).filter((x) => x.cc !== "EU").sort((a, b) => a.now - b.now).findIndex((x) => x.cc === cc) + 1),
    weekcount: (fuel) => String(weekly(fuel).filter((x) => x.cc !== "EU").length),
    weekdelta: (cc, fuel) => {
      const x = weekly(fuel).find((y) => y.cc === cc);
      return x ? signed(x.now - x.prev) : t.noData;
    },
  });

  blocks.weekly = (fuel = "pb") => {
    const rows = weekly(fuel).sort((a, b) => a.now - b.now);
    const date = (iso) => new Intl.DateTimeFormat(INTL[lang], { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(iso));
    let place = 0;
    const body = rows.map((x) => {
      const eu = x.cc === "EU";
      if (!eu) place++;
      const diff = x.now - x.prev;
      const pct = (diff / x.prev) * 100;
      const pctSign = Math.round(pct * 10) > 0 ? "+" : Math.round(pct * 10) < 0 ? "−" : "";
      const change = `${signed(diff)} (${pctSign}${num(Math.abs(pct), 1)}%)`;
      const mark = x.cc === "PL" && history.adjustedPL ? "*" : "";
      const name = eu ? `<strong>${esc(histName(x.cc))}</strong>` : `${esc(histName(x.cc))}${mark}`;
      return [eu ? "–" : String(place), name, histPrice(x.now), change];
    });
    const last = history.dates[lastIndex(history.prices.EU[fuel])];
    const note = history.adjustedPL ? `\n<p class="table-note">* ${esc(t.plAdjusted)}</p>` : "";
    return `${table([t.weekRank, t.country, t.weekPrice(date(last)), t.weekChange], body, [0, 2, 3])}${note}`;
  };

  blocks.chart = (countries, fuels = "pb", range = "3y") => {
    const ccs = countries.split(",");
    const fs_ = fuels.split(",");
    const series = ccs.flatMap((cc) => fs_.map((fuel) => ({ cc, fuel })));
    const label = ({ cc, fuel }) =>
      ccs.length > 1 && fs_.length > 1 ? `${histName(cc)} – ${fuelName(fuel)}` : ccs.length > 1 ? histName(cc) : cap(fuelName(fuel));
    const rows = series.map((x) => {
      const values = histSeries(x.cc, x.fuel);
      return [esc(label(x)), histPrice(values[lastIndex(values)]), histPrice(values[weeksAgo(values, 52)]), histPrice(values[weeksAgo(values, 260)])];
    });
    const buttons = Object.entries(t.chartRanges)
      .map(([key, text]) => `<button type="button" data-range="${key}"${key === range ? ' aria-pressed="true"' : ' aria-pressed="false"'}>${text}</button>`)
      .join("");
    return `<figure class="chart" data-series="${series.map((x) => `${x.cc}:${x.fuel}`).join(",")}" data-labels="${esc(series.map(label).join("|"))}" data-range="${range}" data-currency="${currency}" data-locale="${INTL[lang]}">
<div class="chart-ranges" role="group" aria-label="${t.chartRangeLabel}">${buttons}</div>
<div class="chart-canvas"><canvas role="img" aria-label="${esc(t.chartAria(series.map(label).join(", ")))}"></canvas></div>
${table([t.chartSeries, t.chartNow, t.chartYear, t.chartFive], rows, [1, 2, 3])}
<figcaption>${esc(t.chartCaption(date(history.dates[lastIndex(history.prices.PL.pb)])))}${history.adjustedPL && ccs.includes("PL") ? ` ${esc(t.plAdjusted)}` : ""}</figcaption>
</figure>`;
  };

  const routeCost = (slug, fuel, consumption) => {
    const r = routeBySlug(slug);
    const price = routePricePln(r, fuel);
    return price ? money((toCur(price) * r.km * consumption) / 100, currency, 0) : null;
  };
  return { inline, blocks, routeCost };
}

function inlineMd(text, ctx) {
  const tokens = [];
  let s = text.replace(/\{\{([^}]+)\}\}/g, (_, expr) => {
    const [fn, ...args] = expr.trim().split(/\s+/);
    if (!ctx.inline[fn]) throw new Error(`Unknown token {{${expr}}}`);
    tokens.push(esc(ctx.inline[fn](...args)));
    return `\u0000${tokens.length - 1}\u0000`;
  });
  s = esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
      const external = /^https?:/.test(href);
      return `<a href="${href}"${external ? ' rel="noopener"' : ""}>${label}</a>`;
    });
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => tokens[i]);
}

function markdown(src, ctx) {
  const out = [];
  for (const block of src.trim().split(/\n\s*\n/)) {
    const lines = block.split("\n").map((l) => l.trimEnd());
    const first = lines[0];
    const blockToken = first.match(/^\{\{(\w+):?\s*([^}]*)\}\}$/);
    if (blockToken && ctx.blocks[blockToken[1]] && lines.length === 1) {
      out.push(ctx.blocks[blockToken[1]](...blockToken[2].trim().split(/\s+/).filter(Boolean)));
    } else if (/^#{2,3} /.test(first)) {
      const level = first.match(/^#+/)[0].length;
      const text = first.slice(level + 1);
      const id = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ł/g, "l").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      out.push(`<h${level} id="${id}">${inlineMd(text, ctx)}</h${level}>`);
      if (lines.length > 1) out.push(`<p>${inlineMd(lines.slice(1).join(" "), ctx)}</p>`);
    } else if (/^- /.test(first)) {
      out.push(`<ul>\n${lines.map((l) => `<li>${inlineMd(l.replace(/^- /, ""), ctx)}</li>`).join("\n")}\n</ul>`);
    } else if (/^\d+\. /.test(first)) {
      out.push(`<ol>\n${lines.map((l) => `<li>${inlineMd(l.replace(/^\d+\. /, ""), ctx)}</li>`).join("\n")}\n</ol>`);
    } else if (/^\|/.test(first)) {
      const row = (l) => l.replace(/^\||\|$/g, "").split("|").map((c) => inlineMd(c.trim(), ctx));
      const body = lines.slice(2).map(row);
      out.push(`<div class="table-wrap"><table>\n<thead><tr>${row(first).map((c) => `<th>${c}</th>`).join("")}</tr></thead>\n<tbody>\n${body.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("\n")}\n</tbody>\n</table></div>`);
    } else if (/^> /.test(first)) {
      out.push(`<aside class="note">${inlineMd(lines.map((l) => l.replace(/^> ?/, "")).join(" "), ctx)}</aside>`);
    } else {
      out.push(`<p>${inlineMd(lines.join(" "), ctx)}</p>`);
    }
  }
  return out.join("\n");
}

function parse(file) {
  const src = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const m = src.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`${file}: missing front matter`);
  const meta = Object.fromEntries(
    m[1].split("\n").map((l) => {
      const i = l.indexOf(":");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
  );
  for (const key of ["id", "slug", "title", "heading", "description", "published", "order"]) {
    if (!meta[key]) throw new Error(`${file}: missing "${key}"`);
  }
  return { ...meta, photo: meta.photo || meta.id, order: Number(meta.order), body: m[2] };
}

function loadGuides() {
  const guides = {};
  for (const lang of Object.keys(DIRS)) {
    const dir = path.join(GUIDES, lang);
    guides[lang] = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .map((f) => ({ ...parse(path.join(dir, f)), lang }))
      .sort((a, b) => a.order - b.order);
  }
  const ids = (lang) => guides[lang].map((g) => g.id).sort().join(",");
  if (ids("pl") !== ids("en")) throw new Error(`Guides differ between languages: ${ids("pl")} vs ${ids("en")}`);
  return guides;
}

function stylesheet(site) {
  const css = fs.readdirSync(path.join(site, "assets")).find((f) => /^index-.*\.css$/.test(f));
  if (!css) throw new Error("No built stylesheet in _site/assets");
  return `assets/${css}`;
}

const ICONS = {
  "europe-prices": '<path d="M3 22h12M4 9h10M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 4 0V9.83a2 2 0 0 0-.59-1.42L18 5"/>',
  border: '<path d="M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.33 2q2 0 3.07-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.53"/>',
  "per-100-km": '<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
  "how-to-calculate": '<rect width="16" height="20" x="4" y="2" rx="2"/><path d="M8 6h8M16 14v4M16 10h.01M12 10h.01M8 10h.01M12 14h.01M8 14h.01M12 18h.01M8 18h.01"/>',
  split: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  germany: '<path d="M20 10c0 4.99-5.53 10.19-7.4 11.8a1 1 0 0 1-1.2 0C9.53 20.19 4 14.99 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  czechia: '<path d="M3 22h18M6 18v-7M10 18v-7M14 18v-7M18 18v-7M12 2l8 5H4z"/>',
  lpg: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  seaside: '<path d="M22 18H2a4 4 0 0 0 4 4h12a4 4 0 0 0 4-4Z"/><path d="M21 14 10 2 3 14h18Z"/><path d="M10 2v16"/>',
  "fuel-saving": '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
  "price-history": '<path d="M22 7 13.5 15.5 8.5 10.5 2 17"/><path d="M16 7h6v6"/>',
  austria: '<path d="m8 3 4 8 5-5 5 15H2L8 3z"/>',
  hungary: '<path d="M3 22h18M5 22V12M19 22V12M3 12h18M12 3l9 9H3l9-9zM9 22v-5h6v5"/>',
  west: '<path d="M12 2 8 22M12 2l4 20M9.5 15h5M10.5 9h3"/>',
  "ev-trip": '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
  consumption: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
  "lpg-calc": '<rect width="16" height="20" x="4" y="2" rx="2"/><path d="M8 6h8M16 14v4M16 10h.01M12 10h.01M8 10h.01M12 14h.01M8 14h.01M12 18h.01M8 18h.01"/>',
  mileage: '<path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/>',
  croatia: '<circle cx="12" cy="8" r="3.5"/><path d="M12 1.5v1M5.6 4.1l.7.7M18.4 4.1l-.7.7M3 9h1M20 9h1M2 16c2 0 3-1.5 5-1.5s3 1.5 5 1.5 3-1.5 5-1.5 3 1.5 5 1.5M2 21c2 0 3-1.5 5-1.5s3 1.5 5 1.5 3-1.5 5-1.5 3 1.5 5 1.5"/>',
};
const icon = (id, cls = "icon") => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${ICONS[id] || ICONS["per-100-km"]}</svg>`;
const GAUGE = `<svg class="hero-gauge" viewBox="0 0 128 128" aria-hidden="true"><path d="M31.1 91 A38 38 0 1 1 96.9 91" fill="none" stroke="#F2A516" stroke-width="9" stroke-linecap="round"/><path d="M31.1 91 A38 38 0 1 1 96.9 91" fill="none" stroke="#FAF7F0" stroke-width="1" stroke-dasharray="1 7.95" transform="translate(64 64) scale(1.32) translate(-64 -64)"/><line x1="64" y1="74" x2="87" y2="51" stroke="#FAF7F0" stroke-width="6" stroke-linecap="round"/><circle cx="64" cy="74" r="7" fill="#FAF7F0"/></svg>`;

const CHART_SCRIPTS = `    <script src="chart.umd.min.js" defer></script>
    <script src="guides-charts.js" defer></script>
`;

const CALC_SCRIPTS = {
  consumption: `    <script src="guides-consumption.js" defer></script>\n`,
  mileage: `    <script src="guides-mileage.js" defer></script>\n`,
  lpg: `    <script src="guides-lpg.js" defer></script>\n`,
};

function layout({ lang, title, description, url, alternates, css, schema, hero, main, other, base = "../" }) {
  const charts = main.includes('class="chart"');
  const calc = Object.keys(CALC_SCRIPTS).filter((kind) => main.includes(`data-kind="${kind}"`));
  const t = TEXT[lang];
  const home = HOME[lang];
  return `<!doctype html>
<html lang="${lang}">
  <head>
    <meta charset="UTF-8" />
    <base href="${base}" />
${THEME_SCRIPT}    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <link rel="icon" type="image/svg+xml" href="icon.svg" />
    <link rel="apple-touch-icon" href="apple-touch-icon.png" />
    <meta name="theme-color" content="#1B2430" />
    <link rel="stylesheet" href="${css}" />
    <link rel="stylesheet" href="guides.css" />
    <script src="guides-analytics.js" defer></script>
${charts ? CHART_SCRIPTS : ""}${calc.map((kind) => CALC_SCRIPTS[kind]).join("")}${url ? `    <link rel="canonical" href="${url}" />` : `    <meta name="robots" content="noindex" />`}
${alternates.map((l) => `    ${l}`).join("\n")}
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="Tankful" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
${url ? `    <meta property="og:url" content="${url}" />\n` : ""}    <meta property="og:image" content="${schema.image}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:locale" content="${OG_LOCALE[lang]}" />
    <meta name="twitter:card" content="summary_large_image" />
    <script type="application/ld+json">${JSON.stringify(schema.data).replace(/</g, "\\u003c")}</script>
    <meta name="color-scheme" content="light dark" />
  </head>
  <body>
    <header class="site-header">
      <div class="bar">
        <a class="brand" href="${home}"><img src="icon.svg" alt="" width="28" height="28" />Tankful</a>
        <nav aria-label="Menu">
${NAV[lang]
      .map(([label, slug]) => {
        const href = slug ? `${DIRS[lang]}/${slug}` : home;
        const current = slug && url?.endsWith(`/${href}`) ? ' aria-current="page"' : "";
        return `          <a href="${href}"${current}>${label}</a>\n`;
      })
      .join("")}          <a href="${DIRS[lang]}/">${t.guides}</a>
          <a class="lang" href="${other.href}" hreflang="${other.lang}" lang="${other.lang}">${other.lang.toUpperCase()}</a>
        </nav>
      </div>
    </header>
    <section class="hero">
      <div class="hero-inner">
${hero}
      </div>
      ${GAUGE}
    </section>
    <main class="guide">
${main}
    </main>
    <footer class="site-footer">
      <p>${esc(t.sources)}</p>
      <p><a href="privacy.html">${t.privacy}</a> · <a href="https://github.com/Michalskii/tankful">${t.code}</a></p>
    </footer>
  </body>
</html>
`;
}

function buildGuides({ site, siteUrl, siteUrls, langSite, siteId, data, history: published, alternates }) {
  const history = adjustHistory(published, data);
  const guides = loadGuides();
  const css = stylesheet(site);
  fs.copyFileSync(path.join(GUIDES, "guides.css"), path.join(site, "guides.css"));
  fs.copyFileSync(path.join(GUIDES, "charts.js"), path.join(site, "guides-charts.js"));
  fs.copyFileSync(path.join(GUIDES, "analytics.js"), path.join(site, "guides-analytics.js"));
  fs.copyFileSync(path.join(GUIDES, "consumption.js"), path.join(site, "guides-consumption.js"));
  fs.copyFileSync(path.join(GUIDES, "mileage.js"), path.join(site, "guides-mileage.js"));
  fs.copyFileSync(path.join(GUIDES, "lpg.js"), path.join(site, "guides-lpg.js"));
  fs.mkdirSync(path.join(site, "data/history"), { recursive: true });
  for (const [cc, fuels] of Object.entries(history.prices)) {
    fs.writeFileSync(path.join(site, "data/history", `${cc}.json`), JSON.stringify({ dates: history.dates, plnPerEur: history.plnPerEur, ...fuels }));
  }
  fs.cpSync(path.join(GUIDES, "img"), path.join(site, "img/guides"), { recursive: true });
  const langs = Object.keys(DIRS).filter((lang) => langSite[lang] === siteId);
  for (const g of langs.flatMap((lang) => guides[lang])) if (!PHOTOS[g.photo] || !fs.existsSync(path.join(GUIDES, "img", `${g.photo}.webp`))) throw new Error(`Missing photo for guide "${g.id}"`);
  const photoUrl = (id) => `${siteUrl}img/guides/${id}.jpg`;
  const url = (lang, slug) => `${siteUrls[langSite[lang]]}${DIRS[lang]}/${slug ?? ""}`;
  const href = (lang, slug) => (langSite[lang] === siteId ? `${DIRS[lang]}/${slug ?? ""}` : url(lang, slug));
  const entry = (lang, slug, lastmod) => ({ lang, url: url(lang, slug), local: langSite[lang] === siteId, lastmod });
  const groups = [];
  const updated = data.euPrices.date;
  const priced = pricesDate(data);
  const modified = (g) => [g.published, priced].sort().at(-1);

  for (const lang of langs) fs.mkdirSync(path.join(site, DIRS[lang]), { recursive: true });

  const indexGroup = Object.keys(DIRS).filter((lang) => guides[lang].length).map((lang) => entry(lang, undefined, [priced, ...guides[lang].map((g) => g.published)].sort().at(-1)));
  groups.push(indexGroup);
  for (const lang of langs) {
    const t = TEXT[lang];
    const other = lang === "en" ? "pl" : "en";
    const card = (g, compact) =>
      compact
        ? `          <li><a href="${href(lang, g.slug)}">${icon(g.id, "tile")}<div class="card-body"><strong>${esc(g.heading)}</strong><span>${esc(g.description)}</span></div></a></li>`
        : `          <li><a href="${href(lang, g.slug)}"><div class="card-media"><img class="card-photo" src="img/guides/${g.photo}.webp" width="1400" height="735" alt="" loading="lazy" />${icon(g.id, "tile")}</div><div class="card-body"><strong>${esc(g.heading)}</strong><span>${esc(g.description)}</span></div></a></li>`;
    const list = Object.keys(GROUP_IDS)
      .map((group) => {
        const items = guides[lang].filter((g) => groupOf(g) === group);
        if (!items.length) return "";
        const compact = COMPACT_GROUPS.has(group);
        return `      <section class="guide-group" aria-labelledby="group-${group}">
        <h2 id="group-${group}">${esc(t.groups[group])}</h2>
        <ul class="guide-list${compact ? " compact" : ""}">
${items.map((g) => card(g, compact)).join("\n")}
        </ul>
      </section>`;
      })
      .filter(Boolean)
      .join("\n");
    const hero = `        <h1>${t.indexHeading}</h1>
        <p class="lead">${esc(t.indexLead)}</p>`;
    const main = list;
    const indexSchema = {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: t.indexHeading,
      url: url(lang),
      inLanguage: lang,
      description: t.indexDescription,
      hasPart: guides[lang].map((g) => ({ "@type": "Article", headline: g.heading, url: url(lang, g.slug) })),
    };
    fs.writeFileSync(
      path.join(site, DIRS[lang], "index.html"),
      layout({
        lang,
        title: t.indexTitle,
        description: t.indexDescription,
        url: url(lang),
        alternates: alternates(indexGroup),
        css,
        schema: { image: `${siteUrl}og-${lang}.png`, data: indexSchema },
        hero,
        main,
        other: { lang: other, href: href(other) },
      })
    );
  }

  for (const id of [...new Set(Object.values(guides).flat().map((g) => g.id))]) {
    const pair = Object.keys(DIRS).map((lang) => guides[lang].find((g) => g.id === id)).filter(Boolean);
    if (!pair.some((g) => langSite[g.lang] === siteId)) continue;
    const group = pair.map((g) => entry(g.lang, g.slug, modified(g)));
    groups.push(group);
    for (const g of pair.filter((x) => langSite[x.lang] === siteId)) {
      const t = TEXT[g.lang];
      const ctx = context(g.lang, data, history);
      const other = pair.find((p) => p.lang === (g.lang === "en" ? "pl" : "en"));
      const date = (iso) => new Intl.DateTimeFormat(INTL[g.lang], { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(iso));
      const others = guides[g.lang].filter((x) => x.id !== id);
      const related = [...others.filter((x) => groupOf(x) === groupOf(g)), ...others.filter((x) => groupOf(x) !== groupOf(g))].slice(0, 4);
      const more = related
        .map((x) => `          <li><a href="${href(g.lang, x.slug)}">${icon(x.id, "tile")}<span>${esc(x.heading)}</span></a></li>`)
        .join("\n");
      const home = HOME[g.lang];
      const hero = `        <nav class="crumbs" aria-label="${t.crumbs}"><a href="${home}">Tankful</a> / <a href="${href(g.lang)}">${t.guides}</a></nav>
        <div class="hero-title">${icon(g.id, "tile")}<h1>${esc(g.heading)}</h1></div>
        <p class="meta">${esc(t.updated(date(updated)))} · ${esc(t.published(date(g.published)))}</p>`;
      const photo = PHOTOS[g.photo];
      const main = `      <article>
        <figure class="cover">
          <img src="img/guides/${g.photo}.webp" width="1400" height="735" alt="${esc(photo.alt[g.lang])}" fetchpriority="high" />
          <figcaption>${t.photo(esc(photo.author), photo.url)}</figcaption>
        </figure>
${markdown(g.body, ctx)
  .split("\n")
  .map((l) => `        ${l}`)
  .join("\n")}
      </article>
      <section class="cta">
        <h2>${t.cta}</h2>
        <p>${esc(t.ctaText)}</p>
        <a class="button" href="${home}">${t.ctaButton}</a>
        ${GAUGE.replace("hero-gauge", "cta-gauge")}
      </section>
      <section class="more">
        <h2>${t.more}</h2>
        <ul class="related">
${more}
        </ul>
        <a class="all-guides" href="${href(g.lang)}">${t.allGuides}</a>
      </section>`;
      const schemaData = [
        {
          "@context": "https://schema.org",
          "@type": "Article",
          headline: g.heading,
          description: g.description,
          url: url(g.lang, g.slug),
          inLanguage: g.lang,
          datePublished: g.published,
          dateModified: modified(g),
          image: photoUrl(g.photo),
          author: { "@type": "Person", name: "Michał Goryński" },
          publisher: { "@type": "Organization", name: "Tankful", url: siteUrl, logo: `${siteUrl}app-512.png` },
          isPartOf: { "@type": "WebSite", name: "Tankful", url: siteUrl },
        },
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Tankful", item: `${siteUrl}${g.lang === "en" ? "en" : ""}` },
            { "@type": "ListItem", position: 2, name: t.guides, item: url(g.lang) },
            { "@type": "ListItem", position: 3, name: g.heading, item: url(g.lang, g.slug) },
          ],
        },
      ];
      fs.writeFileSync(
        path.join(site, DIRS[g.lang], `${g.slug}.html`),
        layout({
          lang: g.lang,
          title: g.title,
          description: g.description,
          url: url(g.lang, g.slug),
          alternates: alternates(group),
          css,
          schema: { image: photoUrl(g.photo), data: schemaData },
          hero,
          main,
          other: other ? { lang: other.lang, href: href(other.lang, other.slug) } : { lang: g.lang === "en" ? "pl" : "en", href: href(g.lang === "en" ? "pl" : "en") },
        })
      );
    }
  }
  const lang = siteId === "de" ? "de" : "pl";
  const t = TEXT[lang];
  const routeDir = { pl: "trasa", en: "route", de: "strecke" }[lang];
  const routeLinks = ROUTES.filter((r) => r[lang] && (lang === "de" || !r.deOnly))
    .slice(0, 12)
    .map((r) => {
      const [from, to] = lang === "de" && r.deFlip ? [r.to, r.from] : [r.from, r.to];
      const name = (key) => CITIES[key][lang] ?? CITIES[key].en;
      return `          <li><a href="${routeDir}/${r[lang]}">${icon("per-100-km", "tile")}<span>${esc(name(from))} – ${esc(name(to))}</span></a></li>`;
    })
    .join("\n");
  const guideLinks = guides[lang]
    .slice(0, 6)
    .map((g) => `          <li><a href="${href(lang, g.slug)}">${icon(g.id, "tile")}<span>${esc(g.heading)}</span></a></li>`)
    .join("\n");
  fs.writeFileSync(
    path.join(site, "404.html"),
    layout({
      lang,
      title: t.notFoundTitle,
      description: t.notFoundLead,
      alternates: [],
      css,
      schema: { image: `${siteUrl}og-${lang}.png`, data: { "@context": "https://schema.org", "@type": "WebPage", name: t.notFoundHeading } },
      hero: `        <h1>${t.notFoundHeading}</h1>
        <p class="lead">${esc(t.notFoundLead)}</p>`,
      main: `      <section class="cta">
        <h2>${t.cta}</h2>
        <p>${esc(t.ctaText)}</p>
        <a class="button" href="${HOME[lang]}">${t.ctaButton}</a>
        ${GAUGE.replace("hero-gauge", "cta-gauge")}
      </section>
      <section class="more">
        <h2>${t.popularRoutes}</h2>
        <ul class="related">
${routeLinks}
        </ul>
      </section>
      <section class="more">
        <h2>${t.guides}</h2>
        <ul class="related">
${guideLinks}
        </ul>
        <a class="all-guides" href="${href(lang)}">${t.allGuides}</a>
      </section>`,
      other: lang === "de" ? { lang: "pl", href: siteUrls.pl } : { lang: "en", href: "en" },
      base: "/",
    })
  );
  console.log(`Guides: ${langs.map((lang) => `${guides[lang].length} ${lang}`).join(", ")}`);
  return groups;
}

module.exports = { buildGuides, loadGuides, context, markdown, pricesDate, FUELS };
