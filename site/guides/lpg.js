(() => {
  for (const form of document.querySelectorAll('form.calc[data-kind="lpg"]')) {
    const { currency, locale } = form.dataset;
    const units = JSON.parse(form.dataset.units);
    const plural = new Intl.PluralRules(locale);
    const money = (v, signDisplay = "auto") => {
      const digits = Math.abs(v) < (currency === "PLN" ? 100 : 10) ? 2 : 0;
      return new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: digits, maximumFractionDigits: digits, signDisplay }).format(v);
    };
    const num = (v, digits = 0) => new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(v);
    const value = (name) => parseFloat(String(form.elements[name].value).replace(",", "."));
    const out = (name, text) => (form.elements[name].value = text);
    const unit = (n, kind) => `${num(n, 1)} ${units[kind][plural.select(n)] ?? units[kind].other}`;
    let lpgEdited = false;

    const update = () => {
      const km = value("km");
      const pbCons = value("pbCons");
      const lpgCons = value("lpgCons");
      const pbPrice = value("pbPrice");
      const lpgPrice = value("lpgPrice");
      const install = value("install") || 0;
      const upkeep = value("upkeep") || 0;
      if (!(pbCons > 0 && lpgCons > 0 && pbPrice > 0 && lpgPrice > 0)) {
        for (const name of ["per100", "year", "payback", "paybackKm", "five"]) out(name, "–");
        return;
      }
      const per100 = pbCons * pbPrice - lpgCons * lpgPrice;
      out("per100", money(per100));
      if (!(km > 0)) {
        for (const name of ["year", "payback", "paybackKm", "five"]) out(name, "–");
        return;
      }
      const year = (per100 * km) / 100 - upkeep;
      out("year", money(year));
      out("five", money(year * 5 - install, "exceptZero"));
      if (year <= 0) {
        out("payback", units.never);
        out("paybackKm", "–");
        return;
      }
      const months = Math.max(1, Math.ceil((install / year) * 12));
      out("payback", months <= 24 ? unit(months, "month") : unit(Math.round((months / 12) * 10) / 10, "year"));
      out("paybackKm", `${num(Math.ceil((install / year) * km / 100) * 100)} km`);
    };

    form.elements.lpgCons.addEventListener("input", () => (lpgEdited = true));
    form.elements.pbCons.addEventListener("input", () => {
      const pbCons = value("pbCons");
      if (!lpgEdited && pbCons > 0) form.elements.lpgCons.value = Math.round(pbCons * 12) / 10;
    });
    form.addEventListener("input", update);
    form.addEventListener("submit", (e) => e.preventDefault());
    update();
  }
})();
