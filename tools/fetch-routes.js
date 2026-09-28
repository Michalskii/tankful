const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "site/src/lib/routes.json");
const OSRM_URL = "https://router.project-osrm.org/route/v1/driving/";

const CITIES = {
  warszawa: { pl: "Warszawa", en: "Warsaw", lat: 52.2297, lng: 21.0122, cc: "pl", region: "MZ" },
  krakow: { pl: "Kraków", en: "Kraków", lat: 50.0614, lng: 19.9372, cc: "pl", region: "MA" },
  gdansk: { pl: "Gdańsk", en: "Gdańsk", lat: 54.352, lng: 18.6466, cc: "pl", region: "PM" },
  wroclaw: { pl: "Wrocław", en: "Wrocław", lat: 51.1079, lng: 17.0385, cc: "pl", region: "DS" },
  poznan: { pl: "Poznań", en: "Poznań", lat: 52.4064, lng: 16.9252, cc: "pl", region: "WP" },
  lodz: { pl: "Łódź", en: "Łódź", lat: 51.7592, lng: 19.456, cc: "pl", region: "LD" },
  katowice: { pl: "Katowice", en: "Katowice", lat: 50.2649, lng: 19.0238, cc: "pl", region: "SL" },
  lublin: { pl: "Lublin", en: "Lublin", lat: 51.2465, lng: 22.5684, cc: "pl", region: "LU" },
  bialystok: { pl: "Białystok", en: "Białystok", lat: 53.1325, lng: 23.1688, cc: "pl", region: "PD" },
  szczecin: { pl: "Szczecin", en: "Szczecin", lat: 53.4285, lng: 14.5528, cc: "pl", region: "ZP" },
  rzeszow: { pl: "Rzeszów", en: "Rzeszów", lat: 50.0412, lng: 21.9991, cc: "pl", region: "PK" },
  zakopane: { pl: "Zakopane", en: "Zakopane", lat: 49.2992, lng: 19.9496, cc: "pl", region: "MA" },
  berlin: { pl: "Berlin", en: "Berlin", lat: 52.52, lng: 13.405, cc: "de" },
  monachium: { pl: "Monachium", en: "Munich", lat: 48.1351, lng: 11.582, cc: "de" },
  praga: { pl: "Praga", en: "Prague", lat: 50.0755, lng: 14.4378, cc: "cz" },
  wieden: { pl: "Wiedeń", en: "Vienna", lat: 48.2082, lng: 16.3738, cc: "at" },
  budapeszt: { pl: "Budapeszt", en: "Budapest", lat: 47.4979, lng: 19.0402, cc: "hu" },
  wilno: { pl: "Wilno", en: "Vilnius", lat: 54.6872, lng: 25.2797, cc: "lt" },
  split: { pl: "Split", en: "Split", lat: 43.5081, lng: 16.4402, cc: "hr" },
  paryz: { pl: "Paryż", en: "Paris", lat: 48.8566, lng: 2.3522, cc: "fr" },
  amsterdam: { pl: "Amsterdam", en: "Amsterdam", lat: 52.3676, lng: 4.9041, cc: "nl" },
};

const PAIRS = [
  ["warszawa", "krakow"], ["warszawa", "gdansk"], ["warszawa", "wroclaw"], ["warszawa", "poznan"],
  ["warszawa", "lodz"], ["warszawa", "katowice"], ["warszawa", "lublin"], ["warszawa", "bialystok"],
  ["warszawa", "szczecin"], ["warszawa", "rzeszow"], ["warszawa", "zakopane"], ["krakow", "gdansk"],
  ["krakow", "wroclaw"], ["krakow", "katowice"], ["krakow", "poznan"], ["krakow", "zakopane"],
  ["wroclaw", "poznan"], ["wroclaw", "gdansk"], ["poznan", "gdansk"], ["katowice", "gdansk"],
  ["lodz", "gdansk"], ["szczecin", "gdansk"],
  ["warszawa", "berlin"], ["warszawa", "praga"], ["warszawa", "wieden"], ["warszawa", "budapeszt"],
  ["warszawa", "wilno"], ["warszawa", "split"], ["warszawa", "paryz"], ["warszawa", "amsterdam"],
  ["krakow", "wieden"], ["krakow", "budapeszt"], ["krakow", "praga"], ["krakow", "split"],
  ["wroclaw", "berlin"], ["wroclaw", "praga"], ["wroclaw", "monachium"], ["poznan", "berlin"],
  ["szczecin", "berlin"], ["katowice", "wieden"],
];

const slug = (name) =>
  name
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-");

function decodePolyline(encoded, factor) {
  const points = [];
  let i = 0;
  let lat = 0;
  let lng = 0;
  const next = () => {
    let result = 0;
    let shift = 0;
    let byte;
    do {
      byte = encoded.charCodeAt(i++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (i < encoded.length) {
    lat += next();
    lng += next();
    points.push({ lat: lat / factor, lng: lng / factor });
  }
  return points;
}

function sparsePoints(points, km = 2) {
  const out = points.slice(0, 1);
  for (const p of points.slice(1)) {
    const last = out[out.length - 1];
    const dx = (p.lng - last.lng) * 111.32 * Math.cos((p.lat * Math.PI) / 180);
    const dy = (p.lat - last.lat) * 110.57;
    if (Math.hypot(dx, dy) >= km) out.push(p);
  }
  if (points.length > 1) out.push(points[points.length - 1]);
  return out;
}

const context = vm.createContext({ console, chrome: { i18n: { getUILanguage: () => "pl", getMessage: () => "" } } });
for (const f of ["settings.js", "borders.js"]) vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), context);

(async () => {
  const routes = [];
  for (const [a, b] of PAIRS) {
    const [from, to] = [CITIES[a], CITIES[b]];
    const res = await fetch(`${OSRM_URL}${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=polyline6`);
    const body = await res.json();
    if (body.code !== "Ok") throw new Error(`${a} → ${b}: ${body.code}`);
    const [route] = body.routes;
    const shares = context.mapkaRouteShares(sparsePoints(decodePolyline(route.geometry, 1e6)));
    routes.push({
      pl: `${slug(from.pl)}-${slug(to.pl)}`,
      en: `${slug(from.en)}-${slug(to.en)}`,
      from: a,
      to: b,
      km: Math.round(route.distance / 100) / 10,
      minutes: Math.round(route.duration / 60),
      shares: shares && Object.fromEntries(Object.entries(shares).map(([cc, s]) => [cc, Math.round(s * 1000) / 1000])),
    });
    console.log(`${routes.at(-1).pl}: ${routes.at(-1).km} km`);
    await new Promise((r) => setTimeout(r, 1000));
  }
  fs.writeFileSync(OUT, `${JSON.stringify({ cities: CITIES, routes }, null, 2)}\n`);
  console.log(`${path.relative(ROOT, OUT)}: ${routes.length} routes`);
})();
