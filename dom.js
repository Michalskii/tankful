const MAPKA_DOM = {
  listDistance: ".XdKEzd .ivN21e",
  headerDistance: ".hPzYFf",
  row: "[data-trip-index]:not(button)",
  name: "h1",
  time: ".Fk3sm",
  distance: ".ivN21e",
  selectedClass: "vKKO3d",
  panel: '[role="main"]',
  heading: 'h1 *, [role="heading"] *',
};

const MAPKA_OWN = ".mapka-cost, .mapka-float, .mapka-panel, .mapka-warning";
const MAPKA_TIME_RE = /\d.*(min|hr|godz|day|dni|dzień|\bh\b)/i;

function mapkaLeaves(root) {
  return [...root.querySelectorAll("*")].filter((e) => !e.children.length && e.textContent.trim() && !e.closest(MAPKA_OWN));
}

function mapkaWrapper(el, stop) {
  while (
    el.parentElement &&
    el.parentElement !== stop &&
    [...el.parentElement.children].filter((c) => !c.matches(MAPKA_OWN)).length === 1
  ) {
    el = el.parentElement;
  }
  return el;
}

const mapkaHasKm = (el) => mapkaParseKm(el.textContent) != null;

function mapkaRowDistanceEl(row) {
  const known = row.querySelector(MAPKA_DOM.distance);
  if (known && mapkaHasKm(known)) return known;
  const leaf = mapkaLeaves(row).find(mapkaHasKm);
  return leaf ? mapkaWrapper(leaf, row) : null;
}

function mapkaHeaderDistanceEls() {
  const scope = document.querySelector(MAPKA_DOM.panel) || document.body;
  return [...scope.querySelectorAll(MAPKA_DOM.heading)].filter((el) => {
    if (el.children.length) return false;
    const text = el.textContent.trim();
    return (
      text[0] === "(" &&
      text[text.length - 1] === ")" &&
      mapkaParseKm(text) != null &&
      !el.closest(`${MAPKA_DOM.row}, ${MAPKA_OWN}`)
    );
  });
}

function mapkaDistanceTargets() {
  let fallback = false;
  const group = (selector, mode, findFallback) => {
    const known = [...document.querySelectorAll(selector)];
    if (known.some(mapkaHasKm)) return known.map((el) => ({ el, mode }));
    const found = findFallback();
    if (found.length) fallback = true;
    return found.map((el) => ({ el, mode }));
  };
  const targets = [
    ...group(MAPKA_DOM.listDistance, "block", () =>
      [...document.querySelectorAll(MAPKA_DOM.row)].map(mapkaRowDistanceEl).filter(Boolean)
    ),
    ...group(MAPKA_DOM.headerDistance, "inline", mapkaHeaderDistanceEls),
  ];
  return { targets, fallback };
}

function mapkaSelectedIndex(rows) {
  const i = rows.findIndex(
    (r) => r.classList.contains(MAPKA_DOM.selectedClass) || r.getAttribute("aria-selected") === "true"
  );
  if (i >= 0) return i;
  const selected = location.href.match(/!5i(\d+)/)?.[1] || "0";
  return rows.findIndex((r) => r.dataset.tripIndex === selected);
}

function mapkaReadRow(row) {
  const distEl = mapkaRowDistanceEl(row);
  const distText = distEl?.textContent.trim() || "";
  let time = row.querySelector(MAPKA_DOM.time)?.textContent.trim();
  if (!time || !MAPKA_TIME_RE.test(time)) {
    time = mapkaLeaves(row).map((e) => e.textContent.trim()).find((t) => MAPKA_TIME_RE.test(t) && mapkaParseKm(t) == null) || "";
  }
  return {
    name: row.querySelector(MAPKA_DOM.name)?.textContent.trim() || mapkaT("route_default"),
    time,
    distText,
    km: distText ? mapkaParseKm(distText) : null,
  };
}
