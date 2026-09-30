const form = document.getElementById("form");
const $ = (id) => document.getElementById(id);

const BOOL_FIELDS = ["autoPrice", "localPrices", "showRoundTrip", "showFloating", "summaryLink"];
const NUMBER_FIELDS = ["consumption", "price", "evHomePrice", "evFastPrice"];

let data = { ...MAPKA_DATA_KEYS };
let fuelPricesError = null;
let shownUnits = MAPKA_DEFAULTS.units;

mapkaLocalizePage();
for (const [key, name] of Object.entries(MAPKA_FUELS)) {
  form.fuelType.add(new Option(name, key));
}
for (const code of MAPKA_CURRENCIES) form.currency.add(new Option(code, code));
for (const [key, { rate }] of Object.entries(MAPKA_MILEAGE)) {
  form.mileage.querySelector(`[value=${key}]`).textContent = mapkaT(`mileage_${key}_option`, mapkaFormatUnitPrice(rate, "PLN"));
}

const round = (v, digits) => Math.round(v * 10 ** digits) / 10 ** digits;

function showValues(s) {
  form.consumption.value = mapkaRoundConsumption(s.consumption, s.fuelType, s.units);
  const digits = s.units === "us" ? 3 : 2;
  form.price.step = String(10 ** -digits);
  form.price.value = round(mapkaToUnitPrice(s.price, "pb", s.units), digits);
  shownUnits = s.units;
}

function readForm() {
  const units = form.units.value;
  const s = {
    units,
    fuelType: form.fuelType.value,
    currency: form.currency.value,
    mileage: form.mileage.value,
    passengers: Math.max(1, parseInt(form.passengers.value, 10) || 1),
    configured: true,
  };
  for (const f of NUMBER_FIELDS) s[f] = parseFloat(form[f].value) || 0;
  for (const f of BOOL_FIELDS) s[f] = form[f].checked;
  s.consumption = mapkaFromConsumption(s.consumption, s.fuelType, shownUnits);
  s.price = mapkaFromUnitPrice(s.price, "pb", shownUnits);
  return s;
}

function updateView(s) {
  const ev = s.fuelType === "ev";
  const price = mapkaResolvePrice(s, data, null);

  $("consumptionLabel").textContent = mapkaConsumptionLabel(s.fuelType, s.units);
  $("priceText").textContent = mapkaT(s.units === "us" ? "popup_manual_price_us" : "popup_manual_price");
  $("fuelSection").hidden = ev;
  $("evSection").hidden = !ev;
  $("autoInfo").hidden = !s.autoPrice;
  $("localLabel").hidden = !s.autoPrice;
  $("localHint").hidden = !s.autoPrice || !s.localPrices;
  $("priceLabel").hidden = price.auto;
  $("mileageLabel").hidden = MAPKA_COUNTRY !== "PL" && s.mileage === "off";
  form.price.required = !price.auto && !ev;
  form.evHomePrice.required = form.evFastPrice.required = ev;

  if (s.autoPrice && !ev) {
    if (price.auto) {
      const when = new Date(data.fuelPrices.fetchedAt).toLocaleString(MAPKA_LOCALE, { dateStyle: "short", timeStyle: "short" });
      $("autoText").textContent = `${price.source} · ${when}`;
    } else {
      $("autoText").textContent = fuelPricesError ? mapkaT("popup_fetch_error") : price.source;
      $("autoText").title = fuelPricesError || "";
    }
  }

  const per100 = (v) => mapkaFormatMoney(mapkaCostPer100(s, v), s.currency);
  $("preview").textContent = mapkaT(
    "popup_preview",
    `100 ${mapkaDistanceUnit(s.units)}`,
    price.low === price.high ? per100(price.low) : `${per100(price.low)} – ${per100(price.high)}`
  );
}

Promise.all([
  mapkaLoadSettings(),
  mapkaLoadData(),
  new Promise((r) => chrome.storage.local.get({ fuelPricesError: null }, r)),
]).then(([s, d, e]) => {
  data = d;
  fuelPricesError = e.fuelPricesError;
  for (const [key, value] of Object.entries(s)) {
    if (!form[key]) continue;
    if (form[key].type === "checkbox") form[key].checked = value;
    else form[key].value = value;
  }
  showValues(s);
  updateView(s);
});

form.addEventListener("input", () => {
  const s = readForm();
  if (s.units !== shownUnits) showValues(s);
  updateView(s);
  if (!form.checkValidity()) return;
  chrome.storage.sync.set(s, () => {
    $("status").textContent = mapkaT("popup_saved");
    clearTimeout($("status").t);
    $("status").t = setTimeout(() => ($("status").textContent = ""), 1200);
  });
});

$("refresh").addEventListener("click", () => {
  $("refresh").disabled = true;
  $("autoText").textContent = mapkaT("popup_fetching");
  chrome.runtime.sendMessage({ type: "refreshPrices" }, async (res) => {
    $("refresh").disabled = false;
    data = await mapkaLoadData();
    fuelPricesError = res?.ok ? null : res?.errors?.join("; ") || mapkaT("popup_no_response");
    updateView(readForm());
  });
});

$("history").addEventListener("click", () => {
  chrome.tabs.create({ url: "history.html" });
  window.close();
});
