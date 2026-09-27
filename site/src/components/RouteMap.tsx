import { useEffect, useRef } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

import { PRERENDER } from "@/lib/prerender"
import type { Route } from "@/lib/trip"

const ROUTE_COLOR = "#f2a516"
const ALT_COLOR = "#8a94a3"

type Props = {
  routes: Route[]
  selected: number
  onSelect: (i: number) => void
  stops: { lat: number; lng: number }[]
}

export function RouteMap({ routes, selected, onSelect, stops }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const select = useRef(onSelect)
  select.current = onSelect

  useEffect(() => {
    if (!container.current || PRERENDER) return
    const m = L.map(container.current, { zoomControl: true }).setView([50.5, 12], 4)
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m)
    map.current = m
    const observer = new ResizeObserver(() => m.invalidateSize())
    observer.observe(container.current)
    return () => {
      observer.disconnect()
      m.remove()
    }
  }, [])

  useEffect(() => {
    const m = map.current
    if (!m || !routes.length) return
    const bounds = L.latLngBounds(routes.flatMap((r) => r.points.map((p) => [p.lat, p.lng] as L.LatLngTuple)))
    m.fitBounds(bounds, { padding: [32, 32] })
  }, [routes])

  useEffect(() => {
    const m = map.current
    if (!m) return
    layer.current?.remove()
    const active = routes[selected]
    if (!active) return
    const line = (r: Route) => r.points.map((p) => [p.lat, p.lng] as L.LatLngTuple)
    const stop = (p: L.LatLngTuple, radius = 7) =>
      L.circleMarker(p, { radius, color: "#ffffff", weight: 3, fillColor: "#171717", fillOpacity: 1 })
    const alternatives = routes.flatMap((r, i) =>
      i === selected
        ? []
        : [
            L.polyline(line(r), { color: ALT_COLOR, weight: 5, opacity: 0.8 })
              .on("click", () => select.current(i))
              .bindTooltip(`${Math.round(r.km)} km`, { sticky: true }),
          ]
    )
    const main = line(active)
    layer.current = L.layerGroup([
      ...alternatives,
      L.polyline(main, { color: ROUTE_COLOR, weight: 6, opacity: 0.95 }),
      stop(main[0]),
      stop(main[main.length - 1]),
      ...stops.map((p) => stop([p.lat, p.lng], 5)),
    ]).addTo(m)
  }, [routes, selected, stops])

  return <div ref={container} className="size-full min-h-80" />
}
