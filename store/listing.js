const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const LANGS = [
  ["en", "English"],
  ["pl", "Polski"],
  ["de", "Deutsch"],
  ["fr", "Français"],
  ["it", "Italiano"],
  ["es", "Español"],
  ["nl", "Nederlands"],
  ["cs", "Čeština"],
  ["ro", "Română"],
  ["pt_PT", "Português (Portugal)"],
  ["sv", "Svenska"],
  ["el", "Ελληνικά"],
  ["hu", "Magyar"],
  ["bg", "Български"],
  ["da", "Dansk"],
  ["fi", "Suomi"],
];
const STORE_NAMES = {
  en: "English",
  pl: "Polish",
  de: "German",
  fr: "French",
  it: "Italian",
  es: "Spanish",
  nl: "Dutch",
  cs: "Czech",
  ro: "Romanian",
  pt_PT: "Portuguese (Portugal)",
  sv: "Swedish",
  el: "Greek",
  hu: "Hungarian",
  bg: "Bulgarian",
  da: "Danish",
  fi: "Finnish",
};
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const entries = LANGS.map(([code, label]) => {
  const messages = JSON.parse(fs.readFileSync(path.join(ROOT, "_locales", code, "messages.json"), "utf8"));
  const description = fs.readFileSync(path.join(__dirname, "descriptions", `${code}.txt`), "utf8").trim();
  return { code, label, name: messages.appName.message, summary: messages.appDescription.message, description };
});

const field = (id, label, value, note) => `
      <div class="field">
        <div class="field-head">
          <label for="${id}">${label}</label>
          <span class="count">${value.length} zn.${note ? ` · ${note}` : ""}</span>
          <button type="button" data-copy="${id}">Kopiuj</button>
        </div>
        <textarea id="${id}" readonly rows="${Math.min(40, value.split("\n").length + 1)}">${esc(value)}</textarea>
      </div>`;

const html = `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tankful – opisy do Chrome Web Store</title>
<style>
  :root { --ink: #1b2430; --amber: #f2a516; --muted: #6b7280; --border: #e5e7eb; --bg: #faf7f0; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 15px/1.5 system-ui, sans-serif; color: var(--ink); background: var(--bg); }
  header { position: sticky; top: 0; z-index: 1; padding: 16px 24px 0; background: var(--ink); color: #faf7f0; }
  h1 { margin: 0 0 4px; font-size: 18px; }
  header p { margin: 0 0 12px; font-size: 13px; color: #b8c0cb; }
  nav { display: flex; gap: 4px; overflow-x: auto; }
  nav button { flex-shrink: 0; padding: 8px 14px; border: 0; border-radius: 8px 8px 0 0; background: transparent; color: #b8c0cb; font: inherit; cursor: pointer; }
  nav button[aria-selected="true"] { background: var(--bg); color: var(--ink); font-weight: 600; }
  main { max-width: 960px; margin: 0 auto; padding: 24px; }
  .lang { display: none; }
  .lang.active { display: block; }
  .store-lang { margin: 0 0 16px; color: var(--muted); }
  .store-lang b { color: var(--ink); }
  .field { margin-bottom: 20px; }
  .field-head { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
  .field-head label { font-weight: 600; }
  .count { margin-right: auto; font-size: 12px; color: var(--muted); }
  textarea { width: 100%; padding: 12px; border: 1px solid var(--border); border-radius: 10px; background: #fff; color: var(--ink); font: 14px/1.5 ui-monospace, Consolas, monospace; resize: vertical; }
  button[data-copy] { padding: 6px 14px; border: 0; border-radius: 8px; background: var(--amber); color: var(--ink); font: inherit; font-weight: 600; cursor: pointer; }
  button[data-copy].done { background: #34a853; color: #fff; }
  .hint { padding: 12px 16px; border-left: 3px solid var(--amber); border-radius: 0 8px 8px 0; background: #fdf1d8; font-size: 14px; }
</style>
</head>
<body>
<header>
  <h1>Tankful – opisy do Chrome Web Store</h1>
  <p>Wygenerowane z <code>store/descriptions/*.txt</code> i <code>_locales</code>. Po zmianie tekstów: <code>node store/listing.js</code>.</p>
  <nav role="tablist">${entries.map((e, i) => `<button role="tab" type="button" data-lang="${e.code}" aria-selected="${i === 0}">${esc(e.label)}</button>`).join("")}</nav>
</header>
<main>
${entries
  .map(
    (e, i) => `  <section class="lang${i === 0 ? " active" : ""}" id="lang-${e.code}">
    <p class="store-lang">Język w panelu sklepu: <b>${STORE_NAMES[e.code]}</b></p>
    <p class="hint">Nazwę i krótki opis sklep bierze z manifestu wtyczki – tu są tylko do wglądu. Do panelu wklejasz <b>pełny opis</b>.</p>${field(`desc-${e.code}`, "Pełny opis (Description)", e.description, "limit 16 000")}${field(`name-${e.code}`, "Nazwa (z manifestu)", e.name, "limit 75")}${field(`summary-${e.code}`, "Krótki opis (z manifestu)", e.summary, "limit 132")}
  </section>`
  )
  .join("\n")}
</main>
<script>
  const tabs = document.querySelectorAll("nav button");
  const show = (code) => {
    for (const t of tabs) t.setAttribute("aria-selected", String(t.dataset.lang === code));
    for (const s of document.querySelectorAll(".lang")) s.classList.toggle("active", s.id === "lang-" + code);
    try { localStorage.setItem("tankful-listing-lang", code); } catch {}
  };
  for (const t of tabs) t.addEventListener("click", () => show(t.dataset.lang));
  try { const saved = localStorage.getItem("tankful-listing-lang"); if (saved && document.getElementById("lang-" + saved)) show(saved); } catch {}
  for (const b of document.querySelectorAll("[data-copy]")) {
    b.addEventListener("click", async () => {
      const area = document.getElementById(b.dataset.copy);
      try {
        await navigator.clipboard.writeText(area.value);
      } catch {
        area.select();
        document.execCommand("copy");
      }
      b.textContent = "Skopiowano ✓";
      b.classList.add("done");
      setTimeout(() => { b.textContent = "Kopiuj"; b.classList.remove("done"); }, 1500);
    });
  }
</script>
</body>
</html>
`;

fs.writeFileSync(path.join(__dirname, "listing.html"), html);
console.log(`store/listing.html: ${entries.map((e) => `${e.code} ${e.description.length}`).join(", ")}`);
