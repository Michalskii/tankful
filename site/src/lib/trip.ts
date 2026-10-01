import { placeGeo, type Place } from "@/lib/places"
import { GERMAN_SITE } from "@/lib/sites"
import { T } from "@/lib/strings"

const OSRM_URL = "https://router.project-osrm.org/route/v1/driving/"

export type Route = { km: number; ferryKm: number; minutes: number; points: { lat: number; lng: number }[] }

type OsrmRoute = {
  distance: number
  duration: number
  geometry: string
  legs: { steps: { mode: string; distance: number }[] }[]
}
export type Trip = { stops: Place[]; from: Place; to: Place; route: Route; shares: Record<string, number> | null }

export type Options = {
  units: string
  fuelType: string
  consumption: number
  passengers: number
  currency: string
  ownPrice: number | null
  roundTrip: boolean
}

export async function fetchRoutes(stops: Place[]): Promise<Route[]> {
  const coords = stops.map((p) => `${p.lng},${p.lat}`).join(";")
  const alternatives = stops.length === 2 ? "&alternatives=3" : ""
  const url = `${OSRM_URL}${coords}?overview=full&geometries=polyline6&steps=true${alternatives}`
  let res: Response
  try {
    res = await fetch(url)
  } catch {
    throw new Error(T("errorNetwork"))
  }
  if (!res.ok && res.status !== 400) throw new Error(T("errorNetwork"))
  const body = await res.json()
  if (body.code !== "Ok" || !body.routes?.length) throw new Error(T("errorRoute"))
  return (body.routes as OsrmRoute[])
    .map((route) => {
      const ferry = route.legs.flatMap((leg) => leg.steps).filter((step) => step.mode === "ferry")
      const ferryKm = ferry.reduce((sum, step) => sum + step.distance, 0) / 1000
      return {
        km: route.distance / 1000 - ferryKm,
        ferryKm,
        minutes: route.duration / 60,
        points: decodePolyline(route.geometry, 1e6),
      }
    })
    .sort((a, b) => a.minutes - b.minutes)
}

function decodePolyline(encoded: string, factor: number) {
  const points: { lat: number; lng: number }[] = []
  let i = 0
  let lat = 0
  let lng = 0
  const next = () => {
    let result = 0
    let shift = 0
    let byte: number
    do {
      byte = encoded.charCodeAt(i++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    return result & 1 ? ~(result >> 1) : result >> 1
  }
  while (i < encoded.length) {
    lat += next()
    lng += next()
    points.push({ lat: lat / factor, lng: lng / factor })
  }
  return points
}

export function sparsePoints(points: { lat: number; lng: number }[], km = 2) {
  const out = points.slice(0, 1)
  for (const p of points.slice(1)) {
    const last = out[out.length - 1]
    const dx = (p.lng - last.lng) * 111.32 * Math.cos((p.lat * Math.PI) / 180)
    const dy = (p.lat - last.lat) * 110.57
    if (Math.hypot(dx, dy) >= km) out.push(p)
  }
  if (points.length > 1) out.push(points[points.length - 1])
  return out
}

export function settingsFor(o: Options): MapkaSettings {
  return {
    ...MAPKA_DEFAULTS,
    units: o.units,
    fuelType: o.fuelType,
    consumption: o.consumption,
    currency: o.currency,
    autoPrice: !o.ownPrice,
    price: o.ownPrice || mapkaFallbackPrice(o.currency),
    evHomePrice: GERMAN_SITE && o.currency === "EUR" ? 0.38 : mapkaStartPrice(1.1, o.currency),
    evFastPrice: GERMAN_SITE && o.currency === "EUR" ? 0.65 : mapkaStartPrice(2.8, o.currency),
  }
}

export type CountryRow = { cc: string; name: string; pct: number; unitPrice: string | null }

export type Cost = {
  total: string
  perPerson: string | null
  roundTrip: string | null
  units: number
  source: string
  countries: CountryRow[]
}

export function formatRange(low: number, high: number, currency: string) {
  if (Math.abs(high - low) < 0.005 * Math.max(high, 0.01)) return mapkaFormatMoney(low, currency)
  const lowNum = new Intl.NumberFormat(MAPKA_LOCALE, { maximumFractionDigits: low < 10 ? 2 : 0 }).format(low)
  return `${lowNum}–${mapkaFormatMoney(high, currency)}`
}

export function tripAmount(trip: Trip, o: Options, data: MapkaData) {
  const s = settingsFor(o)
  const geo: MapkaGeo = { origin: placeGeo(trip.from), dest: placeGeo(trip.to), shares: trip.shares }
  const price = mapkaResolvePrice(s, data, geo)
  const units = (trip.route.km * o.consumption) / 100
  return { s, geo, price, units, low: units * price.low, high: units * price.high }
}

export function tripCost(trip: Trip, o: Options, data: MapkaData): Cost {
  const { s, geo, price, units, low, high } = tripAmount(trip, o, data)

  const countries = Object.entries(trip.shares || {}).map(([cc, share]) => {
    const place = [geo.origin, geo.dest].find((g) => g?.cc?.toUpperCase() === cc) || { cc }
    const local = o.fuelType === "ev" ? null : mapkaLocalPricePln(s, data, place)
    const value = local ? mapkaFromPln(local.price, o.currency, data) : null
    return {
      cc,
      name: mapkaCountryName(cc),
      pct: Math.round(share * 100),
      unitPrice:
        value != null
          ? `${mapkaFormatUnitPrice(mapkaToUnitPrice(value, o.fuelType, o.units), o.currency)}/${mapkaUnit(o.fuelType, o.units)}`
          : null,
    }
  })

  return {
    total: formatRange(low, high, o.currency),
    perPerson: o.passengers > 1 ? T("perPerson", o.passengers, formatRange(low / o.passengers, high / o.passengers, o.currency)) : null,
    roundTrip: o.roundTrip ? T("roundTripCost", formatRange(low * 2, high * 2, o.currency)) : null,
    units,
    source: T("priceUsed", price.source),
    countries,
  }
}

export function formatDuration(minutes: number) {
  const m = Math.round(minutes)
  return m < 60 ? T("minutes", m) : T("hours", Math.floor(m / 60), m % 60)
}
