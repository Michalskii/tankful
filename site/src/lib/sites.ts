const SITES: Record<string, string> = {
  pl: "https://koszt-paliwa.pl/",
  en: "https://koszt-paliwa.pl/en",
  de: "https://spritkosten-europa.de/",
}

export const LANGS = ["pl", "en", "de"]

export const GERMAN_SITE = MAPKA_LOCALE === "de"

export function homeHref(lang = MAPKA_LOCALE) {
  return lang === "en" ? "en" : "./"
}

export function guidesHref(lang = MAPKA_LOCALE) {
  return lang === "en" ? "guides/" : lang === "de" ? "ratgeber/" : "poradniki/"
}

export function otherSite(lang: string) {
  return (lang === "de") !== GERMAN_SITE ? SITES[lang] : null
}
