const { execSync } = require("child_process");
const fs = require("fs");
const http = require("http");
const path = require("path");
const vm = require("vm");
const { dumpDom } = require("./chrome");
const { buildGuides } = require("./guides");

const ROOT = path.join(__dirname, "..");
const PUBLIC = path.join(ROOT, "site/public");
const SITE = path.join(ROOT, "_site");
const args = process.argv.slice(2);
const SITE_ID = args.find((a) => a.startsWith("--site="))?.slice("--site=".length) || "pl";
const SITE_URLS = { pl: "https://koszt-paliwa.pl/", de: "https://spritkosten-europa.de/" };
const LANG_SITE = { pl: "pl", en: "pl", de: "de" };
if (!SITE_URLS[SITE_ID]) throw new Error(`Unknown site ${SITE_ID}`);
const SITE_URL = SITE_URLS[SITE_ID];
const BRAND_COLOR = "#1B2430";
const APP_ICONS = ["app-192.png", "app-512.png", "app-maskable-512.png", "apple-touch-icon.png"];
const LANGS = {
  pl: { locale: "pl_PL", timeZone: "Europe/Warsaw" },
  en: { locale: "en_GB", timeZone: "Europe/Berlin" },
  de: { locale: "de_DE", timeZone: "Europe/Berlin" },
};
const SITE_LANGS = Object.keys(LANGS).filter((lang) => LANG_SITE[lang] === SITE_ID);
const { cities: CITIES, routes: ROUTES } = JSON.parse(fs.readFileSync(path.join(ROOT, "site/src/lib/routes.json"), "utf8"));

function page(lang, rel, file, route = null) {
  return { lang, ...LANGS[lang], file, url: `${SITE_URLS[LANG_SITE[lang]]}${rel}`, path: `/${rel}`, route, local: LANG_SITE[lang] === SITE_ID };
}

const GROUPS = [
  [page("pl", "", "index.html"), page("en", "en", "en.html"), page("de", "", "index.html")],
  ...ROUTES.map((r) => [
    ...(r.deOnly ? [] : [page("pl", `trasa/${r.pl}`, `trasa/${r.pl}.html`, r), page("en", `route/${r.en}`, `route/${r.en}.html`, r)]),
    ...(r.de ? [page("de", `strecke/${r.de}`, `strecke/${r.de}.html`, r.deFlip ? { ...r, from: r.to, to: r.from } : r)] : []),
  ]),
];
for (const group of GROUPS) for (const p of group) p.group = group;
const PAGES = GROUPS.flat().filter((p) => p.local);
const prices = args.find((a) => !a.startsWith("--"));
const history = args.find((a) => a.startsWith("--history="))?.slice("--history=".length);

fs.mkdirSync(PUBLIC, { recursive: true });
for (const f of ["settings.js", "borders.js"]) fs.copyFileSync(path.join(ROOT, f), path.join(PUBLIC, f));
for (const f of ["icon.svg", ...APP_ICONS]) fs.copyFileSync(path.join(ROOT, "icons", f), path.join(PUBLIC, f));
fs.copyFileSync(path.join(ROOT, "docs/privacy.html"), path.join(PUBLIC, "privacy.html"));
if (prices) fs.copyFileSync(prices, path.join(PUBLIC, "prices.json"));
if (history) fs.copyFileSync(history, path.join(PUBLIC, "history.json"));
fs.copyFileSync(path.join(ROOT, "site/node_modules/chart.js/dist/chart.umd.min.js"), path.join(PUBLIC, "chart.umd.min.js"));

const messages = {};
for (const lang of Object.keys(LANGS)) {
  messages[lang] = JSON.parse(fs.readFileSync(path.join(ROOT, "_locales", lang, "messages.json"), "utf8"));
}
fs.writeFileSync(path.join(PUBLIC, "messages.js"), `const MAPKA_MESSAGES = ${JSON.stringify(messages)};\n`);

function siteStrings() {
  const code = fs
    .readFileSync(path.join(ROOT, "site/src/lib/strings.ts"), "utf8")
    .replace(/^export /gm, "")
    .split("\ntype Key")[0];
  return vm.runInNewContext(`${code}; SITE_STRINGS`);
}

const fill = (text, ...subs) => text.replace(/\$(\d)/g, (_, n) => String(subs[n - 1] ?? ""));

function manifest(lang, strings) {
  const s = strings[lang];
  return {
    id: "./",
    name: "Tankful",
    short_name: "Tankful",
    description: s.description,
    lang,
    start_url: lang === "en" ? "./en" : "./",
    scope: "./",
    display: "standalone",
    background_color: BRAND_COLOR,
    theme_color: BRAND_COLOR,
    categories: ["travel", "navigation", "utilities"],
    icons: [
      { src: "app-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "app-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "app-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

function pageStrings(page, strings) {
  const s = strings[page.lang];
  if (!page.route) return s;
  const names = [CITIES[page.route.from][page.lang], CITIES[page.route.to][page.lang]];
  const km = new Intl.NumberFormat(page.lang, { maximumFractionDigits: 0 }).format(page.route.km);
  return {
    title: fill(s.routeTitle, ...names),
    description: fill(s.routeDescription, ...names, km),
    heading: fill(s.routeHeading, ...names),
  };
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function alternates(group, tag = "link") {
  const fallback = group.find((p) => p.lang === "en") || group[0];
  return [
    ...group.map((p) => `<${tag} rel="alternate" hreflang="${p.lang}" href="${p.url}" />`),
    `<${tag} rel="alternate" hreflang="x-default" href="${fallback.url}" />`,
  ];
}

function headTags(page, s) {
  const image = `${SITE_URL}og-${page.lang}.png`;
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Tankful",
    alternateName: s.title,
    url: page.url,
    description: s.description,
    inLanguage: page.lang,
    applicationCategory: "TravelApplication",
    operatingSystem: "Any",
    browserRequirements: "Requires JavaScript",
    isAccessibleForFree: true,
    image,
    offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
  };
  return [
    `<link rel="manifest" href="manifest-${page.lang}.webmanifest" />`,
    `<link rel="canonical" href="${page.url}" />`,
    ...alternates(page.group),
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="Tankful" />`,
    `<meta property="og:title" content="${esc(s.title)}" />`,
    `<meta property="og:description" content="${esc(s.description)}" />`,
    `<meta property="og:url" content="${page.url}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${esc(s.heading)}" />`,
    `<meta property="og:locale" content="${page.locale}" />`,
    ...page.group.filter((p) => p !== page).map((p) => `<meta property="og:locale:alternate" content="${p.locale}" />`),
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<script type="application/ld+json">${JSON.stringify(schema).replace(/</g, "\\u003c")}</script>`,
  ]
    .map((line) => `    ${line}`)
    .join("\n");
}

function pageHtml(template, page, strings, prices) {
  const s = pageStrings(page, strings);
  const pricesTag = `    <script>window.MAPKA_PRICES = ${JSON.stringify(prices).replace(/</g, "\\u003c")}</script>`;
  let html = template
    .replace(/<html lang="[^"]*">/, `<html lang="${page.lang}" data-lang="${page.lang}">`)
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(s.title)}</title>`)
    .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${esc(s.description)}" />`)
    .replace("</head>", `${headTags(page, s)}\n${pricesTag}\n  </head>`);
  if (page.route) html = html.replace('<meta charset="UTF-8" />', '<meta charset="UTF-8" />\n    <base href="../" />');
  if (!html.includes(`<title>${esc(s.title)}</title>`) || !html.includes(esc(s.description))) {
    throw new Error(`${page.file}: could not replace the title or description in index.html`);
  }
  if (page.route && !html.includes('<base href="../" />')) throw new Error(`${page.file}: missing <base>`);
  return html;
}

function serve(dir) {
  const types = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json",
    ".webmanifest": "application/manifest+json",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".woff2": "font/woff2",
  };
  const server = http.createServer((req, res) => {
    let rel = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    if (rel.endsWith("/")) rel += "index.html";
    let file = path.join(dir, rel);
    if (!fs.existsSync(file) && fs.existsSync(`${file}.html`)) file += ".html";
    if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

async function prerender(pages, strings) {
  const server = await serve(SITE);
  const { port } = server.address();
  const queue = [...pages];
  const worker = async () => {
    for (let page = queue.shift(); page; page = queue.shift()) {
      const dom = await dumpDom(`http://127.0.0.1:${port}${page.path}?prerender=1`, { timeZone: page.timeZone });
      const match = dom.match(/<div id="root">([\s\S]*?)<\/div>\s*<script src="messages\.js">/);
      const heading = esc(pageStrings(page, strings).heading);
      if (!match || !match[1].includes(heading)) throw new Error(`${page.file}: the rendered page has no heading "${heading}"`);
      if (page.route && !match[1].includes("<table")) throw new Error(`${page.file}: the rendered page has no cost table`);
      const file = path.join(SITE, page.file);
      const html = fs.readFileSync(file, "utf8").replace('<div id="root"></div>', `<div id="root">${match[1]}</div>`);
      fs.writeFileSync(file, html);
      if (!page.route) console.log(`${page.file}: prerendered (${Math.round(match[1].length / 1024)} KB of content)`);
    }
  };
  try {
    await Promise.all(Array.from({ length: 4 }, worker));
    console.log(`Route pages: ${pages.filter((p) => p.route).length} prerendered`);
  } finally {
    server.close();
  }
}

function sitemap(extra = []) {
  const date = new Date().toISOString().slice(0, 10);
  const urls = [...PAGES, ...extra.flatMap((group) => group.filter((p) => p.local).map((p) => ({ ...p, group })))].map((p) => {
    const links = alternates(p.group, "xhtml:link").map((line) => `    ${line}`).join("\n");
    return `  <url>\n    <loc>${p.url}</loc>\n    <lastmod>${date}</lastmod>\n${links}\n  </url>`;
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`;
}

async function main() {
  if (args.includes("--no-build")) return;
  execSync("npm run build", { cwd: path.join(ROOT, "site"), stdio: "inherit" });

  const strings = siteStrings();
  const template = fs.readFileSync(path.join(SITE, "index.html"), "utf8");
  for (const dir of SITE_ID === "pl" ? ["trasa", "route"] : ["strecke"]) fs.mkdirSync(path.join(SITE, dir), { recursive: true });
  const data = JSON.parse(fs.readFileSync(path.join(PUBLIC, "prices.json"), "utf8"));
  for (const page of PAGES) fs.writeFileSync(path.join(SITE, page.file), pageHtml(template, page, strings, data));
  const historyData = JSON.parse(fs.readFileSync(path.join(PUBLIC, "history.json"), "utf8"));
  const guides = buildGuides({ site: SITE, siteUrl: SITE_URL, siteUrls: SITE_URLS, langSite: LANG_SITE, siteId: SITE_ID, data, history: historyData, alternates });
  fs.writeFileSync(path.join(SITE, "sitemap.xml"), sitemap(guides));
  fs.writeFileSync(path.join(SITE, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}sitemap.xml\n`);
  for (const lang of SITE_LANGS) {
    fs.writeFileSync(path.join(SITE, `manifest-${lang}.webmanifest`), JSON.stringify(manifest(lang, strings), null, 2) + "\n");
  }

  if (args.includes("--no-prerender")) {
    console.log("Prerendering skipped (--no-prerender)");
  } else {
    try {
      await prerender(PAGES, strings);
    } catch (e) {
      if (process.env.CI) throw e;
      console.warn(`Prerendering skipped: ${e.message}`);
    }
  }
  console.log(`_site/: ${PAGES.length + guides.flat().length} pages`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
