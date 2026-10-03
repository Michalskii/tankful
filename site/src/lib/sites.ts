import type { Key } from "@/lib/strings"

const SITES: Record<string, string> = {
  pl: "https://koszt-paliwa.pl/",
  en: "https://koszt-paliwa.pl/en",
  de: "https://spritkosten-europa.de/",
}

export const LANGS = ["pl", "en", "de"]

export function siteRoot(lang: string) {
  return lang === "de" ? "https://spritkosten-europa.de/" : "https://koszt-paliwa.pl/"
}

export const GERMAN_SITE = MAPKA_LOCALE === "de"

export function homeHref(lang = MAPKA_LOCALE) {
  return lang === "en" ? "en" : "./"
}

export function guidesHref(lang = MAPKA_LOCALE) {
  return lang === "en" ? "guides/" : lang === "de" ? "ratgeber/" : "poradniki/"
}

const NAV_SLUGS: Record<string, [Key, string][]> = {
  pl: [["navPrices", "ceny-paliw-w-polsce"], ["navConsumption", "kalkulator-spalania"], ["navLpg", "kalkulator-lpg"], ["navMileage", "kilometrowka"]],
  en: [["navPrices", "fuel-prices-europe"], ["navConsumption", "fuel-consumption-calculator"], ["navLpg", "lpg-calculator"]],
  de: [["navPrices", "spritpreise-europa"], ["navConsumption", "spritverbrauch-berechnen"], ["navLpg", "autogas-rechner"]],
}

export function navLinks(lang = MAPKA_LOCALE) {
  return NAV_SLUGS[lang].map(([key, slug]) => ({ key, desc: `${key}Desc` as Key, href: guidesHref(lang) + slug }))
}

export function otherSite(lang: string) {
  return (lang === "de") !== GERMAN_SITE ? SITES[lang] : null
}
