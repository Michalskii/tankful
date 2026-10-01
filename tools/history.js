const zlib = require("zlib");

const HISTORY_URL = "https://energy.ec.europa.eu/document/download/906e60ca-8b6a-44e7-8589-652854d2fd3f_en";
const FUELS = { euro95: "pb", diesel: "on", LPG: "lpg" };
const COUNTRIES = ["EU", "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE"];

function unzip(buffer, names) {
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("EU price history: not a ZIP file");
  const out = {};
  let p = buffer.readUInt32LE(eocd + 16);
  const count = buffer.readUInt16LE(eocd + 10);
  for (let n = 0; n < count && buffer.readUInt32LE(p) === 0x02014b50; n++) {
    const method = buffer.readUInt16LE(p + 10);
    const size = buffer.readUInt32LE(p + 20);
    const nameLen = buffer.readUInt16LE(p + 28);
    const extraLen = buffer.readUInt16LE(p + 30);
    const commentLen = buffer.readUInt16LE(p + 32);
    const offset = buffer.readUInt32LE(p + 42);
    const name = buffer.toString("utf8", p + 46, p + 46 + nameLen);
    if (names.includes(name)) {
      const start = offset + 30 + buffer.readUInt16LE(offset + 26) + buffer.readUInt16LE(offset + 28);
      const raw = buffer.subarray(start, start + size);
      out[name] = (method === 0 ? raw : zlib.inflateRawSync(raw)).toString("utf8");
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

const xmlText = (s) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

function parseHistory(sharedStrings, sheet) {
  const strings = [...sharedStrings.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    xmlText([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("")).trim()
  );
  const columns = {};
  const weeks = [];
  for (const row of sheet.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = {};
    for (const c of row[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const v = c[3]?.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      if (v == null) continue;
      cells[c[1]] = /t="s"/.test(c[2]) ? strings[+v] : parseFloat(v);
    }
    if (!Object.keys(columns).length) {
      for (const [col, label] of Object.entries(cells)) {
        const m = typeof label === "string" && label.match(/^([A-Z]{2})_(?:price_with_tax_(euro95|diesel|LPG)|(exchange_rate))$/);
        if (m && COUNTRIES.includes(m[1])) columns[col] = { cc: m[1], key: m[3] ? "rate" : FUELS[m[2]] };
      }
      continue;
    }
    if (typeof cells.A !== "number" || cells.A < 30000) continue;
    const date = new Date(Date.UTC(1899, 11, 30) + Math.round(cells.A) * 86400000).toISOString().slice(0, 10);
    weeks.push({ date, cells });
  }
  if (!weeks.length || !Object.keys(columns).length) throw new Error("EU price history: no data");
  weeks.sort((a, b) => a.date.localeCompare(b.date));

  const dates = weeks.map((w) => w.date);
  const prices = {};
  let plnPerEur = null;
  for (const [col, { cc, key }] of Object.entries(columns)) {
    const values = weeks.map((w) => (typeof w.cells[col] === "number" && w.cells[col] > 0 ? w.cells[col] : null));
    if (key === "rate") {
      if (cc === "PL") plnPerEur = values.map((v) => (v ? +(1 / v).toFixed(4) : null));
      continue;
    }
    (prices[cc] ||= {})[key] = values.map((v) => (v == null ? null : +(v / 1000).toFixed(3)));
  }
  if (!prices.PL || !plnPerEur) throw new Error("EU price history: no data for Poland");
  return { dates, plnPerEur, prices };
}

async function fetchHistory() {
  const res = await fetch(HISTORY_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`EU price history: HTTP ${res.status}`);
  const files = unzip(Buffer.from(await res.arrayBuffer()), ["xl/sharedStrings.xml", "xl/worksheets/sheet1.xml"]);
  if (!files["xl/worksheets/sheet1.xml"]) throw new Error("EU price history: no price sheet");
  return parseHistory(files["xl/sharedStrings.xml"] || "", files["xl/worksheets/sheet1.xml"]);
}

module.exports = { fetchHistory, parseHistory, unzip };
