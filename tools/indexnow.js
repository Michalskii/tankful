const fs = require("fs");
const path = require("path");

const KEY = "a4a43f750f2853f07893cd17ce6ad4fb";

const entries = (xml) =>
  new Map([...xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)].map((m) => [m[1], m[2]]));

async function prepareIndexNow(site, siteUrl) {
  fs.writeFileSync(path.join(site, `${KEY}.txt`), KEY);
  const current = entries(fs.readFileSync(path.join(site, "sitemap.xml"), "utf8"));
  let published = new Map();
  try {
    const res = await fetch(`${siteUrl}sitemap.xml`, { cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (res.ok) published = entries(await res.text());
  } catch {}
  const urlList = [...current].filter(([url, lastmod]) => published.get(url) !== lastmod).map(([url]) => url);
  const { host } = new URL(siteUrl);
  fs.writeFileSync(path.join(site, "indexnow.json"), JSON.stringify({ host, key: KEY, keyLocation: `${siteUrl}${KEY}.txt`, urlList }));
  return urlList.length;
}

module.exports = { prepareIndexNow };
