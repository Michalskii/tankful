const list = document.getElementById("list");
const empty = document.getElementById("empty");
let trips = [];

mapkaLocalizePage();

const factor = (t) => (t.roundTrip ? 2 : 1);

function money(value, currency) {
  return mapkaFormatMoney(value, currency);
}

function range(low, high, currency) {
  if (Math.abs(high - low) < 0.005 * Math.max(high, 0.01)) return money(low, currency);
  const lowNum = new Intl.NumberFormat(MAPKA_LOCALE, { maximumFractionDigits: low < 10 ? 2 : 0 }).format(low);
  return `${lowNum}–${money(high, currency)}`;
}

function totals(items) {
  const sums = {};
  for (const t of items) {
    const s = (sums[t.currency] ??= { low: 0, high: 0, mileage: 0 });
    s.low += t.costLow * factor(t);
    s.high += t.costHigh * factor(t);
    s.mileage += (t.mileage || 0) * factor(t);
  }
  return sums;
}

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text != null) e.textContent = text;
  return e;
}

function render() {
  list.replaceChildren();
  empty.hidden = trips.length > 0;
  document.getElementById("export").disabled = !trips.length;

  const byMonth = new Map();
  for (const t of [...trips].sort((a, b) => b.date.localeCompare(a.date))) {
    const month = t.date.slice(0, 7);
    if (!byMonth.has(month)) byMonth.set(month, []);
    byMonth.get(month).push(t);
  }

  for (const [month, items] of byMonth) {
    const section = el("section", "month");
    const [y, m] = month.split("-").map(Number);
    const name = new Date(y, m - 1, 1).toLocaleDateString(MAPKA_LOCALE, { month: "long", year: "numeric" });
    const km = items.reduce((sum, t) => sum + t.km * factor(t), 0);
    const sums = Object.entries(totals(items));
    const cost = sums.map(([cur, s]) => range(s.low, s.high, cur)).join(" + ");
    const mileage = sums.filter(([, s]) => s.mileage > 0).map(([cur, s]) => money(s.mileage, cur)).join(" + ");

    const head = el("div", "month__head");
    head.append(el("h2", null, name[0].toUpperCase() + name.slice(1)));
    const summary = el("div", "month__summary");
    summary.append(
      el("span", null, mapkaPlural("trips", items.length)),
      el("span", null, `${Math.round(km).toLocaleString(MAPKA_LOCALE)} km`),
      el("strong", null, `≈ ${cost}`)
    );
    if (mileage) summary.append(el("span", "mileage", `🧾 ${mileage}`));
    head.append(summary);
    section.append(head);

    for (const t of items) {
      const f = factor(t);
      const row = el("div", "trip");
      const date = new Date(t.date).toLocaleDateString(MAPKA_LOCALE, { day: "numeric", month: "short" });

      const main = el("div", "trip__main");
      main.append(
        el("div", "trip__route", `${t.from} → ${t.to}${t.roundTrip ? " → " + t.from : ""}`),
        el(
          "div",
          "trip__meta",
          `${date} · ${t.via} · ${mapkaFormatNumber(t.km * f)} km · ${MAPKA_FUELS[t.fuelType] || t.fuelType}, ${mapkaFormatNumber(t.consumption)} ${mapkaUnit(t.fuelType)}/100 km`
        )
      );

      const cost = el("div", "trip__cost");
      cost.append(el("strong", null, `≈ ${range(t.costLow * f, t.costHigh * f, t.currency)}`));
      if (t.passengers > 1) {
        cost.append(el("span", null, mapkaT("per_person", range((t.costLow * f) / t.passengers, (t.costHigh * f) / t.passengers, t.currency))));
      }
      if (t.mileage) cost.append(el("span", "mileage", `🧾 ${money(t.mileage * f, t.currency)}`));

      const actions = el("div", "trip__actions");
      const round = el("button", t.roundTrip ? "is-on" : "", "⇄");
      round.title = mapkaT(t.roundTrip ? "history_round_on" : "history_round_off");
      round.dataset.action = "round";
      round.dataset.id = t.id;
      const del = el("button", null, "🗑");
      del.title = mapkaT("history_delete");
      del.dataset.action = "delete";
      del.dataset.id = t.id;
      actions.append(round, del);

      row.append(main, cost, actions);
      section.append(row);
    }
    list.append(section);
  }
}

function save() {
  chrome.storage.local.set({ trips });
}

list.addEventListener("click", (e) => {
  const button = e.target.closest("button[data-action]");
  if (!button) return;
  const trip = trips.find((t) => String(t.id) === button.dataset.id);
  if (!trip) return;
  if (button.dataset.action === "round") {
    trip.roundTrip = !trip.roundTrip;
  } else if (button.dataset.action === "delete") {
    if (!confirm(mapkaT("history_delete_confirm", trip.from, trip.to))) return;
    trips = trips.filter((t) => t !== trip);
  }
  save();
  render();
});

document.getElementById("export").addEventListener("click", () => {
  const header = mapkaT("csv_header").split(";");
  const decimal = (1.5).toLocaleString(MAPKA_LOCALE).charAt(1);
  const separator = decimal === "," ? ";" : ",";
  const num = (v) => (v == null ? "" : String(Math.round(v * 100) / 100).replace(".", decimal));
  const rows = trips.map((t) => {
    const f = factor(t);
    return [
      new Date(t.date).toLocaleDateString(MAPKA_LOCALE),
      t.from,
      t.to,
      t.via,
      num(t.km * f),
      mapkaT(t.roundTrip ? "csv_yes" : "csv_no"),
      MAPKA_FUELS[t.fuelType] || t.fuelType,
      num(t.consumption),
      t.passengers,
      num(t.costLow * f),
      num(t.costHigh * f),
      t.currency,
      num(t.mileage == null ? null : t.mileage * f),
    ];
  });
  const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(separator)).join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: `${mapkaT("csv_filename")}-${new Date().toISOString().slice(0, 10)}.csv` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.trips) {
    trips = changes.trips.newValue || [];
    render();
  }
});

chrome.storage.local.get({ trips: [] }, (r) => {
  trips = r.trips;
  render();
});
