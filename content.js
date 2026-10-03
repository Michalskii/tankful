(() => {
  const COST_CLASS = "mapka-cost";
  const FLOAT_CLASS = "mapka-float";
  const OVERRIDES_KEY = "mapka-route-overrides";
  let settings = { ...MAPKA_DEFAULTS };
  let data = { ...MAPKA_DATA_KEYS };
  let scheduled = false;
  let fallbackLogged = false;
  let panel = null;
  let floatEl = null;
  let floatCollapsed = false;
  let routeCache = { key: null, routes: [] };
  let geo = { key: null, origin: null, dest: null, shares: null };
  let review = {};
  let tripCount = 0;
  const countedRoutes = new Set();

  function isDrivingMode() {
    return /!3e0(?!\d)/.test(location.href);
  }

  function routeStops() {
    const parts = location.pathname.split("/");
    const i = parts.indexOf("dir");
    if (i < 0) return [];
    const stops = [];
    for (const p of parts.slice(i + 1)) {
      if (!p || p.startsWith("@") || p.startsWith("data=") || p === "am=t") break;
      stops.push(decodeURIComponent(p).replace(/\+/g, " "));
    }
    return stops;
  }

  function routeKey() {
    const stops = routeStops();
    return stops.length ? stops.join("|").toLowerCase() : null;
  }

  function routeCoords() {
    return [...location.href.matchAll(/!1d(-?\d+\.\d+)!2d(-?\d+\.\d+)/g)].map((m) => ({
      lng: parseFloat(m[1]),
      lat: parseFloat(m[2]),
    }));
  }

  function locate(point) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: "locate", lat: point.lat, lng: point.lng }, (res) => {
          resolve(chrome.runtime.lastError || !res?.ok ? null : res.geo);
        });
      } catch {
        resolve(null);
      }
    });
  }

  function updateGeo(s) {
    if (!s.localPrices || !s.autoPrice || s.fuelType === "ev") return;
    const coords = routeCoords();
    if (coords.length < 2) return;
    const origin = coords[0];
    const dest = coords[coords.length - 1];
    const key = coords.map((c) => `${c.lat.toFixed(2)},${c.lng.toFixed(2)}`).join(";");
    if (key === geo.key) return;
    const shares = mapkaRouteShares(coords);
    geo = { key, origin: null, dest: null, shares };
    Promise.all([locate(origin), locate(dest)]).then(([o, d]) => {
      if (geo.key !== key) return;
      geo = { key, origin: o, dest: d, shares };
      schedule();
    });
  }

  function readOverrides() {
    try {
      return JSON.parse(sessionStorage.getItem(OVERRIDES_KEY)) || {};
    } catch {
      return {};
    }
  }

  function writeOverrides(all) {
    try {
      sessionStorage.setItem(OVERRIDES_KEY, JSON.stringify(all));
    } catch {}
  }

  function routeOverride() {
    const key = routeKey();
    return key ? readOverrides()[key] || null : null;
  }

  function setRouteOverride(value) {
    const key = routeKey();
    if (!key) return;
    const all = readOverrides();
    if (value) all[key] = value;
    else delete all[key];
    writeOverrides(all);
  }

  function effectiveSettings() {
    return { ...settings, ...routeOverride() };
  }

  function priceFor(s) {
    return mapkaResolvePrice(s, data, geo.key ? geo : null);
  }

  function tripCost(km, s) {
    const price = priceFor(s);
    const units = km * s.consumption / 100;
    return { low: units * price.low, high: units * price.high, price };
  }

  const roundShown = (v) => (v < 10 ? v : Math.round(v));

  function formatRange(low, high, currency) {
    if (Math.abs(high - low) < 0.005 * Math.max(high, 0.01)) return mapkaFormatMoney(low, currency);
    const lowNum = new Intl.NumberFormat(MAPKA_LOCALE, { maximumFractionDigits: low < 10 ? 2 : 0 }).format(low);
    return `${lowNum}–${mapkaFormatMoney(high, currency)}`;
  }

  function formatCost(low, high, s) {
    return `≈ ${formatRange(low, high, s.currency)}`;
  }

  function formatPerPerson(low, high, s) {
    const people = Math.max(1, Math.floor(s.passengers));
    return people > 1 ? mapkaT("per_person", formatRange(low / people, high / people, s.currency)) : null;
  }

  function costLines(km, s, mode) {
    if (!s.configured) return { main: mapkaT("cost_setup"), people: null, round: null, mileage: null };
    const { low, high } = tripCost(km, s);
    const main = formatCost(low, high, s) + (routeOverride() ? " ✎" : "");
    const count = Math.max(1, Math.floor(s.passengers));
    const people = count > 1 ? mapkaT("people_line", count, formatRange(low / count, high / count, s.currency)) : null;
    const label = mapkaT(mode === "inline" ? "round_long" : "round_short");
    const round = s.showRoundTrip
      ? `⇄ ${label} ${formatCost(roundShown(low) * 2, roundShown(high) * 2, s)}`
      : null;
    const m = mapkaMileage(km, s, data);
    const mileage = m != null ? mapkaT("cost_mileage", mapkaFormatMoney(m, s.currency)) : null;
    return { main, people, round, mileage };
  }

  function costTitle(km, s) {
    if (!s.configured) return mapkaT("title_setup");
    const { price } = tripCost(km, s);
    const lines = [
      mapkaFuelFormula(km, s),
      `${MAPKA_FUELS[s.fuelType]}: ${price.source}`,
    ];
    if (s.showRoundTrip) lines.push(mapkaT("title_round"));
    if (MAPKA_MILEAGE[s.mileage]) {
      const m = MAPKA_MILEAGE[s.mileage];
      lines.push(mapkaT("title_mileage", mapkaFormatUnitPrice(m.rate, "PLN"), m.label));
    }
    if (routeOverride()) lines.push(mapkaT("title_override"));
    return lines.join("\n");
  }

  function removeAll() {
    document.querySelectorAll(`.${COST_CLASS}`).forEach((el) => el.remove());
    closePanel();
    removeFloat();
    resetLayoutCheck();
  }

  function render() {
    scheduled = false;
    if (!alive()) return;
    if (!isDrivingMode()) {
      removeAll();
      return;
    }
    const s = effectiveSettings();
    updateGeo(s);
    let found = 0;
    const { targets, fallback } = mapkaDistanceTargets();
    if (fallback && !fallbackLogged) {
      fallbackLogged = true;
      console.info("[Tankful] Known Google Maps classes no longer match – using the fallback search. MAPKA_DOM in dom.js needs updating.");
    }
    for (const { el: distEl, mode } of targets) {
      const km = mapkaParseKm(distEl.textContent);
      let costEl = distEl.nextElementSibling;
      if (!costEl || !costEl.classList.contains(COST_CLASS)) costEl = null;
      if (km == null) {
        costEl?.remove();
        continue;
      }
      found++;
      const { main, people, round, mileage } = costLines(km, s, mode);
      const lines = [main, people, round, mode === "inline" ? mileage : null].filter(Boolean);
      const title = `${costTitle(km, s)}\n${mapkaT("click_to_change")}`;
      const key = `${lines.join("|")}|${title}`;
      if (costEl && costEl.dataset.key === key) continue;
      if (!costEl) {
        costEl = document.createElement(mode === "inline" ? "span" : "div");
        costEl.className = `${COST_CLASS} ${COST_CLASS}--${mode}`;
        costEl.setAttribute("role", "button");
        costEl.tabIndex = 0;
        distEl.after(costEl);
      }
      costEl.classList.toggle(`${COST_CLASS}--setup`, !s.configured);
      const tag = mode === "inline" ? "span" : "div";
      costEl.replaceChildren(
        ...lines.map((text, i) => el(tag, `${COST_CLASS}__${i === 0 ? "main" : "round"}`, text))
      );
      costEl.dataset.key = key;
      costEl.title = title;
    }
    countRoute(found > 0);
    renderFloat(s);
    checkLayout(found > 0 || readRoutes().length > 0);
  }

  function countRoute(shown) {
    const key = routeKey();
    if (!shown || !key || countedRoutes.has(key)) return;
    countedRoutes.add(key);
    mapkaUpdateReview((r) => ({ routes: (r.routes || 0) + 1 }));
  }

  const LAYOUT_GRACE_MS = 8000;
  let layoutMissingSince = null;
  let layoutTimer = null;
  let warnEl = null;
  let warnDismissedKey = null;

  function resetLayoutCheck() {
    layoutMissingSince = null;
    clearTimeout(layoutTimer);
    layoutTimer = null;
    warnEl?.remove();
    warnEl = null;
  }

  function checkLayout(ok) {
    if (ok || routeStops().length < 2) {
      resetLayoutCheck();
      return;
    }
    if (layoutMissingSince == null) layoutMissingSince = Date.now();
    const waited = Date.now() - layoutMissingSince;
    if (waited < LAYOUT_GRACE_MS) {
      if (!layoutTimer) {
        layoutTimer = setTimeout(() => {
          layoutTimer = null;
          schedule();
        }, LAYOUT_GRACE_MS - waited + 50);
      }
      return;
    }
    if (warnEl || warnDismissedKey === routeKey()) return;
    console.warn("[Tankful] Route distance not found (fallback included) – the selectors in dom.js need updating:", MAPKA_DOM);
    warnEl = el("div", "mapka-warning");
    const close = el("button", "mapka-warning__close", "×");
    close.title = mapkaT("warn_hide");
    close.addEventListener("click", () => {
      warnDismissedKey = routeKey();
      warnEl?.remove();
      warnEl = null;
    });
    warnEl.append(
      el("span", null, mapkaT("warn_text")),
      close
    );
    document.body.append(warnEl);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(render);
  }

  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text != null) e.textContent = text;
    return e;
  }

  function readRoutes() {
    const key = routeKey();
    const rows = [...document.querySelectorAll(MAPKA_DOM.row)];
    const selected = mapkaSelectedIndex(rows);
    const routes = rows
      .map((row, i) => ({ index: row.dataset.tripIndex, ...mapkaReadRow(row), selected: i === selected }))
      .filter((r) => r.km != null);
    if (routes.length) {
      routeCache = { key, routes };
      return routes;
    }
    return routeCache.key === key ? routeCache.routes : [];
  }

  function selectedRoute() {
    const routes = readRoutes();
    return routes.find((r) => r.selected) || routes[0] || null;
  }

  function removeFloat() {
    floatEl?.remove();
    floatEl = null;
  }

  function iconButton(icon, title, action) {
    const b = el("button", `${FLOAT_CLASS}__icon`, icon);
    b.title = title;
    b.dataset.float = action;
    return b;
  }

  function renderFloat(s) {
    const routes = s.showFloating ? readRoutes() : [];
    if (!routes.length) {
      removeFloat();
      return;
    }
    const price = priceFor(s);
    const override = routeOverride();
    const askReview = mapkaReviewDue(review, tripCount);
    const key = JSON.stringify([routes, s, price, floatCollapsed, !!override, askReview]);
    if (floatEl?.dataset.key === key && floatEl.isConnected) return;

    if (!floatEl?.isConnected) {
      floatEl = el("div", FLOAT_CLASS);
      document.body.append(floatEl);
    }
    floatEl.dataset.key = key;
    floatEl.classList.toggle(`${FLOAT_CLASS}--collapsed`, floatCollapsed);

    const selected = routes.find((r) => r.selected) || routes[0];
    const head = el("div", `${FLOAT_CLASS}__head`);
    const titleText =
      `🚗 ${floatCollapsed && s.configured ? costLines(selected.km, s, "block").main : mapkaT("trip_cost")}`;
    head.append(
      el("span", `${FLOAT_CLASS}__title`, titleText),
      iconButton("⚙", mapkaT("float_settings"), "settings"),
      iconButton(floatCollapsed ? "+" : "−", mapkaT(floatCollapsed ? "float_expand" : "float_collapse"), "toggle")
    );
    floatEl.replaceChildren(head);
    if (floatCollapsed) return;

    if (!s.configured) {
      const setup = el("button", `${FLOAT_CLASS}__setup`, mapkaT("float_setup"));
      setup.dataset.float = "settings";
      floatEl.append(setup);
      return;
    }

    const list = el("div", `${FLOAT_CLASS}__list`);
    for (const r of routes) {
      const { main, people, round, mileage } = costLines(r.km, s, "block");
      const item = el("div", `${FLOAT_CLASS}__route${r === selected ? " is-selected" : ""}`);
      item.dataset.float = "route";
      item.dataset.trip = r.index;
      item.title = mapkaT("float_show_route");
      const left = el("span", `${FLOAT_CLASS}__left`);
      left.append(el("span", `${FLOAT_CLASS}__name`, r.name), el("span", `${FLOAT_CLASS}__meta`, `${r.time} · ${r.distText}`));
      const right = el("span", `${FLOAT_CLASS}__right`);
      right.dataset.float = "settings";
      right.title = `${costTitle(r.km, s)}\n${mapkaT("click_to_change")}`;
      right.append(el("span", `${FLOAT_CLASS}__cost`, main));
      if (people) right.append(el("span", `${FLOAT_CLASS}__round`, people));
      if (round) right.append(el("span", `${FLOAT_CLASS}__round`, round));
      if (mileage) right.append(el("span", `${FLOAT_CLASS}__round`, mileage));
      item.append(left, right);
      list.append(item);
    }

    const actions = el("div", `${FLOAT_CLASS}__actions`);
    const copy = el("button", null, mapkaT("float_copy"));
    copy.dataset.float = "copy";
    copy.title = mapkaT("float_copy_title");
    const save = el("button", null, mapkaT("float_save"));
    save.dataset.float = "save";
    save.title = mapkaT("float_save_title");
    actions.append(copy, save);

    const foot = el(
      "div",
      `${FLOAT_CLASS}__foot`,
      `${MAPKA_FUELS[s.fuelType]} · ${mapkaFormatConsumption(s.consumption, s.fuelType, s.units)} · ${price.source}` +
        (override ? ` · ${mapkaT("float_override_tag")}` : "")
    );
    floatEl.append(list, actions, foot);
    if (askReview) floatEl.append(mapkaReviewBox("mapka-review"));
  }

  function flash(button, text) {
    const original = button.textContent;
    button.textContent = text;
    button.disabled = true;
    setTimeout(() => {
      button.textContent = original;
      button.disabled = false;
    }, 1500);
  }

  function summaryText(route, s) {
    const stops = routeStops();
    const title = stops.length >= 2 ? `${stops[0]} → ${stops[stops.length - 1]}` : mapkaT("route_default");
    const { low, high } = tripCost(route.km, s);
    const lines = [
      `${title} (${route.name})`,
      `${route.distText} · ${route.time}`,
      mapkaT("summary_fuel", [formatCost(low, high, s), formatPerPerson(low, high, s)].filter(Boolean).join(" · ")),
    ];
    if (s.showRoundTrip) lines.push(mapkaT("summary_round", formatCost(roundShown(low) * 2, roundShown(high) * 2, s)));
    const m = mapkaMileage(route.km, s, data);
    if (m != null) lines.push(mapkaT("summary_mileage", mapkaFormatMoney(m, s.currency)));
    lines.push(`(${MAPKA_FUELS[s.fuelType]}, ${mapkaFormatConsumption(s.consumption, s.fuelType, s.units)})`);
    if (s.summaryLink) lines.push(mapkaT("summary_link", `${MAPKA_SITE_URL}${MAPKA_LOCALE === "pl" ? "" : "en"}?ref=kopia`));
    return lines.join("\n");
  }

  function saveTrip(route, s) {
    const stops = routeStops();
    const { low, high } = tripCost(route.km, s);
    const mileage = mapkaMileage(route.km, s, data);
    const trip = {
      id: Date.now(),
      date: new Date().toISOString(),
      from: stops[0] || "",
      to: stops[stops.length - 1] || "",
      via: route.name,
      km: Math.round(route.km * 10) / 10,
      time: route.time,
      fuelType: s.fuelType,
      consumption: s.consumption,
      passengers: Math.max(1, Math.floor(s.passengers)),
      currency: s.currency,
      costLow: Math.round(low * 100) / 100,
      costHigh: Math.round(high * 100) / 100,
      mileage: mileage == null ? null : Math.round(mileage * 100) / 100,
      roundTrip: false,
    };
    return new Promise((resolve) => {
      chrome.storage.local.get({ trips: [] }, ({ trips }) => {
        trips.push(trip);
        chrome.storage.local.set({ trips }, resolve);
      });
    });
  }

  function selectRoute(index) {
    const rows = [...document.querySelectorAll(MAPKA_DOM.row)];
    const row = rows.find((r) => r.dataset.tripIndex === String(index));
    if (!row || rows.indexOf(row) === mapkaSelectedIndex(rows)) return;
    const target = row.querySelector(MAPKA_DOM.name) || row;
    const r = target.getBoundingClientRect();
    const opts = {
      bubbles: true,
      cancelable: true,
      view: window,
      button: 0,
      clientX: r.left + r.width / 2,
      clientY: r.top + r.height / 2,
    };
    for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
      target.dispatchEvent(new (type.startsWith("pointer") ? PointerEvent : MouseEvent)(type, opts));
    }
  }

  function handleFloatClick(target) {
    const action = target.dataset.float;
    const s = effectiveSettings();
    if (action === "route") {
      selectRoute(target.dataset.trip);
    } else if (action === "settings") {
      openPanel(floatEl);
    } else if (action === "toggle") {
      floatCollapsed = !floatCollapsed;
      chrome.storage.local.set({ floatCollapsed });
      closePanel();
      schedule();
    } else if (action === "copy") {
      const route = selectedRoute();
      if (!route) return;
      navigator.clipboard.writeText(summaryText(route, s)).then(
        () => flash(target, mapkaT("copied")),
        () => flash(target, mapkaT("copy_failed"))
      );
    } else if (action === "save") {
      const route = selectedRoute();
      if (!route) return;
      saveTrip(route, s).then(() => flash(target, mapkaT("saved_flash")));
    }
  }

  function closePanel() {
    panel?.remove();
    panel = null;
  }

  function openPanel(anchor) {
    closePanel();
    const s = effectiveSettings();
    const override = routeOverride();
    const firstRun = !settings.configured;

    panel = document.createElement("div");
    panel.className = "mapka-panel";
    panel.innerHTML = `
      <div class="mapka-panel__title" data-i18n="${firstRun ? "panel_title_first" : "trip_cost"}"></div>
      <label><span data-i18n="label_fuel"></span><select name="fuelType"></select></label>
      <label><span class="mapka-consumption-label"></span><input name="consumption" type="number" step="0.1" min="0.1" required></label>
      <label><span data-i18n="label_passengers"></span><input name="passengers" type="number" step="1" min="1" required></label>
      <div class="mapka-panel__price"></div>
      <div class="mapka-panel__actions">
        <button type="button" data-action="save" class="mapka-primary" data-i18n="${firstRun ? "btn_save" : "btn_save_default"}"></button>
        ${firstRun ? "" : '<button type="button" data-action="route" data-i18n="btn_route_only"></button>'}
      </div>
      ${override ? '<button type="button" data-action="reset" class="mapka-link" data-i18n="btn_reset_route"></button>' : ""}
    `;
    mapkaLocalizePage(panel);

    const fuelSelect = panel.querySelector("[name=fuelType]");
    for (const [key, name] of Object.entries(MAPKA_FUELS)) fuelSelect.add(new Option(name, key));
    fuelSelect.value = s.fuelType;
    panel.querySelector("[name=consumption]").value = mapkaRoundConsumption(s.consumption, s.fuelType, s.units);
    panel.querySelector("[name=passengers]").value = s.passengers;

    const priceInfo = panel.querySelector(".mapka-panel__price");
    const consumptionLabel = panel.querySelector(".mapka-consumption-label");
    const readPanel = () => ({
      fuelType: fuelSelect.value,
      consumption: mapkaFromConsumption(parseFloat(panel.querySelector("[name=consumption]").value), fuelSelect.value, s.units),
      passengers: Math.max(1, parseInt(panel.querySelector("[name=passengers]").value, 10) || 1),
    });
    const update = () => {
      const values = readPanel();
      consumptionLabel.textContent = mapkaConsumptionLabel(values.fuelType, s.units);
      priceInfo.textContent = mapkaT("panel_price", priceFor({ ...s, ...values }).source);
    };
    update();
    panel.addEventListener("input", update);

    panel.addEventListener("click", (e) => {
      const action = e.target.dataset?.action;
      if (!action) return;
      if (action === "reset") {
        setRouteOverride(null);
        closePanel();
        schedule();
        return;
      }
      const values = readPanel();
      if (!(values.consumption > 0)) {
        panel.querySelector("[name=consumption]").focus();
        return;
      }
      if (action === "route") {
        setRouteOverride(values);
        closePanel();
        schedule();
      } else if (action === "save") {
        setRouteOverride(null);
        closePanel();
        chrome.storage.sync.set({ ...values, configured: true });
      }
    });

    panel.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Escape") closePanel();
    });

    document.body.append(panel);
    const r = anchor.getBoundingClientRect();
    const pw = panel.offsetWidth;
    const ph = panel.offsetHeight;
    panel.style.left = `${Math.max(8, Math.min(r.left, innerWidth - pw - 8))}px`;
    panel.style.top = `${r.bottom + ph + 8 < innerHeight ? r.bottom + 6 : Math.max(8, r.top - ph - 6)}px`;
    panel.querySelector("[name=consumption]").focus();
  }

  function onClick(e) {
    if (!alive()) return;
    const reviewTarget = e.target.closest?.(`.${FLOAT_CLASS} [data-review]`);
    if (reviewTarget) {
      e.preventDefault();
      e.stopPropagation();
      mapkaReviewAction(reviewTarget.dataset.review);
      return;
    }
    const floatTarget = e.target.closest?.(`.${FLOAT_CLASS} [data-float]`);
    const costEl = e.target.closest?.(`.${COST_CLASS}`);
    if (floatTarget) {
      e.preventDefault();
      e.stopPropagation();
      handleFloatClick(floatTarget);
    } else if (costEl) {
      e.preventDefault();
      e.stopPropagation();
      openPanel(costEl);
    } else if (panel && !panel.contains(e.target)) {
      closePanel();
    }
  }

  function onKeydown(e) {
    if (!alive()) return;
    const costEl = e.target.closest?.(`.${COST_CLASS}`);
    if (costEl && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      e.stopPropagation();
      openPanel(costEl);
    }
  }

  document.addEventListener("click", onClick, true);
  document.addEventListener("keydown", onKeydown, true);

  let lastKey = routeKey();
  const routeTimer = setInterval(() => {
    if (!alive()) return;
    const key = routeKey();
    if (key !== lastKey) {
      lastKey = key;
      closePanel();
      resetLayoutCheck();
      schedule();
    }
  }, 500);

  const observer = new MutationObserver(schedule);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  let dead = false;

  function alive() {
    if (dead) return false;
    if (chrome.runtime?.id) return true;
    dead = true;
    observer.disconnect();
    clearInterval(routeTimer);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", onKeydown, true);
    removeAll();
    return false;
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync") {
      for (const [key, { newValue }] of Object.entries(changes)) settings[key] = newValue;
    } else if (area === "local") {
      let relevant = false;
      if (changes.review) {
        review = changes.review.newValue || {};
        relevant = true;
      }
      if (changes.trips) {
        tripCount = (changes.trips.newValue || []).length;
        relevant = true;
      }
      for (const key of Object.keys(MAPKA_DATA_KEYS)) {
        if (changes[key]) {
          data[key] = changes[key].newValue;
          relevant = true;
        }
      }
      if (!relevant) return;
    } else {
      return;
    }
    schedule();
  });

  chrome.storage.local.get({ floatCollapsed: false, review: {}, trips: [] }, (r) => {
    floatCollapsed = r.floatCollapsed;
    review = r.review;
    tripCount = r.trips.length;
    schedule();
  });

  Promise.all([mapkaLoadSettings(), mapkaLoadData()]).then(([s, d]) => {
    settings = s;
    data = d;
    schedule();
  });
})();
