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

const COUNTRY_SLUGS: Record<string, Record<string, string>> = {
  pl: {
    PL: "ceny-paliw-w-polsce", DE: "tankowanie-w-niemczech", CZ: "ceny-paliw-w-czechach", SK: "ceny-paliw-na-slowacji", LT: "ceny-paliw-na-litwie",
    AT: "ceny-paliw-w-austrii", HU: "samochodem-na-wegry", SI: "ceny-paliw-w-slowenii", HR: "samochodem-do-chorwacji", IT: "ceny-paliw-we-wloszech", DK: "ceny-paliw-w-danii",
  },
  en: {
    PL: "fuel-prices-poland", DE: "fuel-prices-germany", CZ: "fuel-prices-czechia", SK: "fuel-prices-slovakia", LT: "fuel-prices-lithuania",
    AT: "fuel-prices-austria", HU: "driving-to-hungary", SI: "fuel-prices-slovenia", HR: "drive-to-croatia", IT: "fuel-prices-italy", DK: "fuel-prices-denmark",
  },
  de: {
    PL: "tanken-in-polen", CZ: "tanken-in-tschechien", AT: "spritpreise-oesterreich", IT: "spritpreise-italien", FR: "spritpreise-frankreich",
    NL: "tanken-in-holland", DK: "spritpreise-daenemark", LU: "tanken-in-luxemburg", SI: "tanken-in-slowenien", HR: "mit-dem-auto-nach-kroatien",
  },
}

export function countryLinks(countries?: string[], lang = MAPKA_LOCALE) {
  const slugs = COUNTRY_SLUGS[lang]
  return (countries ?? Object.keys(slugs)).filter((cc) => slugs[cc]).map((cc) => ({ cc, href: guidesHref(lang) + slugs[cc] }))
}

export function otherSite(lang: string) {
  return (lang === "de") !== GERMAN_SITE ? SITES[lang] : null
}
