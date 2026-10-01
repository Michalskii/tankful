import data from "@/lib/routes.json"
import type { Place } from "@/lib/places"
import type { Trip } from "@/lib/trip"

type City = { pl: string; en: string; de: string; lat: number; lng: number; cc: string; region?: string }
export type RoutePage = { pl: string; en: string; de?: string; deFlip?: boolean; from: string; to: string; km: number; minutes: number; shares: Record<string, number> | null }

const CITIES = data.cities as Record<string, City>
export const ROUTES = data.routes as RoutePage[]

export const PAGE_ROUTES =
  MAPKA_LOCALE === "de" ? ROUTES.filter((r) => r.de).map((r) => (r.deFlip ? { ...r, from: r.to, to: r.from } : r)) : ROUTES

export function cityName(key: string, lang = MAPKA_LOCALE) {
  return CITIES[key][lang === "pl" || lang === "de" ? lang : "en"]
}

export function cityPlace(key: string): Place {
  const c = CITIES[key]
  const name = cityName(key)
  return { name, label: name, cc: c.cc, state: null, region: c.region ?? null, lat: c.lat, lng: c.lng }
}

export function routeTrip(route: RoutePage): Trip {
  const from = cityPlace(route.from)
  const to = cityPlace(route.to)
  return { stops: [from, to], from, to, route: { km: route.km, ferryKm: 0, minutes: route.minutes, points: [] }, shares: route.shares }
}

export function routeHref(route: RoutePage, lang = MAPKA_LOCALE) {
  return lang === "pl" ? `trasa/${route.pl}` : lang === "de" ? `strecke/${route.de}` : `route/${route.en}`
}

export function routeName(route: RoutePage) {
  return `${cityName(route.from)} – ${cityName(route.to)}`
}

export const CURRENT_ROUTE = (() => {
  const m = location.pathname.match(/\/(trasa|route|strecke)\/([a-z0-9-]+?)(?:\.html)?$/)
  if (!m) return null
  const key = m[1] === "trasa" ? "pl" : m[1] === "strecke" ? "de" : "en"
  return PAGE_ROUTES.find((r) => r[key] === m[2]) ?? null
})()
