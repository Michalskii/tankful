import { useEffect, useRef } from "react"
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent, type Modifier } from "@dnd-kit/core"
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ArrowUpDownIcon, CircleIcon, GripVerticalIcon, MapPinIcon, PlusIcon, XIcon } from "lucide-react"

import { PlaceCombobox } from "@/components/PlaceCombobox"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import type { Place } from "@/lib/places"
import { stopItem, type StopItem } from "@/lib/stops"
import { T } from "@/lib/strings"
import { cn } from "@/lib/utils"

const MAX_STOPS = 10
const lockX: Modifier = ({ transform }) => ({ ...transform, x: 0 })

type Props = {
  items: StopItem[]
  onChange: (items: StopItem[]) => void
}

export function StopList({ items, onChange }: Props) {
  const focusId = useRef<number | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  useEffect(() => {
    if (focusId.current === null) return
    document.getElementById(`stop-${focusId.current}`)?.focus()
    focusId.current = null
  }, [items])

  function add() {
    const item = stopItem(null)
    focusId.current = item.id
    onChange([...items, item])
  }

  function dragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const from = items.findIndex((s) => s.id === active.id)
    const to = items.findIndex((s) => s.id === over.id)
    onChange(arrayMove(items, from, to))
  }

  return (
    <div className="flex flex-col gap-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[lockX]} onDragEnd={dragEnd}>
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          <div className="relative flex flex-col gap-2">
            <div className="pointer-events-none absolute top-5 bottom-5 left-[9px] border-l-2 border-dotted border-muted-foreground/40" />
            {items.map((item, i) => (
              <StopRow
                key={item.id}
                item={item}
                index={i}
                count={items.length}
                onPlace={(place) => onChange(items.map((s) => (s.id === item.id ? { ...s, place } : s)))}
                onRemove={() => onChange(items.filter((s) => s.id !== item.id))}
                onSwap={() => onChange([...items].reverse())}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      {items.length < MAX_STOPS && (
        <Button variant="ghost" size="sm" className="self-start text-muted-foreground" onClick={add}>
          <PlusIcon /> {T("addStop")}
        </Button>
      )}
    </div>
  )
}

type RowProps = {
  item: StopItem
  index: number
  count: number
  onPlace: (place: Place) => void
  onRemove: () => void
  onSwap: () => void
}

function StopRow({ item, index, count, onPlace, onRemove, onSwap }: RowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const first = index === 0
  const last = index === count - 1
  const inputId = `stop-${item.id}`

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("group grid grid-cols-[20px_minmax(0,1fr)_32px] items-center gap-2", isDragging && "relative z-20")}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        {...attributes}
        {...listeners}
        aria-label={T("reorder")}
        title={T("reorder")}
        className="relative z-10 flex h-8 cursor-grab touch-none items-center justify-center rounded-md bg-card outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
      >
        <span className={cn("flex group-hover:hidden", isDragging && "hidden")}>
          {last ? (
            <MapPinIcon className="size-4 text-destructive" />
          ) : (
            <CircleIcon className={first ? "size-3.5 stroke-[3]" : "size-2.5 fill-muted-foreground stroke-muted-foreground"} />
          )}
        </span>
        <GripVerticalIcon className={cn("hidden size-4 text-muted-foreground group-hover:block", isDragging && "block")} />
      </button>
      <Label htmlFor={inputId} className="sr-only">
        {first ? T("from") : last ? T("to") : T("stop", index + 1)}
      </Label>
      <div className={cn(isDragging && "rounded-lg shadow-lg")}>
        <PlaceCombobox
          id={inputId}
          value={item.place}
          placeholder={first ? T("fromPlaceholder") : last ? T("toPlaceholder") : T("viaPlaceholder")}
          onChange={onPlace}
        />
      </div>
      {count > 2 ? (
        <Button variant="ghost" size="icon-sm" aria-label={T("removeStop")} title={T("removeStop")} onClick={onRemove}>
          <XIcon />
        </Button>
      ) : (
        first && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="translate-y-[calc(50%+0.25rem)]"
            aria-label={T("swap")}
            title={T("swap")}
            onClick={onSwap}
          >
            <ArrowUpDownIcon />
          </Button>
        )
      )}
    </div>
  )
}
