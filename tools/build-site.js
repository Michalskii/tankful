const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PUBLIC = path.join(ROOT, "site/public");
const args = process.argv.slice(2);
const prices = args.find((a) => !a.startsWith("--"));

fs.mkdirSync(PUBLIC, { recursive: true });
for (const f of ["settings.js", "borders.js"]) fs.copyFileSync(path.join(ROOT, f), path.join(PUBLIC, f));
fs.copyFileSync(path.join(ROOT, "icons/icon.svg"), path.join(PUBLIC, "icon.svg"));
fs.copyFileSync(path.join(ROOT, "docs/privacy.html"), path.join(PUBLIC, "privacy.html"));
if (prices) fs.copyFileSync(prices, path.join(PUBLIC, "prices.json"));

const messages = {};
for (const lang of fs.readdirSync(path.join(ROOT, "_locales"))) {
  messages[lang] = JSON.parse(fs.readFileSync(path.join(ROOT, "_locales", lang, "messages.json"), "utf8"));
}
fs.writeFileSync(path.join(PUBLIC, "messages.js"), `const MAPKA_MESSAGES = ${JSON.stringify(messages)};\n`);

if (!args.includes("--no-build")) {
  execSync("npm run build", { cwd: path.join(ROOT, "site"), stdio: "inherit" });
  console.log(`_site/: ${fs.readdirSync(path.join(ROOT, "_site")).length} plików`);
}
