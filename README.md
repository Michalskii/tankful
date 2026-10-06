<p align="center">
  <img src="icons/icon.svg" width="72" alt="" />
</p>

<h1 align="center">Tankful</h1>

<p align="center">
  <strong>The fuel cost of every driving route, right in Google Maps.</strong><br />
  Live fuel prices for Poland, the EU, the UK and the US, trips through several countries, electric cars and cost per person.
</p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/fiogjemolijaleckapbcngibelfbpfgp"><strong>Add to Chrome</strong></a>
  ·
  <a href="https://koszt-paliwa.pl/en?ref=github"><strong>Online calculator</strong></a>
  ·
  <a href="https://koszt-paliwa.pl/?ref=github">Kalkulator po polsku</a>
  ·
  <a href="https://koszt-paliwa.pl/privacy.html">Privacy</a>
</p>

![Tankful in Google Maps: fuel cost next to every route option and a trip cost panel](store/en/screenshot-1-warszawa-krakow.png)

## What it does

Tankful is a Chrome extension that adds the estimated fuel cost next to the time and distance of every driving route in Google Maps – no copying numbers into a calculator.

- **Every route option** gets its cost in the route list and in the route details, and a small panel on the map compares them side by side.
- **Live fuel prices.** National averages from the European Commission's Weekly Oil Bulletin for Poland and other EU countries (in Poland adjusted when Orlen wholesale prices move significantly) and the UK government's weekly road fuel prices for the UK.
- **US prices and units.** Weekly gasoline and diesel prices from the U.S. Energy Information Administration for the state where the EIA publishes one, otherwise for its region or the US average, with distances in miles, fuel in US gallons and consumption in mpg – the default for users in the US.
- **Trips through several countries** – the price is weighted by the kilometres driven in each EU country.
- **Petrol 95 and 98, diesel, premium diesel, LPG** – or your own price. **Electric cars** get a range from charging at home to fast chargers.
- **Round trip and cost per person**, e.g. "4 × PLN 51" when four people share the ride.
- **Trip history** grouped by month, **CSV export** and the Polish mileage allowance (*kilometrówka*) for business trips.
- 12 currencies converted at National Bank of Poland rates, English and Polish interface.

![A trip from Warsaw to Berlin: the price is weighted between Poland and Germany](store/en/screenshot-2-warszawa-berlin.png)

## Online calculator

No Chrome, or on your phone? The same calculation works on the website: pick a start and destination, add stops, choose the fuel and the number of people, and share the result as a link.

**[koszt-paliwa.pl](https://koszt-paliwa.pl/en?ref=github)** – with ready pages for popular routes, such as [Warsaw to Berlin](https://koszt-paliwa.pl/route/warsaw-berlin) or [Kraków to Split](https://koszt-paliwa.pl/route/krakow-split).

![The online calculator: Warsaw to Berlin with the cost split by country](.github/readme/calculator.png)

## Fuel guides and price history

The website also has guides in English and Polish – [fuel prices in Europe](https://koszt-paliwa.pl/guides/fuel-prices-europe), [where to fill up near the Polish border](https://koszt-paliwa.pl/guides/refuel-before-border), [the cost of driving 100 km](https://koszt-paliwa.pl/guides/cost-per-100-km), [whether LPG pays off](https://koszt-paliwa.pl/guides/is-lpg-worth-it) and more. Every figure in them, from a litre of diesel in Germany to the payback of an LPG conversion, is computed from the current prices at each build, so the texts never go stale.

[Fuel price history](https://koszt-paliwa.pl/guides/fuel-price-history) charts weekly petrol, diesel and LPG prices in every EU country since 2005, from the Commission's Weekly Oil Bulletin history – switch between one year and the full history and hover for the price in any week.

![Fuel price history: petrol in Poland, Germany, Czechia and the EU average over five years](.github/readme/price-history.png)

**[All guides](https://koszt-paliwa.pl/guides/)** · **[Poradniki po polsku](https://koszt-paliwa.pl/poradniki/)**

## Privacy

No account, no ads and no analytics in the extension. Settings and trip history stay in your browser. To pick country prices, only the start and destination of a route – rounded to about 1 km – are sent to OpenStreetMap Nominatim, and you can turn that off. Fuel prices come from a public price file on the website, built every few hours from the sources above. Details: [privacy policy](https://koszt-paliwa.pl/privacy.html).

Costs are estimates based on average prices and the consumption you enter – prices at the pump vary.

## Development

Plain JavaScript, Manifest V3, no build step for the extension. Node.js 22 for the tools and the website.

```sh
node tests/test.js                       # tests
node tools/pack.js                       # extension package → dist/tankful-<version>.zip
node tools/pack.js --target=firefox      # Firefox package → dist/tankful-<version>-firefox.zip
node tools/fetch-prices.js prices.json   # download current prices from the sources
node tools/fetch-history.js history.json # download weekly EU price history since 2005
node tools/build-site.js prices.json --history=history.json   # website and guides → _site/ (needs Chrome for prerendering)
node tools/fetch-routes.js               # recompute popular routes (OSRM) → site/src/lib/routes.json
```

To try the extension from source, open `chrome://extensions`, turn on *Developer mode*, click *Load unpacked* and pick this folder.

| Path | What's there |
|---|---|
| `manifest.json`, `background.js` | extension manifest; service worker with price downloads and country lookup |
| `content.js`, `dom.js`, `content.css` | Google Maps integration: reading routes and showing costs |
| `settings.js`, `borders.js` | settings, price logic and currencies; EU borders for costing trips by country |
| `popup.*`, `history.*`, `welcome.*` | toolbar popup, trip history, welcome page |
| `_locales/` | English and Polish texts |
| `site/` | the online calculator (React, Vite, Tailwind, shadcn/ui) |
| `site/guides/` | guides in Markdown with live price tokens, their styles, charts (Chart.js) and cover photos |
| `tools/`, `tests/` | build, packaging, price and price-history scripts, guide generator (`tools/guides.js`); tests |
| `docs/privacy.html` | privacy policy |

The website is deployed to GitHub Pages by `.github/workflows/site.yml` on every push and every 6 hours, which also refreshes `prices.json`, the price history and every number in the guides.

## Po polsku

Tankful to darmowa wtyczka do Chrome, która pokazuje koszt paliwa przy każdej trasie samochodowej w Mapach Google: po aktualnych średnich cenach z biuletynu Komisji Europejskiej (Polska i kraje UE), rządu Wielkiej Brytanii i amerykańskiej agencji EIA (USA, w milach, galonach i mpg), także na trasach przez kilka krajów, dla aut elektrycznych, tam i z powrotem i na osobę. Do tego historia przejazdów, eksport do CSV i kilometrówka.

Na stronie są też [poradniki](https://koszt-paliwa.pl/poradniki/) z aktualnymi cenami – m.in. [ceny paliw w Europie](https://koszt-paliwa.pl/poradniki/ceny-paliw-w-europie), [gdzie zatankować przed granicą](https://koszt-paliwa.pl/poradniki/tankowanie-przed-granica), [czy LPG się opłaca](https://koszt-paliwa.pl/poradniki/czy-lpg-sie-oplaca) – oraz [historia cen paliw](https://koszt-paliwa.pl/poradniki/historia-cen-paliw) z wykresem od 2005 roku.

[Dodaj do Chrome](https://chromewebstore.google.com/detail/fiogjemolijaleckapbcngibelfbpfgp) · [Kalkulator online](https://koszt-paliwa.pl/?ref=github) · [Popularne trasy, np. Warszawa – Kraków](https://koszt-paliwa.pl/trasa/warszawa-krakow)

## License

[MIT](LICENSE). Tankful is an independent project and is not affiliated with or endorsed by Google.
