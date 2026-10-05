import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cityName, CURRENT_ROUTE, PAGE_ROUTES, routeHref, routeName, routeTrip, type RoutePage } from "@/lib/routes"
import { T } from "@/lib/strings"
import { formatDuration, formatRange, settingsFor, tripAmount, type Options } from "@/lib/trip"

const TABLE_FUELS: [string, number][] = [["pb", 7], ["on", 6], ["lpg", 9], ["ev", 17]]
const VIGNETTE_COUNTRIES = new Set(["AT", "CZ", "SK", "HU", "SI", "CH", "RO", "BG"])
const TOLL_COUNTRIES = new Set(["FR", "IT", "HR", "ES", "PT", "GR"])
const TANK = 50

function petrol(currency: string): Options {
  return { units: "metric", fuelType: "pb", consumption: 7, passengers: 1, currency, ownPrice: null, roundTrip: false }
}

export function RouteCosts({ route, data, currency }: { route: RoutePage; data: MapkaData; currency: string }) {
  if (!data.updatedAt) return null
  const trip = routeTrip(route)
  const from = cityName(route.from)
  const to = cityName(route.to)
  const rows = TABLE_FUELS.map(([fuelType, consumption]) => {
    const a = tripAmount(trip, { units: "metric", fuelType, consumption, passengers: 1, currency, ownPrice: null, roundTrip: false }, data)
    return { fuelType, consumption, ...a }
  })
  const countries = Object.entries(route.shares || {})
    .map(([cc, share]) => `${mapkaCountryName(cc)} ${Math.round(share * 100)}%`)
    .join(", ")

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>
          <h2 className="text-base font-semibold">{T("routeTableHeading", from, to)}</h2>
        </CardTitle>
        <CardDescription>
          {T("routeSummary", from, to, mapkaFormatNumber(route.km, 0), formatDuration(route.minutes))}
          {countries && ` ${T("routeCountries", countries)}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums [&_td+td]:whitespace-nowrap">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-1.5 pr-3 font-medium">{T("routeFuel")}</th>
                <th className="py-1.5 pr-3 text-right font-medium">{T("routeOneWay")}</th>
                <th className="py-1.5 pr-3 text-right font-medium">{T("routeReturn")}</th>
                <th className="py-1.5 text-right font-medium">{T("routePerPerson")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.fuelType}>
                  <td className="py-2 pr-3">
                    <div className="font-medium">{MAPKA_FUELS[r.fuelType]}</div>
                    <div className="text-xs text-muted-foreground">
                      {mapkaFormatNumber(r.consumption)} {mapkaUnit(r.fuelType)}/100 km
                    </div>
                  </td>
                  <td className="py-2 pr-3 text-right font-semibold">{formatRange(r.low, r.high, currency)}</td>
                  <td className="py-2 pr-3 text-right">{formatRange(r.low * 2, r.high * 2, currency)}</td>
                  <td className="py-2 text-right">{formatRange(r.low / 4, r.high / 4, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          <p>{T("priceUsed", rows[0].price.source)}</p>
          <p>{T("routeAssumption")}</p>
        </div>
      </CardContent>
    </Card>
  )
}

export function RouteDetails({ route, data, currency }: { route: RoutePage; data: MapkaData; currency: string }) {
  if (!data.updatedAt) return null
  const trip = routeTrip(route)
  const from = cityName(route.from)
  const to = cityName(route.to)
  const litres = (route.km * 7) / 100
  const shares = Object.entries(route.shares || {}).sort((a, b) => b[1] - a[1])
  const countries = shares.map(([cc]) => cc)
  const s = settingsFor(petrol(currency))
  const prices = countries
    .map((cc) => {
      const pln = mapkaLocalPricePln(s, data, { cc })?.price
      const price = pln == null ? null : mapkaFromPln(pln, currency, data)
      return price == null ? null : { cc, price }
    })
    .filter((p): p is { cc: string; price: number } => p !== null)
    .sort((a, b) => a.price - b.price)
  const cheapest = prices[0]
  const priciest = prices[prices.length - 1]
  const names = (list: string[]) => list.map((cc) => mapkaCountryName(cc)).join(", ")
  const vignettes = countries.filter((cc) => VIGNETTE_COUNTRIES.has(cc))
  const tolls = countries.filter((cc) => TOLL_COUNTRIES.has(cc))
  const one = tripAmount(trip, petrol(currency), data)
  const lpg = tripAmount(trip, { ...petrol(currency), fuelType: "lpg", consumption: 9 }, data)
  const lpgSaving = (one.low + one.high - lpg.low - lpg.high) / 2
  const facts = [
    `${T("routeFuelNeed", mapkaFormatNumber(route.km, 0), mapkaFormatNumber(litres, 0))} ${T(litres <= TANK ? "routeOneTank" : "routeRefuel")}`,
    shares.length > 1 &&
      T("routeLegs", shares.map(([cc, share]) => `${mapkaCountryName(cc)} ~${mapkaFormatNumber(route.km * share, 0)} km`).join(", ")),
    cheapest && priciest && priciest.price - cheapest.price >= 0.02 &&
      T(
        "routeCheapest",
        mapkaCountryName(cheapest.cc),
        mapkaFormatUnitPrice(cheapest.price, currency),
        mapkaCountryName(priciest.cc),
        mapkaFormatUnitPrice(priciest.price, currency),
        mapkaFormatMoney((priciest.price - cheapest.price) * TANK, currency)
      ),
    vignettes.length > 0 && T("routeVignettes", names(vignettes)),
    tolls.length > 0 && T("routeTolls", names(tolls)),
    T("routeShared", formatRange(one.low / 2, one.high / 2, currency), formatRange(one.low / 3, one.high / 3, currency)),
    lpgSaving > 1 && T("routeLpg", mapkaFormatMoney(lpgSaving, currency)),
  ].filter((f): f is string => Boolean(f))

  return (
    <section aria-labelledby="route-more-heading" className="flex flex-col gap-2">
      <h2 id="route-more-heading" className="text-base font-semibold">
        {T("routeMoreHeading", from, to)}
      </h2>
      <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-muted-foreground">
        {facts.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
    </section>
  )
}

export function PopularRoutes() {
  return (
    <section aria-labelledby="routes-heading" className="flex flex-col gap-3">
      <h2 id="routes-heading" className="text-base font-semibold">
        {T("popularRoutes")}
      </h2>
      <ul className="flex flex-wrap gap-1.5 text-sm">
        {PAGE_ROUTES.filter((r) => r !== CURRENT_ROUTE).map((r) => (
          <li key={routeName(r)}>
            <a
              className="block rounded-full border px-3 py-1 text-muted-foreground transition-colors hover:border-amber hover:text-foreground"
              href={routeHref(r)}
            >
              {routeName(r)}
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
