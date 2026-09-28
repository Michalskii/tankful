const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const EU_COUNTRIES = fs.readFileSync(path.join(ROOT, "background.js"), "utf8").match(/const EU_NAMES = {([^}]*)}/)[1].match(/"[A-Z]{2}"/g).map((c) => c.slice(1, 3));
const COUNTRIES = new Set([...EU_COUNTRIES, "GB"]);
const BBOX = { minLng: -25, maxLng: 45, minLat: 34, maxLat: 72 };
const MIN_EXTENT = 15;
const SCALE = 100;
const TOLERANCE = 2;

function simplify(points, tol) {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = points[a];
    const [bx, by] = points[b];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    let max = 0;
    let idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((bx - ax) * (ay - points[i][1]) - (ax - points[i][0]) * (by - ay)) / len;
      if (d > max) (max = d), (idx = i);
    }
    if (max > tol) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

function ring(coords) {
  const pts = [];
  for (const [lng, lat] of coords) {
    const p = [Math.round(lng * SCALE), Math.round(lat * SCALE)];
    const last = pts[pts.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) pts.push(p);
  }
  let far = 0;
  pts.forEach((p, i) => {
    if (Math.hypot(p[0] - pts[0][0], p[1] - pts[0][1]) > Math.hypot(pts[far][0] - pts[0][0], pts[far][1] - pts[0][1])) far = i;
  });
  const out = [...simplify(pts.slice(0, far + 1), TOLERANCE), ...simplify(pts.slice(far), TOLERANCE).slice(1)];
  const xs = out.map((p) => p[0]);
  const ys = out.map((p) => p[1]);
  const extent = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  return out.length >= 4 && extent >= MIN_EXTENT ? out.flat() : null;
}

function inBbox(coords) {
  return coords.some(([lng, lat]) => lng >= BBOX.minLng && lng <= BBOX.maxLng && lat >= BBOX.minLat && lat <= BBOX.maxLat);
}

const src = process.argv[2];
if (!src) throw new Error("Pass the path to ne_50m_admin_0_countries.geojson");
const { features } = JSON.parse(fs.readFileSync(src, "utf8"));
const borders = {};
for (const f of features) {
  const cc = f.properties.ISO_A2_EH;
  if (!COUNTRIES.has(cc)) continue;
  const polygons = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  const rings = polygons
    .filter((p) => inBbox(p[0]))
    .flatMap((p) => p.map(ring))
    .filter(Boolean);
  if (rings.length) borders[cc] = (borders[cc] || []).concat(rings);
}

const body = Object.keys(borders)
  .sort()
  .map((cc) => `  ${cc}: ${JSON.stringify(borders[cc])},`)
  .join("\n");
fs.writeFileSync(
  path.join(ROOT, "borders.js"),
  `const MAPKA_BORDERS = {\n${body}\n};\n`
);
console.log(`borders.js: ${Object.keys(borders).length} countries, ${fs.statSync(path.join(ROOT, "borders.js")).size} B`);
