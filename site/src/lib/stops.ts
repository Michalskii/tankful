import type { Place } from "@/lib/places"

export type StopItem = { id: number; place: Place | null }

let nextId = 0
export const stopItem = (place: Place | null): StopItem => ({ id: ++nextId, place })
