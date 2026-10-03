(() => {
  const DARK = document.documentElement.classList.contains("dark");
  const COLORS = DARK ? ["#f2a516", "#5b9cf0", "#2fc48e", "#f06a69", "#9d8ff0"] : ["#d98a00", "#2a78d6", "#1baf7a", "#e34948", "#4a3aa7"];
  const EU_COLOR = "#8a8f98";
  const INK = DARK ? "#ece9e2" : "#1b2430";
  const MUTED = DARK ? "#9ca3af" : "#6b7280";
  const GRID = DARK ? "rgba(255, 255, 255, 0.08)" : "rgba(27, 36, 48, 0.08)";
  const TOOLTIP = "#1b2430";
  const RANGES = { "1y": 52, "3y": 156, "5y": 260, all: Infinity };
  const cache = {};

  const load = (cc) => (cache[cc] ||= fetch(`data/history/${cc}.json`).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }));

  async function render(figure) {
    const series = figure.dataset.series.split(",").map((s) => {
      const [cc, fuel] = s.split(":");
      return { cc, fuel };
    });
    const labels = figure.dataset.labels.split("|");
    const currency = figure.dataset.currency;
    const locale = figure.dataset.locale;
    const data = Object.fromEntries(await Promise.all([...new Set(series.map((s) => s.cc))].map(async (cc) => [cc, await load(cc)])));
    const dates = data[series[0].cc].dates;
    const values = series.map(({ cc, fuel }) =>
      (data[cc][fuel] || []).map((v, i) => (v == null ? null : currency === "PLN" ? v * data[cc].plnPerEur[i] : v))
    );
    let end = dates.length;
    while (end > 0 && values.every((v) => v[end - 1] == null)) end--;

    const money = new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const day = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
    const month = new Intl.DateTimeFormat(locale, { month: "short", year: "numeric", timeZone: "UTC" });
    const year = new Intl.DateTimeFormat(locale, { year: "numeric", timeZone: "UTC" });

    let colorIndex = 0;
    const mixed = new Set(series.map((s) => s.cc)).size > 1;
    const datasets = series.map((s, i) => {
      const eu = mixed && s.cc === "EU";
      const color = eu ? EU_COLOR : COLORS[colorIndex++ % COLORS.length];
      return {
        label: labels[i],
        data: [],
        borderColor: color,
        backgroundColor: color,
        borderWidth: 2,
        borderDash: eu ? [6, 4] : [],
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHoverBorderWidth: 2,
        pointHoverBorderColor: DARK ? "#12161d" : "#fff",
        tension: 0.2,
        spanGaps: true,
      };
    });

    const canvas = figure.querySelector("canvas");
    const chart = new Chart(canvas, {
      type: "line",
      data: { labels: [], datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: "index", intersect: false },
        layout: { padding: { top: 4, right: 4 } },
        scales: {
          x: {
            grid: { display: false },
            border: { color: GRID },
            ticks: { color: MUTED, maxRotation: 0, autoSkip: false, font: { size: 11 } },
          },
          y: {
            grid: { color: GRID },
            border: { display: false },
            ticks: { color: MUTED, font: { size: 11 }, callback: (v) => money.format(v) },
          },
        },
        plugins: {
          legend: {
            display: series.length > 1,
            position: "top",
            align: "start",
            labels: { color: INK, usePointStyle: true, pointStyle: "line", boxWidth: 24, font: { size: 12 } },
          },
          tooltip: {
            backgroundColor: TOOLTIP,
            titleColor: "#faf7f0",
            bodyColor: "#faf7f0",
            padding: 10,
            cornerRadius: 8,
            boxPadding: 4,
            usePointStyle: true,
            callbacks: {
              title: (items) => day.format(new Date(items[0].label)),
              label: (item) => ` ${item.dataset.label}: ${item.parsed.y == null ? "–" : `${money.format(item.parsed.y)}/l`}`,
            },
          },
        },
      },
    });

    const show = (range) => {
      const weeks = RANGES[range] ?? RANGES["3y"];
      const start = Math.max(0, end - weeks);
      const slice = dates.slice(start, end);
      const span = end - start;
      const years = span / 52;
      const yearStep = years > 14 ? 4 : years > 7 ? 2 : 1;
      const monthStep = span > 60 ? 6 : 2;
      const tick = slice.map((iso, i) => {
        const prev = slice[i - 1];
        if (!prev) return null;
        const [y, m] = iso.split("-").map(Number);
        const [py, pm] = prev.split("-").map(Number);
        const d = new Date(iso);
        if (span > 160) return y !== py && y % yearStep === 0 ? year.format(d) : null;
        return m !== pm && (m - 1) % monthStep === 0 ? month.format(d) : null;
      });
      chart.data.labels = slice;
      chart.options.scales.x.ticks.callback = (value, index) => tick[index];
      datasets.forEach((ds, i) => (ds.data = values[i].slice(start, end)));
      chart.update();
      for (const b of figure.querySelectorAll(".chart-ranges button")) b.setAttribute("aria-pressed", String(b.dataset.range === range));
    };
    figure.querySelector(".chart-ranges").addEventListener("click", (e) => {
      const button = e.target.closest("button[data-range]");
      if (button) show(button.dataset.range);
    });
    show(figure.dataset.range);
    figure.classList.add("ready");
  }

  for (const figure of document.querySelectorAll("figure.chart")) {
    render(figure).catch(() => figure.classList.add("failed"));
  }
})();
