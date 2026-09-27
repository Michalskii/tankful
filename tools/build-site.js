const { execSync } = require("child_process");
const fs = require("fs");
const http = require("http");
const path = require("path");
const vm = require("vm");
const { dumpDom } = require("./chrome");

const ROOT = path.join(__dirname, "..");
const PUBLIC = path.join(ROOT, "site/public");
const SITE = path.join(ROOT, "_site");
const SITE_URL = "https://michalskii.github.io/tankful/";
const PAGES = [
  { lang: "pl", file: "index.html", url: SITE_URL, path: "/", locale: "pl_PL", timeZone: "Europe/Warsaw" },
  { lang: "en", file: "en.html", url: `${SITE_URL}en`, path: "/en", locale: "en_GB", timeZone: "Europe/Berlin" },
];
const DEFAULT_PAGE = PAGES[1];
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

function siteStrings() {
  const code = fs
    .readFileSync(path.join(ROOT, "site/src/lib/strings.ts"), "utf8")
    .replace(/^export /gm, "")
    .split("\ntype Key")[0];
  return vm.runInNewContext(`${code}; SITE_STRINGS`);
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

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
    `<link rel="canonical" href="${page.url}" />`,
    ...PAGES.map((p) => `<link rel="alternate" hreflang="${p.lang}" href="${p.url}" />`),
    `<link rel="alternate" hreflang="x-default" href="${DEFAULT_PAGE.url}" />`,
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
    ...PAGES.filter((p) => p !== page).map((p) => `<meta property="og:locale:alternate" content="${p.locale}" />`),
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<script type="application/ld+json">${JSON.stringify(schema).replace(/</g, "\\u003c")}</script>`,
  ]
    .map((line) => `    ${line}`)
    .join("\n");
}

function pageHtml(template, page, strings) {
  const s = strings[page.lang];
  const html = template
    .replace(/<html lang="[^"]*">/, `<html lang="${page.lang}">`)
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(s.title)}</title>`)
    .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${esc(s.description)}" />`)
    .replace("</head>", `${headTags(page, s)}\n  </head>`);
  if (!html.includes(`<title>${esc(s.title)}</title>`) || !html.includes(s.description.slice(0, 20))) {
    throw new Error(`${page.file}: nie udało się podmienić tytułu lub opisu w index.html`);
  }
  return html;
}

function serve(dir) {
  const types = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json",
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
  try {
    for (const page of pages) {
      const dom = await dumpDom(`http://127.0.0.1:${port}${page.path}?prerender=1`, { timeZone: page.timeZone });
      const match = dom.match(/<div id="root">([\s\S]*?)<\/div>\s*<script src="messages\.js">/);
      const heading = esc(strings[page.lang].heading);
      if (!match || !match[1].includes(heading)) throw new Error(`${page.file}: w wyrenderowanej stronie brak nagłówka „${heading}”`);
      const file = path.join(SITE, page.file);
      const html = fs.readFileSync(file, "utf8").replace('<div id="root"></div>', `<div id="root">${match[1]}</div>`);
      fs.writeFileSync(file, html);
      console.log(`${page.file}: gotowy HTML (${Math.round(match[1].length / 1024)} KB treści)`);
    }
  } finally {
    server.close();
  }
}

function sitemap() {
  const date = new Date().toISOString().slice(0, 10);
  const links = [
    ...PAGES.map((p) => `    <xhtml:link rel="alternate" hreflang="${p.lang}" href="${p.url}" />`),
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${DEFAULT_PAGE.url}" />`,
  ].join("\n");
  const urls = PAGES.map((p) => `  <url>\n    <loc>${p.url}</loc>\n    <lastmod>${date}</lastmod>\n${links}\n  </url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`;
}

async function main() {
  if (args.includes("--no-build")) return;
  execSync("npm run build", { cwd: path.join(ROOT, "site"), stdio: "inherit" });

  const strings = siteStrings();
  const template = fs.readFileSync(path.join(SITE, "index.html"), "utf8");
  for (const page of PAGES) fs.writeFileSync(path.join(SITE, page.file), pageHtml(template, page, strings));
  fs.writeFileSync(path.join(SITE, "sitemap.xml"), sitemap());

  if (args.includes("--no-prerender")) {
    console.log("Bez prerenderingu (--no-prerender)");
  } else {
    try {
      await prerender(PAGES, strings);
    } catch (e) {
      if (process.env.CI) throw e;
      console.warn(`Prerendering pominięty: ${e.message}`);
    }
  }
  console.log(`_site/: ${fs.readdirSync(SITE).length} plików`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
