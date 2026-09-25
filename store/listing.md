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
English (domyślny) + Polski – dla każdego wklej opis i zrzuty z `store/en/` lub `store/pl/`.

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
| Homepage URL | https://github.com/Michalskii/tankful |
| Support URL | https://github.com/Michalskii/tankful/issues |

### Krótki opis (z manifestu – tylko do wglądu)
- EN: See the fuel cost of every Google Maps driving route – live prices for Poland and the EU, EVs, cost per person.
- PL: Koszt paliwa przy każdej trasie w Mapach Google – aktualne ceny w Polsce i UE, auta elektryczne, koszt na osobę.

### Opis – English

```text
Know what a drive will cost before you set off. Tankful adds the estimated fuel cost right next to the time and distance of every driving route in Google Maps – no copying numbers into a calculator.

WHAT YOU GET
• The cost of every route option in the Google Maps route list and in the route details.
• A compact panel on the map that compares all route options side by side.
• Round-trip cost and cost per person, e.g. "4 × PLN 51" when four people share the ride.
• Settings for one route only – take a friend's car for a single trip without changing your defaults.
• One click to copy a trip summary, or save the trip to your history.

LIVE FUEL PRICES
• Poland: average prices for the region (voivodeship) where the route starts, from autocentrum.pl, refreshed every few hours.
• Other EU countries: national averages from the European Commission's Weekly Oil Bulletin.
• Cross-border trips use the average of the start and destination countries.
• Petrol 95 and 98, diesel, premium diesel and LPG – or set your own price.
• Electric cars: a range from charging at home to fast chargers.
• Prices in PLN, EUR, CZK, HUF, RON, SEK, DKK, GBP, CHF, NOK, ISK or USD, converted at National Bank of Poland rates.

TRIP HISTORY AND BUSINESS TRIPS
• Save trips and see them grouped by month with total distance and cost.
• Export to CSV for your spreadsheet or accounting.
• Polish mileage allowance ("kilometrówka") at the official per-km rates, for business-trip claims.

PRIVACY
No account, no ads, no analytics, no servers. Your settings and trip history stay in your browser. To find the region for local prices, only the route's start and destination – rounded to about 1 km – are sent to OpenStreetMap, and you can turn that off. Full policy: https://michalskii.github.io/tankful/privacy.html

Works on Google Maps in all EU countries, the UK, Switzerland, Norway and Iceland – with automatic prices in the EU and your own price elsewhere. Available in English and Polish.

Costs are estimates based on average fuel prices and the consumption you enter; actual prices at the pump vary.

Tankful is an independent project and is not affiliated with or endorsed by Google. Open source (MIT): https://github.com/Michalskii/tankful
```

### Opis – Polski

```text
Wiedz, ile kosztuje przejazd, zanim ruszysz. Tankful pokazuje szacunkowy koszt paliwa obok czasu i dystansu każdej trasy samochodowej w Mapach Google – bez przepisywania liczb do kalkulatora.

CO DOSTAJESZ
• Koszt każdego wariantu trasy – na liście tras i w szczegółach trasy.
• Panel na mapie, który zestawia wszystkie warianty obok siebie.
• Koszt tam i z powrotem oraz koszt na osobę, np. „4 × 51 zł”, gdy jedziecie we czwórkę.
• Ustawienia tylko dla jednej trasy – jedziesz raz autem znajomego i nie zmieniasz swoich domyślnych.
• Jednym kliknięciem skopiujesz podsumowanie trasy albo zapiszesz przejazd w historii.

AKTUALNE CENY PALIW
• Polska: średnie ceny z województwa, w którym zaczyna się trasa (autocentrum.pl), odświeżane co kilka godzin.
• Inne kraje UE: średnie krajowe z cotygodniowego biuletynu Komisji Europejskiej (Weekly Oil Bulletin).
• Trasy przez granicę liczone są po średniej z kraju startu i celu.
• Benzyna 95 i 98, diesel, diesel premium i LPG – albo Twoja własna cena.
• Auta elektryczne: przedział od ładowania w domu po szybkie ładowarki.
• Ceny w PLN, EUR, CZK, HUF, RON, SEK, DKK, GBP, CHF, NOK, ISK lub USD, przeliczane po kursach NBP.

HISTORIA PRZEJAZDÓW I KILOMETRÓWKA
• Zapisuj przejazdy i przeglądaj je z podziałem na miesiące, z sumą kilometrów i kosztów.
• Eksport do CSV – do arkusza albo księgowości.
• Kilometrówka według oficjalnych stawek za kilometr – do rozliczania podróży służbowych.

PRYWATNOŚĆ
Bez konta, reklam, analityki i serwerów. Ustawienia i historia przejazdów zostają w Twojej przeglądarce. Żeby ustalić województwo lub kraj dla cen lokalnych, do OpenStreetMap wysyłane jest tylko położenie startu i celu trasy – zaokrąglone do ok. 1 km – i możesz to wyłączyć. Pełna polityka: https://michalskii.github.io/tankful/privacy.html

Działa w Mapach Google we wszystkich krajach UE, w Wielkiej Brytanii, Szwajcarii, Norwegii i Islandii – z automatycznymi cenami w UE, a poza nią z Twoją własną ceną. Po polsku i po angielsku.

Koszty są szacunkowe – opierają się na średnich cenach paliw i podanym przez Ciebie spalaniu; ceny na stacjach mogą się różnić.

Tankful to niezależny projekt, niezwiązany z Google ani przez Google niepopierany. Otwarty kod (MIT): https://github.com/Michalskii/tankful
```

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
Saves the user's settings (fuel type, consumption, prices, currency, number of people, display options), the trips the user explicitly saves with the "Save trip" button, and a local cache of downloaded fuel prices, exchange rates and region lookups so they are not fetched on every page.
```

**alarms**
```text
Refreshes the cached fuel prices and exchange rates once an hour in the background, so the costs shown in Google Maps stay current without a network request on every page load.
```

**Host permissions**
```text
Google Maps (www.google.<country>/maps*, maps.google.<country>/*, for EU countries, the UK, Switzerland, Norway and Iceland): the content script reads the distance and travel time of each driving route and shows the fuel cost next to it. It runs only on Google Maps pages.

www.autocentrum.pl: downloads average fuel prices for Poland and its regions (public price page).
energy.ec.europa.eu: downloads the European Commission's Weekly Oil Bulletin with national fuel prices in EU countries.
api.nbp.pl: downloads exchange rates from the National Bank of Poland to convert prices between currencies.
nominatim.openstreetmap.org: finds the country and region of a route's start and destination to choose local fuel prices; coordinates are rounded to about 1 km, and this can be turned off in the settings.

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
https://michalskii.github.io/tankful/privacy.html

---

## Karta „Distribution”
- **Visibility:** Public
- **Regions:** All regions (wtyczka działa najlepiej w UE; poza nią przełącza się na cenę ręczną)
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
