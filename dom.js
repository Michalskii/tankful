// Odnajdywanie dystansu i wariantów trasy w DOM Google Maps – w dwóch warstwach:
// 1. znane klasy – szybkie i precyzyjne, ale generowane przez Google i co jakiś czas zmieniane;
// 2. awaryjnie tylko to, co stabilne: data-trip-index, role="main", <h1> i sam format tekstu („339 km”, „(339 km)”).
// Tu żyją wszystkie założenia o wyglądzie Google Maps – po zmianie strony poprawia się tylko ten plik.

const MAPKA_DOM = {
  // Lista wariantów trasy: <div class="XdKEzd"><div class="Fk3sm">3 hr 43 min</div><div class="ivN21e"><div>339 km</div></div></div>
  listDistance: ".XdKEzd .ivN21e",
  // Nagłówek szczegółów trasy: <span class="tb1TXc">3 hr 43 min</span> <span class="hPzYFf">(339 km)</span>
  headerDistance: ".hPzYFf",
  // Wiersz wariantu trasy: <div class="UgZKXd ... vKKO3d" data-trip-index="0" role="link"> … <h1 class="VuCHmb">via S7</h1>
  // Przycisk „Szczegóły” w wierszu też ma data-trip-index – dlatego :not(button).
  row: "[data-trip-index]:not(button)",
  name: "h1",
  time: ".Fk3sm",
  distance: ".ivN21e",
  selectedClass: "vKKO3d",
  // Panel wskazówek; poza nim jest m.in. podziałka mapy („50 km”), która udawałaby dystans trasy.
  panel: '[role="main"]',
  // Nagłówek szczegółów trasy: <h1><span>3 hr 43 min</span> <span class="hPzYFf">(339 km)</span></h1>
  heading: 'h1 *, [role="heading"] *',
};

// Własne elementy wtyczki – nigdy nie traktujemy ich jak treści Google.
const MAPKA_OWN = ".mapka-cost, .mapka-float, .mapka-panel, .mapka-warning";
// "3 hr 25 min", "3 godz. 25 min", "1 day 2 hr", "45 min"
const MAPKA_TIME_RE = /\d.*(min|hr|godz|day|dni|dzień|\bh\b)/i;

// Elementy bez dzieci z niepustym tekstem, w kolejności dokumentu.
function mapkaLeaves(root) {
  return [...root.querySelectorAll("*")].filter((e) => !e.children.length && e.textContent.trim() && !e.closest(MAPKA_OWN));
}

// Wspina się przez rodziców, którzy nie mają innych dzieci – "339 km" w <div> w <div class="ivN21e"> → ivN21e,
// tak żeby koszt trafił w to samo miejsce, co przy znanych klasach.
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

// "(339 km)" jako samodzielny element w nagłówku (<h1>) panelu. Grupy kroków też mają dystans w nawiasie
// („1 hr 56 min (209 km)”), ale nie są nagłówkami. Google dzieli ten tekst na węzły "(", "339 km", ")",
// dlatego sprawdzamy elementy, a nie węzły tekstowe.
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

/**
 * Elementy z dystansem, obok których wstawiamy koszt: [{ el, mode: "block" | "inline" }].
 * fallback = true, gdy któraś grupa została znaleziona bez znanych klas.
 */
function mapkaDistanceTargets() {
  let fallback = false;
  const group = (selector, mode, findFallback) => {
    const known = [...document.querySelectorAll(selector)];
    // Przy znanych klasach oddajemy też elementy bez dystansu – render usunie przy nich nieaktualny koszt.
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

// Indeks wybranego wariantu albo -1.
function mapkaSelectedIndex(rows) {
  const i = rows.findIndex(
    (r) => r.classList.contains(MAPKA_DOM.selectedClass) || r.getAttribute("aria-selected") === "true"
  );
  if (i >= 0) return i;
  // Wybrany wariant jest też w URL jako !5i<numer>; bez tego parametru wybrany jest pierwszy.
  const selected = location.href.match(/!5i(\d+)/)?.[1] || "0";
  return rows.findIndex((r) => r.dataset.tripIndex === selected);
}

// { name, time, distText, km } dla wiersza wariantu.
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
