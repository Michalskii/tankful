const PHOTON_URL = "https://photon.komoot.io/api/"

export type Place = {
  name: string
  label: string
  cc: string
  state: string | null
  region?: string | null
  lat: number
  lng: number
}

function placeLabel(p: Record<string, string | undefined>) {
  const parts = [p.name, p.city, p.state, p.country].filter(Boolean)
  return [...new Set(parts)].join(", ")
}

async function photon(query: string, signal?: AbortSignal, limit = 6): Promise<Place[]> {
  const url = `${PHOTON_URL}?q=${encodeURIComponent(query)}&limit=${limit}&lang=default`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`Photon: HTTP ${res.status}`)
  const { features } = await res.json()
  const seen = new Set<string>()
  return features
    .map((f: { properties: Record<string, string>; geometry: { coordinates: [number, number] } }) => ({
      name: f.properties.name || f.properties.city || query,
      label: placeLabel(f.properties),
      cc: (f.properties.countrycode || "").toLowerCase(),
      state: f.properties.state || null,
      lng: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
    }))
    .filter((p: Place) => !seen.has(p.label) && seen.add(p.label))
}

const EXONYMS: Record<string, string> = {
  Akwizgran: "Aachen", Antwerpia: "Antwerpen", Ateny: "Athens", Barcelona: "Barcelona", Bazylea: "Basel",
  Belgrad: "Beograd", Berno: "Bern", Bolonia: "Bologna", Bratysława: "Bratislava", Brugia: "Brugge",
  Bruksela: "Bruxelles", Budapeszt: "Budapest", Drezno: "Dresden", Dubrownik: "Dubrovnik", Edynburg: "Edinburgh",
  Florencja: "Firenze", "Frankfurt nad Menem": "Frankfurt am Main", Genewa: "Genève", Genua: "Genova",
  Haga: "Den Haag", Kijów: "Kyiv", Kolonia: "Köln", Kopenhaga: "København", Koszyce: "Košice", Lipsk: "Leipzig",
  Lizbona: "Lisboa", Londyn: "London", Lublana: "Ljubljana", Luksemburg: "Luxembourg", Lwów: "Lviv",
  Marsylia: "Marseille", Mediolan: "Milano", Moguncja: "Mainz", Monachium: "München", Monako: "Monaco",
  Neapol: "Napoli", Nicea: "Nice", Norymberga: "Nürnberg", Ołomuniec: "Olomouc", Ostrawa: "Ostrava",
  Paryż: "Paris", Piza: "Pisa", Praga: "Praha", Ratyzbona: "Regensburg", Ryga: "Rīga", Rzym: "Roma",
  Saloniki: "Thessaloniki", Saragossa: "Zaragoza", Sewilla: "Sevilla", Sztokholm: "Stockholm",
  Strasburg: "Strasbourg", Triest: "Trieste", Tuluza: "Toulouse", Turyn: "Torino", Walencja: "Valencia",
  Wenecja: "Venezia", Werona: "Verona", Wiedeń: "Wien", Wilno: "Vilnius", Zurych: "Zürich",
}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const results = await photon(query, signal)
  if (MAPKA_LOCALE !== "pl" || query.length < 3) return results
  const q = slugOf(query)
  const names = Object.keys(EXONYMS).filter((name) => slugOf(name).startsWith(q)).slice(0, 2)
  const extra = await Promise.all(
    names.map((name) => photon(EXONYMS[name], signal, 1).then(([p]) => p && { ...p, label: `${name} – ${p.label}` }))
  )
  return [...extra.filter((p): p is Place => Boolean(p)), ...results].slice(0, 6)
}

function slugOf(name: string) {
  return name
    .toLowerCase()
    .replace(/^województwo\s+/, "")
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
}

const REGION_CODES = Object.fromEntries(
  Object.entries(MAPKA_REGIONS)
    .filter(([code]) => /^[A-Z]{2}$/.test(code))
    .map(([code, slug]) => [slug, code])
)

const REGION_NAMES = Object.fromEntries(
  [
    ["dolnośląskie", "Lower Silesian"], ["kujawsko-pomorskie", "Kuyavian-Pomeranian"], ["lubelskie", "Lublin"],
    ["lubuskie", "Lubusz"], ["łódzkie", "Łódź"], ["małopolskie", "Lesser Poland"], ["mazowieckie", "Masovian"],
    ["opolskie", "Opole"], ["podkarpackie", "Subcarpathian"], ["podlaskie", "Podlaskie"], ["pomorskie", "Pomeranian"],
    ["śląskie", "Silesian"], ["świętokrzyskie", "Holy Cross"], ["warmińsko-mazurskie", "Warmian-Masurian"],
    ["wielkopolskie", "Greater Poland"], ["zachodniopomorskie", "West Pomeranian"],
  ].map(([pl, en]) => [slugOf(pl), MAPKA_LOCALE === "pl" ? `województwo ${pl}` : `${en} Voivodeship`])
)

const US_STATE_CODES = Object.fromEntries(Object.entries(MAPKA_US_STATES).map(([code, [name]]) => [name, code]))

export function placeGeo(place: Place): MapkaPlace {
  if (place.cc === "us") {
    const state = place.state || ""
    const code = place.region || (MAPKA_US_STATES[state] ? state : US_STATE_CODES[state])
    return { cc: "us", region: code ? `US-${code}` : null, regionName: code ? MAPKA_US_STATES[code]?.[0] ?? null : null }
  }
  if (place.cc !== "pl") return { cc: place.cc }
  if (place.region) return { cc: "pl", region: `PL-${place.region}`, regionName: REGION_NAMES[MAPKA_REGIONS[place.region]] }
  const code = REGION_CODES[slugOf(place.state || "")]
  return { cc: "pl", region: code ? `PL-${code}` : null, regionName: place.state }
}

export function encodePlace(place: Place) {
  const region = placeGeo(place).region?.split("-")[1] || ""
  return `${place.lat.toFixed(5)},${place.lng.toFixed(5)},${place.cc},${region},${place.label}`
}

export function decodePlace(value: string | null): Place | null {
  const m = value?.match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),([a-z]{0,2}),([A-Z]{0,2}),(.+)$/)
  if (!m) return null
  return { lat: parseFloat(m[1]), lng: parseFloat(m[2]), cc: m[3], region: m[4] || null, state: null, label: m[5], name: m[5] }
}
