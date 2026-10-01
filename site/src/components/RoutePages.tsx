import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cityName, CURRENT_ROUTE, PAGE_ROUTES, routeHref, routeName, routeTrip, type RoutePage } from "@/lib/routes"
import { T } from "@/lib/strings"
import { formatDuration, formatRange, tripAmount } from "@/lib/trip"

const TABLE_FUELS: [string, number][] = [["pb", 7], ["on", 6], ["lpg", 9], ["ev", 17]]

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

export function PopularRoutes() {
  return (
    <section aria-labelledby="routes-heading" className="flex flex-col gap-3">
      <h2 id="routes-heading" className="text-base font-semibold">
        {T("popularRoutes")}
      </h2>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
        {PAGE_ROUTES.filter((r) => r !== CURRENT_ROUTE).map((r) => (
          <li key={routeName(r)}>
            <a className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" href={routeHref(r)}>
              {routeName(r)}
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
