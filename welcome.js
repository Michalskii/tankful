const form = document.getElementById("form");
const fuels = document.getElementById("fuels");
const priceInfo = document.getElementById("price");

const TYPICAL_CONSUMPTION = { pb: 7.0, pbp: 7.0, on: 6.0, onp: 6.0, lpg: 9.0, ev: 17.0 };

let settings = MAPKA_DEFAULTS;
let data = { ...MAPKA_DATA_KEYS };
let consumptionTouched = false;

mapkaLocalizePage();

for (const [key, name] of Object.entries(MAPKA_FUELS)) {
  const label = document.createElement("label");
  label.className = "fuel";
  label.innerHTML = `<input type="radio" name="fuelType" value="${key}"><span></span>`;
  label.querySelector("span").textContent = name;
  fuels.append(label);
}

function updatePrice() {
  const s = { ...settings, fuelType: form.fuelType.value };
  document.getElementById("unit").textContent = `${mapkaUnit(s.fuelType)} / 100 km`;
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
    form.consumption.value = TYPICAL_CONSUMPTION[form.fuelType.value];
  }
  updatePrice();
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  chrome.storage.sync.set(
    {
      fuelType: form.fuelType.value,
      consumption: parseFloat(form.consumption.value),
      configured: true,
    },
    () => (location.href = "https://www.google.com/maps")
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
  form.consumption.value = s.consumption;
  updatePrice();
});
