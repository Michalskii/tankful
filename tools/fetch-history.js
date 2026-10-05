const fs = require("fs");
const path = require("path");
const { fetchHistory } = require("./history");

const [out, previousUrl] = process.argv.slice(2);
if (!out) throw new Error("Pass the output file path");

async function previous() {
  if (!previousUrl) return null;
  try {
    const res = await fetch(previousUrl, { cache: "no-store" });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

(async () => {
  let history;
  try {
    history = await fetchHistory();
  } catch (e) {
    history = await previous();
    if (!history) {
      console.error(`missing data: EU price history (${e.message})`);
      process.exit(1);
    }
    const message = `${e.message} – using the previously published history`;
    console.warn(process.env.GITHUB_ACTIONS ? `::warning title=History::${message}` : `warning: ${message}`);
  }
  history.updatedAt = new Date().toISOString();
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(history));
  console.log(`${out}: ${history.dates.length} weeks (${history.dates[0]} – ${history.dates.at(-1)}), ${Object.keys(history.prices).length} countries`);
})();
