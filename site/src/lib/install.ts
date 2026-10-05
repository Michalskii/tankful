import { useSyncExternalStore } from "react"

import { track } from "@/lib/analytics"
import { PRERENDER } from "@/lib/prerender"

type InstallPrompt = Event & {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

const ua = navigator.userAgent

export const STANDALONE =
  matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
export const IOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
export const IN_APP = /FBAN|FBAV|FB_IAB|Instagram|Barcelona/.test(ua)
export const MOBILE = IOS || /Android|Mobi/.test(ua)

let deferred: InstallPrompt | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

export function setupInstall() {
  addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault()
    deferred = e as InstallPrompt
    notify()
  })
  addEventListener("appinstalled", () => {
    deferred = null
    track("zainstalowano-pwa")
    notify()
  })
  if (STANDALONE) track("uruchomiono-pwa")
  if ("serviceWorker" in navigator && import.meta.env.PROD && !PRERENDER) {
    navigator.serviceWorker.register(new URL("sw.js", document.baseURI)).catch(() => {})
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const never = () => () => {}

export function useHydrated() {
  return useSyncExternalStore(never, () => true, () => false)
}

export function useInstallPrompt() {
  return useSyncExternalStore(subscribe, () => deferred, () => null)
}

export async function promptInstall() {
  const prompt = deferred
  if (!prompt) return
  track("dodaj-do-ekranu")
  deferred = null
  notify()
  await prompt.prompt()
}
