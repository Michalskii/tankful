const ENDPOINT = "https://michalskii.goatcounter.com/count"

function skip() {
  if (/^(localhost|127\.|\[::1\])/.test(location.hostname)) return true
  try {
    return localStorage.getItem("skipgc") === "t"
  } catch {
    return false
  }
}

function send(data: Record<string, string>) {
  if (skip()) return
  const campaign = new URLSearchParams()
  new URLSearchParams(location.search).forEach((v, k) => (k === "ref" || k.startsWith("utm_")) && campaign.set(k, v))
  const q = campaign.toString()
  const params = new URLSearchParams({
    ...data,
    s: String(screen.width),
    q: q ? `?${q}` : "",
    rnd: Math.random().toString(36).slice(2, 7),
  })
  const url = `${ENDPOINT}?${params}`
  try {
    if (navigator.sendBeacon?.(url)) return
  } catch {}
  new Image().src = url
}

function referrer() {
  try {
    return new URL(document.referrer).host === location.host ? "" : document.referrer
  } catch {
    return ""
  }
}

export function trackVisit() {
  send({ p: location.pathname, t: document.title, r: referrer(), e: "false" })
}

export function track(event: string) {
  send({ p: event, t: event, r: "", e: "true" })
}
