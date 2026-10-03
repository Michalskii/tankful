# Tankful – teksty do Chrome Web Store

Gotowe do wklejenia w panelu dewelopera (https://chrome.google.com/webstore/devconsole).
Nazwa i krótki opis (summary) nie wpisuje się ręcznie – sklep bierze je z `manifest.json`
(`_locales/*/messages.json`: `appName`, `appDescription`). Każdą zmianę w zachowaniu wtyczki
sprawdź też tutaj i w `docs/privacy.html`.

---

## Karta „Store listing”

### Kategoria
**Lifestyle → Travel** (alternatywnie: Productivity → Tools)

### Języki karty
Od 1.2.8: English (domyślny), Polski, Deutsch, Français, Italiano, Español, Nederlands, Čeština, Română, Português (Portugal), Svenska, Ελληνικά, Magyar, Български, Dansk, Suomi – opisy w `store/listing.html`.

### Grafiki
| Pole | Plik |
|---|---|
| Store icon (128×128) | `icons/icon-128.png` |
| Screenshots (1280×800) | `store/en/screenshot-*.png` · `store/pl/screenshot-*.png` |
| Small promo tile (440×280) | `store/promo-tile-440x280.png` |
| Marquee (1400×560) | – (opcjonalny, na później) |

### Adresy
| Pole | Wartość |
|---|---|
| Homepage URL | https://koszt-paliwa.pl/ (kalkulator online) |
| Support URL | https://github.com/Michalskii/tankful/issues |

### Opisy (pełny opis, nazwa, krótki opis)
Wszystkie języki są w **`store/listing.html`** – zakładka na język i przycisk „Kopiuj” przy każdym polu. Źródła: `store/descriptions/<język>.txt` (pełne opisy) i `_locales/<język>/messages.json` (nazwa, krótki opis). Po zmianie: `node store/listing.js`.

Przy dodaniu języka do karty: w panelu „Store listing” wybierz język, wklej pełny opis, dodaj zrzuty (na razie z `store/en/`, dla polskiego `store/pl/`).

---

## Karta „Privacy practices”

Pola w tej karcie wypełnia się po angielsku.

### Single purpose description

```text
Tankful shows the estimated fuel cost of driving routes directly in Google Maps. Everything it does serves that purpose: reading the route's distance from the Google Maps page, getting current average fuel prices and exchange rates, and letting the user save and export the trips they choose to keep.
```

### Permission justifications

**storage**
```text
Saves the user's settings (fuel type, consumption, prices, currency, number of people, display options), the trips the user explicitly saves with the "Save trip" button, and a local cache of downloaded fuel prices, exchange rates and country lookups so they are not fetched on every page.
```

**alarms**
```text
Refreshes the cached fuel prices and exchange rates once an hour in the background, so the costs shown in Google Maps stay current without a network request on every page load.
```

**Host permissions**
```text
Google Maps (www.google.<country>/maps*, maps.google.<country>/*, for EU countries, the UK, the US, Switzerland, Norway and Iceland): the content script reads the distance and travel time of each driving route and shows the fuel cost next to it. It runs only on Google Maps pages.

Fuel prices and exchange rates normally come from one public file on the extension's own website (koszt-paliwa.pl/prices.json, readable without a host permission), which is built every few hours from the sources below (plus Orlen's public wholesale price list, the UK government's weekly road fuel prices and the U.S. EIA's weekly gasoline and diesel prices, used only by the website's build server). The extension contacts these sources directly only when that file is unavailable or out of date:
energy.ec.europa.eu: the European Commission's Weekly Oil Bulletin with national fuel prices in EU countries.
api.nbp.pl: exchange rates from the National Bank of Poland to convert prices between currencies.
nominatim.openstreetmap.org: finds the country of a route's start and destination to choose local fuel prices; coordinates are rounded to about 1 km, and this can be turned off in the settings.

None of these requests send any user data other than the rounded coordinates described for OpenStreetMap.
```

### Are you using remote code?
**No, I am not using remote code.**
```text
All JavaScript is included in the extension package. The extension only downloads data – a public price page (HTML), a spreadsheet (XLSX) and JSON responses – which it parses; nothing downloaded is executed.
```

### Data usage – co zaznaczyć
| Typ danych | Zaznaczyć? | Dlaczego |
|---|---|---|
| Personally identifiable information | ✗ | Nie zbieramy imion, adresów e-mail, identyfikatorów itp. |
| Health information | ✗ | – |
| Financial and payment information | ✗ | – |
| Authentication information | ✗ | – |
| Personal communications | ✗ | – |
| **Location** | **✓** | Przybliżone (~1 km) współrzędne startu i celu trasy trafiają do OpenStreetMap. |
| Web history | ✗ | Nie zapisujemy odwiedzanych stron. |
| User activity | ✗ | Brak śledzenia kliknięć i zachowania. |
| **Website content** | **✓** (ostrożnie) | Wtyczka czyta treść Map Google (nazwy punktów trasy, dystanse, czasy) i na żądanie zapisuje ją w historii przejazdów. Dane nie opuszczają urządzenia, ale zaznaczenie tej kategorii jest bezpieczniejsze przy przeglądzie niż jej pominięcie. |

### Certyfikaty (zaznacz wszystkie trzy)
- ✓ I do not sell or transfer user data to third parties, outside of the approved use cases
- ✓ I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- ✓ I do not use or transfer user data to determine creditworthiness or for lending purposes

### Privacy policy URL
https://koszt-paliwa.pl/privacy.html

---

## Karta „Distribution”
- **Visibility:** Public
- **Regions:** All regions (wtyczka działa najlepiej w UE, Wielkiej Brytanii i USA; poza nimi przełącza się na cenę ręczną)
- **Pricing:** Free

---

## Instrukcje dla recenzenta (pole „Test instructions”, opcjonalne)

```text
No account or login is needed.
1. Install the extension. A welcome page opens – choose a fuel type and consumption, then click the button to open Google Maps.
2. Open a driving route, for example: https://www.google.com/maps/dir/Warsaw/Krakow/data=!4m2!4m1!3e0
3. The estimated fuel cost appears next to each route option in the list, and a "Trip cost" panel appears in the top-right corner of the map.
4. Click a cost to change fuel settings for this route only or as the default. Use "Save trip", then open the trip history from the extension's toolbar popup.
Fuel prices are downloaded in the background right after installation; until they arrive, the manual price from the settings is used.
```
