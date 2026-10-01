const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const GUIDES = path.join(ROOT, "site/guides");
const PHOTOS = JSON.parse(fs.readFileSync(path.join(GUIDES, "photos.json"), "utf8"));
const { cities: CITIES, routes: ROUTES } = JSON.parse(fs.readFileSync(path.join(ROOT, "site/src/lib/routes.json"), "utf8"));

const DIRS = { pl: "poradniki", en: "guides" };
const CURRENCY = { pl: "PLN", en: "EUR" };
const INTL = { pl: "pl-PL", en: "en-GB" };
const EU = ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE"];
const FUELS = {
  pl: { pb: "benzyna 95", on: "diesel", lpg: "LPG", ev: "prąd" },
  en: { pb: "petrol (95)", on: "diesel", lpg: "LPG", ev: "electricity" },
};
const FUELS_OF = {
  pl: { pb: "benzyny 95", on: "oleju napędowego", lpg: "LPG" },
  en: { pb: "petrol", on: "diesel", lpg: "LPG" },
};
const PL_IN = {
  AT: "w Austrii", BE: "w Belgii", BG: "w Bułgarii", HR: "w Chorwacji", CY: "na Cyprze", CZ: "w Czechach", DK: "w Danii",
  EE: "w Estonii", FI: "w Finlandii", FR: "we Francji", DE: "w Niemczech", GR: "w Grecji", HU: "na Węgrzech", IE: "w Irlandii",
  IT: "we Włoszech", LV: "na Łotwie", LT: "na Litwie", LU: "w Luksemburgu", MT: "na Malcie", NL: "w Holandii", PL: "w Polsce",
  PT: "w Portugalii", RO: "w Rumunii", SK: "na Słowacji", SI: "w Słowenii", ES: "w Hiszpanii", SE: "w Szwecji", GB: "w Wielkiej Brytanii",
};
const EN_THE = new Set(["NL", "GB", "CZ"]);
const EV_PLN = { home: 1.1, fast: 2.8 };

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
    chartCaption: (date) => `Średnie ceny krajowe z cotygodniowego biuletynu naftowego Komisji Europejskiej, przeliczone na złote po kursie z danego tygodnia. Ostatni tydzień: ${date}.`,
    chartAria: (names) => `Wykres cen: ${names}`,
    euAverage: "średnia UE",
    indexTitle: "Poradniki: ceny paliw i koszt przejazdu | Tankful",
    indexHeading: "Poradniki",
    indexDescription: "Aktualne ceny paliw w Europie, tankowanie przed granicą, koszt 100 km i podział kosztów przejazdu – poradniki z danymi odświeżanymi kilka razy dziennie.",
    indexLead: "Konkretne liczby zamiast ogólników. Ceny w poradnikach odświeżają się same, razem z kalkulatorem.",
    updated: (d) => `Ceny z ${d}`,
    published: (d) => `Opublikowano ${d}`,
    photo: (author, url) => `Fot. <a href="${url}" rel="noopener">${author}</a> / Unsplash`,
    cta: "Policz swoją trasę",
    ctaText: "Wpisz skąd i dokąd jedziesz – kalkulator poda koszt paliwa z aktualnymi cenami w każdym kraju na trasie.",
    ctaButton: "Otwórz kalkulator",
    more: "Inne poradniki",
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
    chartCaption: (date) => `National average prices from the European Commission's Weekly Oil Bulletin, in euro. Latest week: ${date}.`,
    chartAria: (names) => `Price chart: ${names}`,
    euAverage: "EU average",
    indexTitle: "Guides: fuel prices and trip costs | Tankful",
    indexHeading: "Guides",
    indexDescription: "Current fuel prices across Europe, filling up before a border, the cost of 100 km and splitting trip costs – guides with data refreshed several times a day.",
    indexLead: "Numbers, not generalities. Prices in these guides update themselves, together with the calculator.",
    updated: (d) => `Prices from ${d}`,
    published: (d) => `Published ${d}`,
    photo: (author, url) => `Photo: <a href="${url}" rel="noopener">${author}</a> on Unsplash`,
    cta: "Cost your own trip",
    ctaText: "Enter where you're driving from and to – the calculator works out the fuel cost with current prices in every country on the way.",
    ctaButton: "Open the calculator",
    more: "More guides",
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
  },
};

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

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
  const inCountry = (cc) => (lang === "pl" ? PL_IN[cc] : `in ${EN_THE.has(cc) ? "the " : ""}${name(cc)}`);
  const date = (iso) => new Intl.DateTimeFormat(INTL[lang], { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(iso));
  const fuelName = (f) => FUELS[lang][f];
  const ev = (key) => toCur(EV_PLN[key]);

  const routeBySlug = (slug) => {
    const r = ROUTES.find((x) => x.pl === slug || x.en === slug);
    if (!r) throw new Error(`Unknown route ${slug}`);
    return r;
  };
  const cityName = (key) => CITIES[key][lang];
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
      return table([`${t.country} – ${lang === "pl" ? "paliwo" : "fuel"}`, esc(name(home)), lang === "pl" ? "Sąsiad" : "Neighbour", t.diff, t.cheaper, t.tank(50)], rows, [1, 2, 3, 5]);
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
      return table([lang === "pl" ? "Napęd" : "Fuel", t.consumption, ...ccs.map((cc) => esc(name(cc)))], rows, ccs.map((_, i) => i + 2));
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
        return [`<a href="${lang === "pl" ? `trasa/${r.pl}` : `route/${r.en}`}">${esc(cityName(r.from))} – ${esc(cityName(r.to))}</a>`, `${num(r.km)} ${t.km}`, cost("pb", 7), cost("on", 6), cost("lpg", 9)];
      });
      return table([lang === "pl" ? "Trasa" : "Route", t.km, `${cap(fuelName("pb"))} 7 l`, `${cap(fuelName("on"))} 6 l`, "LPG 9 l"], rows, [1, 2, 3, 4]);
    },
  };

  blocks.consumption = () => {
    const avg = (fuel) => {
      if (lang === "pl") return pln("PL", fuel);
      const list = EU.map((cc) => pln(cc, fuel)).filter(Boolean);
      return list.reduce((a, b) => a + b, 0) / list.length;
    };
    const fuels = ["pb", "on", "lpg"];
    const priceOf = Object.fromEntries(fuels.map((f) => [f, Math.round(toCur(avg(f)) * 100) / 100]));
    const home = lang === "pl" ? "./" : "en";
    const options = fuels.map((f) => `<option value="${f}">${esc(cap(fuelName(f)))}</option>`).join("");
    return `<form class="calc" data-prices="${esc(JSON.stringify(priceOf))}" data-currency="${currency}" data-locale="${INTL[lang]}" data-home="${home}">
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
<figcaption>${esc(t.chartCaption(date(history.dates[lastIndex(history.prices.PL.pb)])))}</figcaption>
</figure>`;
  };

  return { inline, blocks };
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
  mileage: '<path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/>',
  croatia: '<circle cx="12" cy="8" r="3.5"/><path d="M12 1.5v1M5.6 4.1l.7.7M18.4 4.1l-.7.7M3 9h1M20 9h1M2 16c2 0 3-1.5 5-1.5s3 1.5 5 1.5 3-1.5 5-1.5 3 1.5 5 1.5M2 21c2 0 3-1.5 5-1.5s3 1.5 5 1.5 3-1.5 5-1.5 3 1.5 5 1.5"/>',
};
const icon = (id, cls = "icon") => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${ICONS[id] || ICONS["per-100-km"]}</svg>`;
const GAUGE = `<svg class="hero-gauge" viewBox="0 0 128 128" aria-hidden="true"><path d="M31.1 91 A38 38 0 1 1 96.9 91" fill="none" stroke="#F2A516" stroke-width="9" stroke-linecap="round"/><path d="M31.1 91 A38 38 0 1 1 96.9 91" fill="none" stroke="#FAF7F0" stroke-width="1" stroke-dasharray="1 7.95" transform="translate(64 64) scale(1.32) translate(-64 -64)"/><line x1="64" y1="74" x2="87" y2="51" stroke="#FAF7F0" stroke-width="6" stroke-linecap="round"/><circle cx="64" cy="74" r="7" fill="#FAF7F0"/></svg>`;

const CHART_SCRIPTS = `    <script src="chart.umd.min.js" defer></script>
    <script src="guides-charts.js" defer></script>
`;

const CALC_SCRIPT = `    <script src="guides-consumption.js" defer></script>
`;

function layout({ lang, title, description, url, alternates, css, schema, hero, main, other }) {
  const charts = main.includes('class="chart"');
  const calc = main.includes('class="calc"');
  const t = TEXT[lang];
  const home = lang === "pl" ? "./" : "en";
  return `<!doctype html>
<html lang="${lang}">
  <head>
    <meta charset="UTF-8" />
    <base href="../" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <link rel="icon" type="image/svg+xml" href="icon.svg" />
    <link rel="apple-touch-icon" href="apple-touch-icon.png" />
    <meta name="theme-color" content="#1B2430" />
    <link rel="stylesheet" href="${css}" />
    <link rel="stylesheet" href="guides.css" />
    <script src="guides-analytics.js" defer></script>
${charts ? CHART_SCRIPTS : ""}${calc ? CALC_SCRIPT : ""}    <link rel="canonical" href="${url}" />
${alternates.map((l) => `    ${l}`).join("\n")}
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="Tankful" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${schema.image}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:locale" content="${lang === "pl" ? "pl_PL" : "en_GB"}" />
    <meta name="twitter:card" content="summary_large_image" />
    <script type="application/ld+json">${JSON.stringify(schema.data).replace(/</g, "\\u003c")}</script>
    <meta name="color-scheme" content="light" />
  </head>
  <body>
    <header class="site-header">
      <div class="bar">
        <a class="brand" href="${home}"><img src="icon.svg" alt="" width="28" height="28" />Tankful</a>
        <nav aria-label="${lang === "pl" ? "Menu" : "Menu"}">
          <a href="${home}">${t.home}</a>
          <a href="${DIRS[lang]}/">${t.guides}</a>
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

function buildGuides({ site, siteUrl, data, history, alternates }) {
  const guides = loadGuides();
  const css = stylesheet(site);
  fs.copyFileSync(path.join(GUIDES, "guides.css"), path.join(site, "guides.css"));
  fs.copyFileSync(path.join(GUIDES, "charts.js"), path.join(site, "guides-charts.js"));
  fs.copyFileSync(path.join(GUIDES, "analytics.js"), path.join(site, "guides-analytics.js"));
  fs.copyFileSync(path.join(GUIDES, "consumption.js"), path.join(site, "guides-consumption.js"));
  fs.mkdirSync(path.join(site, "data/history"), { recursive: true });
  for (const [cc, fuels] of Object.entries(history.prices)) {
    fs.writeFileSync(path.join(site, "data/history", `${cc}.json`), JSON.stringify({ dates: history.dates, plnPerEur: history.plnPerEur, ...fuels }));
  }
  fs.cpSync(path.join(GUIDES, "img"), path.join(site, "img/guides"), { recursive: true });
  for (const g of guides.pl) if (!PHOTOS[g.photo] || !fs.existsSync(path.join(GUIDES, "img", `${g.photo}.webp`))) throw new Error(`Missing photo for guide "${g.id}"`);
  const photoUrl = (id) => `${siteUrl}img/guides/${id}.jpg`;
  const url = (lang, slug) => `${siteUrl}${DIRS[lang]}/${slug ?? ""}`;
  const href = (lang, slug) => `${DIRS[lang]}/${slug ?? ""}`;
  const groups = [];
  const updated = data.euPrices.date;

  for (const lang of Object.keys(DIRS)) fs.mkdirSync(path.join(site, DIRS[lang]), { recursive: true });

  const indexGroup = Object.keys(DIRS).map((lang) => ({ lang, url: url(lang) }));
  groups.push(indexGroup);
  for (const lang of Object.keys(DIRS)) {
    const t = TEXT[lang];
    const other = lang === "pl" ? "en" : "pl";
    const list = guides[lang]
      .map((g) => `        <li><a href="${href(lang, g.slug)}"><div class="card-media"><img class="card-photo" src="img/guides/${g.photo}.webp" width="1400" height="735" alt="" loading="lazy" />${icon(g.id, "tile")}</div><div class="card-body"><strong>${esc(g.heading)}</strong><span>${esc(g.description)}</span></div></a></li>`)
      .join("\n");
    const hero = `        <h1>${t.indexHeading}</h1>
        <p class="lead">${esc(t.indexLead)}</p>`;
    const main = `      <ul class="guide-list">
${list}
      </ul>`;
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

  for (const id of guides.pl.map((g) => g.id)) {
    const pair = Object.keys(DIRS).map((lang) => guides[lang].find((g) => g.id === id));
    const group = pair.map((g) => ({ lang: g.lang, url: url(g.lang, g.slug) }));
    groups.push(group);
    for (const g of pair) {
      const t = TEXT[g.lang];
      const ctx = context(g.lang, data, history);
      const other = pair.find((p) => p !== g);
      const date = (iso) => new Intl.DateTimeFormat(INTL[g.lang], { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(iso));
      const more = guides[g.lang]
        .filter((x) => x.id !== id)
        .map((x) => `          <li><a href="${href(g.lang, x.slug)}">${esc(x.heading)}</a></li>`)
        .join("\n");
      const home = g.lang === "pl" ? "./" : "en";
      const hero = `        <nav class="crumbs" aria-label="${g.lang === "pl" ? "Ścieżka" : "Breadcrumb"}"><a href="${home}">Tankful</a> / <a href="${href(g.lang)}">${t.guides}</a></nav>
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
        <ul>
${more}
        </ul>
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
          dateModified: updated,
          image: photoUrl(g.photo),
          author: { "@type": "Person", name: "Michał Goryński" },
          publisher: { "@type": "Organization", name: "Tankful", url: siteUrl, logo: `${siteUrl}app-512.png` },
          isPartOf: { "@type": "WebSite", name: "Tankful", url: siteUrl },
        },
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Tankful", item: `${siteUrl}${g.lang === "pl" ? "" : "en"}` },
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
          other: { lang: other.lang, href: href(other.lang, other.slug) },
        })
      );
    }
  }
  console.log(`Guides: ${guides.pl.length} × ${Object.keys(DIRS).length} languages`);
  return groups;
}

module.exports = { buildGuides, loadGuides, context, markdown };
