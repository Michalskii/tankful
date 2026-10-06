const form = document.getElementById("form");
const fuels = document.getElementById("fuels");
const priceInfo = document.getElementById("price");

const TYPICAL_CONSUMPTION = { pb: 7.0, pbp: 7.0, on: 6.0, onp: 6.0, lpg: 9.0, ev: 17.0 };

let settings = MAPKA_DEFAULTS;
let data = { ...MAPKA_DATA_KEYS };
let consumptionTouched = false;
let shownUnits = MAPKA_DEFAULTS.units;

mapkaLocalizePage();

for (const [key, name] of Object.entries(MAPKA_FUELS)) {
  const label = document.createElement("label");
  label.className = "fuel";
  const input = Object.assign(document.createElement("input"), { type: "radio", name: "fuelType", value: key });
  const span = Object.assign(document.createElement("span"), { textContent: name });
  label.append(input, span);
  fuels.append(label);
}

const readConsumption = () => mapkaFromConsumption(parseFloat(form.consumption.value), form.fuelType.value, shownUnits);

function showConsumption(metric) {
  shownUnits = form.units.value;
  form.consumption.value = mapkaRoundConsumption(metric, form.fuelType.value, shownUnits);
}

function updatePrice() {
  const s = { ...settings, fuelType: form.fuelType.value, units: form.units.value };
  document.getElementById("unit").textContent = mapkaConsumptionUnit(s.fuelType, s.units);
  if (s.fuelType === "ev") {
    priceInfo.textContent = mapkaT("welcome_ev");
    return;
  }
  const price = mapkaResolvePrice(s, data, null);
  priceInfo.textContent = price.auto ? mapkaT("welcome_price_auto", price.source) : mapkaT("welcome_price_pending");
}

form.consumption.addEventListener("input", () => (consumptionTouched = true));
fuels.addEventListener("change", () => {
  if (!consumptionTouched && !settings.configured) {
    showConsumption(TYPICAL_CONSUMPTION[form.fuelType.value]);
  }
  updatePrice();
});
form.units.addEventListener("change", () => {
  showConsumption(readConsumption());
  updatePrice();
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  chrome.storage.sync.set(
    {
      fuelType: form.fuelType.value,
      units: form.units.value,
      consumption: readConsumption(),
      configured: true,
    },
    () => (location.href = mapkaSampleRouteUrl(MAPKA_COUNTRY))
  );
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.fuelPrices) {
    data.fuelPrices = changes.fuelPrices.newValue;
    updatePrice();
  }
});

Promise.all([mapkaLoadSettings(), mapkaLoadData()]).then(([s, d]) => {
  settings = s;
  data = d;
  form.fuelType.value = s.fuelType;
  form.units.value = s.units;
  showConsumption(s.consumption);
  updatePrice();
});
