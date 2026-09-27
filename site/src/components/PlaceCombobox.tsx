import { useEffect, useRef, useState } from "react"
import { Loader2Icon, MapPinIcon } from "lucide-react"

import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { searchPlaces, type Place } from "@/lib/places"
import { T } from "@/lib/strings"

type Props = {
  id: string
  value: Place | null
  placeholder: string
  onChange: (place: Place) => void
}

export function PlaceCombobox({ id, value, placeholder, onChange }: Props) {
  const [query, setQuery] = useState<string | null>(null)
  const [items, setItems] = useState<Place[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const q = (query ?? "").trim()
  const open = query !== null && q.length >= 2

  useEffect(() => {
    if (q.length < 2) {
      setItems([])
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setLoading(true)
      searchPlaces(q, controller.signal)
        .then(setItems)
        .catch((e) => e.name !== "AbortError" && setItems([]))
        .finally(() => !controller.signal.aborted && setLoading(false))
    }, 250)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [q])

  function pick(place: Place) {
    onChange(place)
    setQuery(null)
    inputRef.current?.blur()
  }

  return (
    <Command shouldFilter={false} className="overflow-visible rounded-lg! bg-transparent p-0">
      <Popover open={open} onOpenChange={(o) => !o && setQuery(null)}>
        <PopoverAnchor asChild>
          <div className="relative">
            <MapPinIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              id={id}
              role="combobox"
              aria-expanded={open}
              autoComplete="off"
              className="h-10 truncate pr-8 pl-9"
              placeholder={placeholder}
              value={query ?? value?.label ?? ""}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => setQuery(e.target.value)}
              onBlur={() => setQuery(null)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setQuery(null)
                  e.currentTarget.blur()
                }
              }}
            />
            {loading && (
              <Loader2Icon className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>
        </PopoverAnchor>
        <PopoverContent
          className="w-(--radix-popover-trigger-width) p-1"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onMouseDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.target === inputRef.current && e.preventDefault()}
        >
          <CommandList>
            {loading && items.length === 0 && (
              <div className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground">
                <Loader2Icon className="size-4 animate-spin" /> {T("searching")}
              </div>
            )}
            {!loading && <CommandEmpty>{T("noResults")}</CommandEmpty>}
            {items.length > 0 && (
              <CommandGroup>
                {items.map((place) => (
                  <CommandItem
                    key={`${place.lat},${place.lng},${place.label}`}
                    value={`${place.lat},${place.lng},${place.label}`}
                    onSelect={() => pick(place)}
                  >
                    <MapPinIcon className="text-muted-foreground" />
                    <span className="truncate">{place.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </PopoverContent>
      </Popover>
    </Command>
  )
}
