(() => {
  if (/^(localhost|127\.|\[::1\])/.test(location.hostname)) return;
  try {
    if (localStorage.getItem("skipgc") === "t") return;
  } catch {}
  let referrer = "";
  try {
    referrer = new URL(document.referrer).host === location.host ? "" : document.referrer;
  } catch {}
  const campaign = new URLSearchParams();
  new URLSearchParams(location.search).forEach((v, k) => (k === "ref" || k.startsWith("utm_")) && campaign.set(k, v));
  const q = campaign.toString();
  const params = new URLSearchParams({
    p: `${location.hostname === "spritkosten-europa.de" ? "/de" : ""}${location.pathname}`,
    t: document.title,
    r: referrer,
    e: "false",
    s: String(screen.width),
    q: q ? `?${q}` : "",
    rnd: Math.random().toString(36).slice(2, 7),
  });
  const url = `https://michalskii.goatcounter.com/count?${params}`;
  try {
    if (navigator.sendBeacon?.(url)) return;
  } catch {}
  new Image().src = url;
})();
