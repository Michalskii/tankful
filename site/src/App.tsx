import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react"
import { ChevronDownIcon, CopyIcon, Loader2Icon, RouteIcon, TriangleAlertIcon } from "lucide-react"
import { toast } from "sonner"

import { AboutDialog, HowItWorks } from "@/components/AboutDialog"
import { InstallCard } from "@/components/InstallCard"
import { StopList } from "@/components/StopList"
import { ThemeMenu } from "@/components/ThemeMenu"
import { PopularRoutes, RouteCosts, RouteDetails } from "@/components/RoutePages"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Toaster } from "@/components/ui/sonner"
import { decodePlace, encodePlace, type Place } from "@/lib/places"
import { track } from "@/lib/analytics"
import { PRERENDER } from "@/lib/prerender"
import { cityName, cityPlace, CURRENT_ROUTE, routeHref, routeSlug, routeTrip } from "@/lib/routes"
import { GERMAN_SITE, guidesHref, homeHref, LANGS, navLinks, otherSite, siteRoot } from "@/lib/sites"
import { stopItem, type StopItem } from "@/lib/stops"
import { T } from "@/lib/strings"
import { cn } from "@/lib/utils"
import { fetchRoutes, formatDuration, sparsePoints, tripCost, type Options, type Route, type Trip } from "@/lib/trip"

const RouteMap = lazy(() => import("@/components/RouteMap").then((m) => ({ default: m.RouteMap })))

const PREFS_KEY = "tankful-calculator"
const SITE_CURRENCY = GERMAN_SITE ? "EUR" : MAPKA_CURRENCY
const TYPICAL_CONSUMPTION: Record<string, number> = { pb: 7.0, pbp: 7.0, on: 6.0, onp: 6.0, lpg: 9.0, ev: 17.0 }
const FAQ = [
  ["faqTripQ", "faqTripA"],
  ["faq1q", "faq1a"],
  ["faq2q", "faq2a"],
  ["faq3q", "faq3a"],
  ["faq4q", "faq4a"],
  ["faq5q", "faq5a"],
  ["faq6q", "faq6a"],
] as const
const HEADER_BUTTON = "text-cream/70 hover:bg-cream/10 hover:text-cream dark:hover:bg-cream/10 focus-visible:ring-amber/60"
const COUNTRY_COLORS =["bg-country-1", "bg-country-2", "bg-country-3", "bg-country-4", "bg-country-5"]

const params = new URLSearchParams(location.search)
const SHARED_REF = "udostepnij"
let openedAs: string | null =
  params.get("ref") === SHARED_REF ? "link-otwarty" : params.has("from") ? "link-powrot" : CURRENT_ROUTE ? "trasa-strona" : null

function readPrefs(): Partial<Options> {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) || "{}")
  } catch {
    return {}
  }
}

function initialOptions(saved = readPrefs()): Options {
  const prefs = params.has("from") ? {} : saved
  const fuel = params.get("fuel") || prefs.fuelType || MAPKA_DEFAULTS.fuelType
  const fuelType = MAPKA_FUELS[fuel] ? fuel : MAPKA_DEFAULTS.fuelType
  const currency = params.get("cur") || prefs.currency || SITE_CURRENCY
  const units = saved.units || MAPKA_DEFAULTS.units
  return {
    units: units === "us" ? "us" : "metric",
    fuelType,
    consumption: parseFloat(params.get("c") || "") || prefs.consumption || TYPICAL_CONSUMPTION[fuelType],
    passengers: parseInt(params.get("p") || "", 10) || prefs.passengers || 1,
    currency: MAPKA_CURRENCIES.includes(currency) ? currency : SITE_CURRENCY,
    ownPrice: null,
    roundTrip: params.get("rt") === "1",
  }
}

export function matchesPrerender() {
  if (["from", "via", "to", "fuel", "c", "p", "cur", "rt", "alt"].some((k) => params.has(k))) return false
  return JSON.stringify(initialOptions()) === JSON.stringify(initialOptions({}))
}

function langHref(lang: string) {
  const p = new URLSearchParams(location.search)
  p.delete("lang")
  p.delete("prerender")
  const q = p.toString()
  const route = CURRENT_ROUTE && routeSlug(CURRENT_ROUTE, lang) ? routeHref(CURRENT_ROUTE, lang) : null
  const other = otherSite(lang)
  const page = other ? (route ? `${siteRoot(lang)}${route}` : other) : (route ?? homeHref(lang))
  return `${page}${q ? `?${q}` : ""}`
}

const routeNames = CURRENT_ROUTE ? [cityName(CURRENT_ROUTE.from), cityName(CURRENT_ROUTE.to)] : null

function initialStops() {
  if (CURRENT_ROUTE && !params.has("from")) return [cityPlace(CURRENT_ROUTE.from), cityPlace(CURRENT_ROUTE.to)]
  return [decodePlace(params.get("from")), ...params.getAll("via").map(decodePlace).filter(Boolean), decodePlace(params.get("to"))]
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat(MAPKA_LOCALE, { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso))
}

export default function App() {
  const [items, setItems] = useState<StopItem[]>(() => initialStops().map(stopItem))
  const stops = useMemo(() => items.map((s) => s.place), [items])
  const [options, setOptions] = useState<Options>(initialOptions)
  const [consumptionText, setConsumptionText] = useState(() =>
    String(mapkaRoundConsumption(options.consumption, options.fuelType, options.units))
  )
  const [consumptionTouched, setConsumptionTouched] = useState(false)
  const [ownPriceText, setOwnPriceText] = useState("")
  const [moreOpen, setMoreOpen] = useState(() => options.units === "us" || options.currency !== SITE_CURRENCY)
  const resultRef = useRef<HTMLDivElement>(null)
  const [resultBelow, setResultBelow] = useState(false)
  const [data, setData] = useState<MapkaData>(() => ({ ...MAPKA_DATA_KEYS, ...window.MAPKA_PRICES }))
  const [pricesError, setPricesError] = useState(false)
  const [plan, setPlan] = useState<{ stops: Place[]; variants: { route: Route; shares: Record<string, number> | null }[] } | null>(() => {
    if (!CURRENT_ROUTE || params.has("from")) return null
    const { route, shares } = routeTrip(CURRENT_ROUTE)
    return { stops: initialStops() as Place[], variants: [{ route, shares }] }
  })
  const [selected, setSelected] = useState(() => parseInt(params.get("alt") || "0", 10) || 0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (patch: Partial<Options>) => setOptions((o) => ({ ...o, ...patch }))

  useEffect(() => {
    document.documentElement.lang = MAPKA_LOCALE
    document.title = routeNames ? T("routeTitle", ...routeNames) : T("title")
    const description = routeNames ? T("routeDescription", ...routeNames, mapkaFormatNumber(CURRENT_ROUTE!.km, 0)) : T("description")
    document.querySelector('meta[name="description"]')?.setAttribute("content", description)
    fetch("prices.json", { cache: "no-cache" })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((prices) => setData((d) => ({ ...d, ...prices })))
      .catch(() => setPricesError(true))
  }, [])

  useEffect(() => {
    try {
      const { ownPrice: _, roundTrip: __, currency, ...rest } = options
      const keep = currency === SITE_CURRENCY ? rest : { ...rest, currency }
      localStorage.setItem(PREFS_KEY, JSON.stringify(keep))
    } catch {}
  }, [options])

  useEffect(() => {
    if (stops.some((s) => !s)) return
    const chosen = stops as Place[]
    if (PRERENDER && CURRENT_ROUTE) return
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchRoutes(chosen)
      .then((routes) => {
        if (cancelled) return
        const variants = routes.map((route) => ({ route, shares: mapkaRouteShares(sparsePoints(route.points)) }))
        setPlan({ stops: chosen, variants })
        setSelected((i) => (i < variants.length ? i : 0))
        track(openedAs ?? "trasa-policzona")
        openedAs = null
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [stops])


  const viaStops = useMemo(() => plan?.stops.slice(1, -1) ?? [], [plan])
  const routes = useMemo(() => plan?.variants.map((v) => v.route) ?? [], [plan])
  const trips = useMemo<Trip[]>(
    () =>
      plan?.variants.map((v) => ({ stops: plan.stops, from: plan.stops[0], to: plan.stops[plan.stops.length - 1], ...v })) ?? [],
    [plan]
  )
  const trip = trips[selected] ?? trips[0] ?? null
  const costs = useMemo(
    () => (options.consumption > 0 ? trips.map((t) => tripCost(t, options, data)) : []),
    [trips, options, data]
  )
  const cost = costs[trips.indexOf(trip!)] ?? null
  const pristineQuery = useRef<string | null>(null)

  useEffect(() => {
    if (!trip || PRERENDER) return
    const p = new URLSearchParams()
    p.set("from", encodePlace(trip.from))
    for (const via of trip.stops.slice(1, -1)) p.append("via", encodePlace(via))
    p.set("to", encodePlace(trip.to))
    p.set("fuel", options.fuelType)
    p.set("c", String(Math.round(options.consumption * 1000) / 1000))
    if (options.passengers > 1) p.set("p", String(options.passengers))
    if (options.roundTrip) p.set("rt", "1")
    p.set("cur", options.currency)
    if (selected > 0) p.set("alt", String(selected))
    if (CURRENT_ROUTE && !params.has("from")) {
      pristineQuery.current ??= p.toString()
      if (p.toString() === pristineQuery.current) return
    }
    history.replaceState(null, "", `${location.pathname}?${p}`)
  }, [trip, options, selected])

  const hasResult = Boolean(cost && trip)
  useEffect(() => {
    const el = resultRef.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => setResultBelow(!entry.isIntersecting && entry.boundingClientRect.top > 0), { rootMargin: "0px 0px -120px 0px" })
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasResult])

  function showResult() {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches
    resultRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" })
  }

  function changeFuel(fuelType: string) {
    if (!fuelType) return
    const patch: Partial<Options> = { fuelType }
    if (!consumptionTouched) {
      patch.consumption = TYPICAL_CONSUMPTION[fuelType]
      setConsumptionText(String(mapkaRoundConsumption(TYPICAL_CONSUMPTION[fuelType], fuelType, options.units)))
    } else {
      patch.consumption = mapkaFromConsumption(parseFloat(consumptionText) || 0, fuelType, options.units)
    }
    set(patch)
  }

  function changeUnits(units: string) {
    if (!units || units === options.units) return
    setConsumptionText(String(mapkaRoundConsumption(options.consumption, options.fuelType, units)))
    if (options.ownPrice) {
      const scale = units === "us" ? 1000 : 100
      setOwnPriceText(String(Math.round(mapkaToUnitPrice(options.ownPrice, "pb", units) * scale) / scale))
    }
    set({ units })
  }

  async function copyLink() {
    try {
      const url = new URL(location.href)
      url.searchParams.set("ref", SHARED_REF)
      await navigator.clipboard.writeText(url.href)
      toast.success(T("copied"))
      track("link-skopiowany")
    } catch {
      toast.error(T("copyFailed"))
    }
  }

  const unit = mapkaUnit(options.fuelType, options.units)
  const distance = (km: number) => mapkaFormatDistance(km, options.units, 0)

  return (
    <div className="flex min-h-svh flex-col lg:h-svh">
      <header className="shrink-0 bg-ink text-cream">
        <div className="flex h-14 items-center justify-between px-4 sm:px-6">
          <a href={homeHref()} className="flex items-center gap-2 font-semibold tracking-tight">
            <img src="icon.svg" alt="" className="size-7" />
            Tankful
          </a>
          <nav className="mr-auto ml-6 hidden gap-1 lg:flex" aria-label="Menu">
            {navLinks().map(({ key, href }) => (
              <Button key={key} asChild size="sm" variant="ghost" className={HEADER_BUTTON}>
                <a href={href}>{T(key)}</a>
              </Button>
            ))}
            <Button asChild size="sm" variant="ghost" className={HEADER_BUTTON}>
              <a href={guidesHref()}>{T("guidesHeading")}</a>
            </Button>
          </nav>
          <div className="flex items-center gap-1">
          <nav className="flex gap-1" aria-label={T("language")}>
            {LANGS.map((lang) => (
              <Button key={lang} asChild size="sm" variant="ghost" className={cn(HEADER_BUTTON, MAPKA_LOCALE === lang && "bg-cream/10 text-cream")}>
                <a
                  href={langHref(lang)}
                  aria-current={MAPKA_LOCALE === lang || undefined}
                  onClick={(e) => {
                    e.preventDefault()
                    location.href = langHref(lang)
                  }}
                >
                  {lang.toUpperCase()}
                </a>
              </Button>
            ))}
          </nav>
            <AboutDialog className={HEADER_BUTTON} />
            <ThemeMenu className={HEADER_BUTTON} />
          </div>
        </div>
        <nav aria-label="Menu" className="-mt-1 flex gap-1 overflow-x-auto px-2 pb-2 [scrollbar-width:none] sm:px-4 lg:hidden">
          {navLinks().map(({ key, href }) => (
            <Button key={key} asChild size="sm" variant="ghost" className={cn(HEADER_BUTTON, "shrink-0")}>
              <a href={href}>{T(key)}</a>
            </Button>
          ))}
          <Button asChild size="sm" variant="ghost" className={cn(HEADER_BUTTON, "shrink-0")}>
            <a href={guidesHref()}>{T("guidesHeading")}</a>
          </Button>
        </nav>
      </header>

      <main className="flex flex-col lg:min-h-0 lg:flex-1 lg:flex-row">
        <aside className="contents lg:flex lg:w-[440px] lg:shrink-0 lg:flex-col lg:overflow-y-auto lg:border-r xl:w-[480px]">
          <div className="order-1 flex min-w-0 flex-col gap-6 p-4 sm:p-6">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-balance">
                {routeNames ? T("routeHeading", ...routeNames) : T("heading")}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">{routeNames ? T("routeLead", ...routeNames) : T("lead")}</p>
            </div>
            <Card>
              <CardContent className="flex flex-col gap-5">
                <StopList items={items} onChange={setItems} />

                <Separator />

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex min-w-0 flex-col gap-2">
                    <Label htmlFor="fuel" className="truncate">
                      {mapkaT("label_fuel")}
                    </Label>
                    <Select value={options.fuelType} onValueChange={changeFuel}>
                      <SelectTrigger id="fuel" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(MAPKA_FUELS).map(([key, name]) => (
                          <SelectItem key={key} value={key}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex min-w-0 flex-col gap-2">
                    <Label htmlFor="consumption" className="truncate">
                      {mapkaConsumptionLabel(options.fuelType, options.units)}
                    </Label>
                    <InputGroup>
                      <InputGroupInput
                        id="consumption"
                        type="number"
                        inputMode="decimal"
                        step="0.1"
                        min="0.1"
                        value={consumptionText}
                        onChange={(e) => {
                          setConsumptionText(e.target.value)
                          setConsumptionTouched(true)
                          set({ consumption: mapkaFromConsumption(parseFloat(e.target.value) || 0, options.fuelType, options.units) })
                        }}
                      />
                      <InputGroupAddon align="inline-end">
                        <InputGroupText>{mapkaConsumptionUnit(options.fuelType, options.units)}</InputGroupText>
                      </InputGroupAddon>
                    </InputGroup>
                  </div>
                  <div className="flex min-w-0 flex-col gap-2">
                    <Label htmlFor="passengers">{T("passengers")}</Label>
                    <Select value={String(options.passengers)} onValueChange={(v) => set({ passengers: Number(v) })}>
                      <SelectTrigger id="passengers" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex min-w-0 flex-col gap-2">
                    <Label htmlFor="round-trip" className="truncate">
                      {T("roundTrip")}
                    </Label>
                    <div className="flex h-8 items-center">
                      <Switch id="round-trip" checked={options.roundTrip} onCheckedChange={(roundTrip) => set({ roundTrip })} />
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  aria-expanded={moreOpen}
                  aria-controls="more-options"
                  onClick={() => setMoreOpen((v) => !v)}
                  className="-my-1 flex items-center gap-1.5 self-start rounded-md py-1 text-sm text-muted-foreground hover:text-foreground"
                >
                  <ChevronDownIcon className={cn("size-4 transition-transform", moreOpen && "rotate-180")} />
                  {T("moreOptions")}
                </button>

                <div id="more-options" hidden={!moreOpen} className="grid grid-cols-2 gap-3">
                  {options.fuelType !== "ev" && (
                    <div className="flex min-w-0 flex-col gap-2">
                      <Label htmlFor="own-price" className="truncate">
                        {T(options.units === "us" ? "ownPriceUs" : "ownPrice")}
                      </Label>
                      <InputGroup>
                        <InputGroupInput
                          id="own-price"
                          type="number"
                          inputMode="decimal"
                          step={options.units === "us" ? "0.001" : "0.01"}
                          min="0"
                          placeholder={T("ownPriceHint")}
                          value={ownPriceText}
                          onChange={(e) => {
                            setOwnPriceText(e.target.value)
                            const shown = parseFloat(e.target.value)
                            set({ ownPrice: shown ? mapkaFromUnitPrice(shown, "pb", options.units) : null })
                          }}
                        />
                        <InputGroupAddon align="inline-end">
                          <InputGroupText>
                            {options.currency}/{unit}
                          </InputGroupText>
                        </InputGroupAddon>
                      </InputGroup>
                    </div>
                  )}
                  <div className="flex min-w-0 flex-col gap-2">
                    <Label htmlFor="units">{mapkaT("label_units")}</Label>
                    <Select value={options.units} onValueChange={changeUnits}>
                      <SelectTrigger id="units" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="metric">km · l</SelectItem>
                        <SelectItem value="us">mi · gal (US)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex min-w-0 flex-col gap-2">
                    <Label htmlFor="currency">{T("currency")}</Label>
                    <Select value={options.currency} onValueChange={(currency) => set({ currency })}>
                      <SelectTrigger id="currency" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MAPKA_CURRENCIES.map((code) => (
                          <SelectItem key={code} value={code}>
                            {code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {pricesError && (
              <Alert>
                <TriangleAlertIcon />
                <AlertDescription>{T("errorPrices")}</AlertDescription>
              </Alert>
            )}
            {error && (
              <Alert variant="destructive">
                <TriangleAlertIcon />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {cost && trip ? (
              <Card ref={resultRef} aria-live="polite" className={cn("scroll-mt-4", loading && "opacity-60 transition-opacity")}>
                <CardHeader>
                  <CardDescription>{T("resultLabel")}</CardDescription>
                  <CardTitle className="text-5xl font-semibold tracking-tight tabular-nums">≈ {cost.total}</CardTitle>
                  <p className="text-sm text-muted-foreground tabular-nums">
                    {distance(trip.route.km)} · {formatDuration(trip.route.minutes)} ·{" "}
                    {mapkaFormatNumber(mapkaToVolume(cost.units, options.fuelType, options.units))} {unit}
                    {trip.route.ferryKm >= 1 && ` · ${T("ferry", distance(trip.route.ferryKm))}`}
                  </p>
                  {(cost.perPerson || cost.roundTrip) && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {cost.perPerson && <Badge variant="secondary">{cost.perPerson}</Badge>}
                      {cost.roundTrip && <Badge variant="secondary">{cost.roundTrip}</Badge>}
                    </div>
                  )}
                </CardHeader>

                {trips.length > 1 && (
                  <CardContent className="flex flex-col gap-2">
                    <p className="text-sm font-medium">{T("variants")}</p>
                    <div role="radiogroup" aria-label={T("variants")} className="flex flex-col gap-1.5">
                      {trips.map((t, i) => {
                        const fastest = trips[0].route
                        const kmDiff = t.route.km + t.route.ferryKm - fastest.km - fastest.ferryKm
                        const extra =
                          i === 0
                            ? T("fastest")
                            : `${kmDiff < 0 ? "−" : "+"}${distance(Math.abs(kmDiff))}, +${formatDuration(Math.max(0, t.route.minutes - fastest.minutes))}`
                        const active = t === trip
                        return (
                          <button
                            key={i}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => setSelected(i)}
                            className={cn(
                              "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
                              active && "border-primary ring-1 ring-primary"
                            )}
                          >
                            <span className="font-medium">
                              {T("variant", i + 1)} <span className="font-normal text-muted-foreground">· {extra}</span>
                            </span>
                            <span className="font-semibold tabular-nums">{costs[i]?.total}</span>
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {distance(t.route.km)} · {formatDuration(t.route.minutes)}
                              {t.route.ferryKm >= 1 && ` · ${T("ferry", distance(t.route.ferryKm))}`}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </CardContent>
                )}

                {cost.countries.length > 0 && (
                  <CardContent className="flex flex-col gap-3">
                    <Separator />
                    <p className="text-sm font-medium">{T("countries")}</p>
                    <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
                      {cost.countries.map((c, i) => (
                        <div
                          key={c.cc}
                          className={COUNTRY_COLORS[i % COUNTRY_COLORS.length]}
                          style={{ flexGrow: c.pct }}
                          title={`${c.name} ${c.pct}%`}
                        />
                      ))}
                    </div>
                    <ul className="flex flex-col gap-1.5 text-sm">
                      {cost.countries.map((c, i) => (
                        <li key={c.cc} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 tabular-nums">
                          <span className={`size-2.5 rounded-full ${COUNTRY_COLORS[i % COUNTRY_COLORS.length]}`} />
                          <span>{c.name}</span>
                          <span className="text-muted-foreground">{c.pct}%</span>
                          <span className="min-w-20 text-right">{c.unitPrice ?? "–"}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                )}

                <CardFooter className="flex flex-col items-start gap-3">
                  <p className="text-xs text-muted-foreground">{cost.source}</p>
                  <Button variant="outline" size="sm" onClick={copyLink}>
                    <CopyIcon /> {T("copyLink")}
                  </Button>
                  <p className="text-xs text-muted-foreground">{T("note")}</p>
                </CardFooter>
              </Card>
            ) : (
              <div className="flex items-center gap-3 rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
                {loading ? <Loader2Icon className="size-5 shrink-0 animate-spin" /> : <RouteIcon className="size-5 shrink-0" />}
                {loading ? T("working") : T("placeholder")}
              </div>
            )}
          </div>

          <div className="order-3 flex flex-col gap-6 p-4 sm:p-6 lg:mt-auto lg:pt-0">
            {CURRENT_ROUTE && <RouteCosts route={CURRENT_ROUTE} data={data} currency={options.currency} />}
            {CURRENT_ROUTE && <RouteDetails route={CURRENT_ROUTE} data={data} currency={options.currency} />}

            {!CURRENT_ROUTE && <HowItWorks />}

            <InstallCard />

            <section aria-labelledby="faq-heading" className="flex flex-col gap-3">
              <h2 id="faq-heading" className="text-base font-semibold">
                {T("faqHeading")}
              </h2>
              <div className="divide-y rounded-xl border">
                {FAQ.map(([q, a]) => (
                  <details key={q} className="group px-4 py-3">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
                      <h3>{T(q)}</h3>
                      <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                    </summary>
                    <p className="mt-2 text-sm text-muted-foreground">{T(a)}</p>
                  </details>
                ))}
              </div>
            </section>

            <PopularRoutes />

            <section aria-labelledby="guides-heading" className="flex flex-col gap-3">
              <h2 id="guides-heading" className="text-base font-semibold">
                {T("guidesHeading")}
              </h2>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {navLinks().map(({ key, desc, href }) => (
                  <li key={key}>
                    <a
                      href={href}
                      className="flex h-full flex-col gap-0.5 rounded-xl border px-4 py-3 transition-colors hover:border-amber hover:bg-amber/5"
                    >
                      <span className="text-sm font-medium">{T(key)}</span>
                      <span className="text-xs text-muted-foreground">{T(desc)}</span>
                    </a>
                  </li>
                ))}
              </ul>
              <a className="self-start text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground" href={guidesHref()}>
                {T("guidesAll")}
              </a>
            </section>

            <footer className="flex flex-col gap-2 text-xs text-muted-foreground">
          <p>
            {T("sources")} {data.updatedAt && T("updated", formatDate(data.updatedAt))}
          </p>
          <p>{T("privacy")}</p>
          <p className="flex gap-4">
            <a className="underline underline-offset-4 hover:text-foreground" href="privacy.html">
              {T("privacyLink")}
            </a>
            <a className="underline underline-offset-4 hover:text-foreground" href="https://github.com/Michalskii/tankful">
              {T("code")}
            </a>
          </p>
            </footer>
          </div>
        </aside>

        <section className="isolate order-2 mx-4 h-80 overflow-hidden rounded-xl border sm:mx-6 lg:m-0 lg:h-auto lg:flex-1 lg:rounded-none lg:border-0">
          <Suspense fallback={<div className="size-full min-h-80" />}>
            <RouteMap routes={routes} selected={trips.indexOf(trip!)} onSelect={setSelected} stops={viaStops} units={options.units} />
          </Suspense>
        </section>
      </main>
      {cost && trip && resultBelow && (
        <button
          type="button"
          onClick={showResult}
          className="fixed inset-x-3 bottom-3 z-40 flex items-center justify-between gap-3 rounded-xl bg-ink px-4 py-3 text-left text-cream shadow-lg shadow-ink/30 lg:hidden"
        >
          <span className="flex flex-col">
            <span className="text-xs text-cream/70 tabular-nums">
              {distance(trip.route.km)} · {formatDuration(trip.route.minutes)}
            </span>
            <span className="text-xl font-semibold tabular-nums">≈ {cost.total}</span>
          </span>
          <span className="flex items-center gap-1 text-sm font-medium text-amber">
            {T("showResult")}
            <ChevronDownIcon className="size-4" />
          </span>
        </button>
      )}
      <Toaster position="bottom-center" />
    </div>
  )
}
