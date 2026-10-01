(() => {
  for (const form of document.querySelectorAll('form.calc[data-kind="mileage"]')) {
    const rates = JSON.parse(form.dataset.rates);
    const money = (v) => new Intl.NumberFormat(form.dataset.locale, { style: "currency", currency: "PLN", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
    const value = (name) => parseFloat(String(form.elements[name].value).replace(",", "."));
    const out = (name, text) => (form.elements[name].value = text);

    const update = () => {
      const km = value("km");
      if (!(km > 0)) {
        for (const name of ["allowance", "fuel", "diff"]) out(name, "–");
        return;
      }
      const allowance = km * rates[form.elements.vehicle.value];
      const consumption = value("consumption");
      const price = value("price");
      out("allowance", money(allowance));
      if (consumption > 0 && price > 0) {
        const fuel = (km * consumption * price) / 100;
        out("fuel", money(fuel));
        out("diff", `${allowance >= fuel ? "+" : "−"}${money(Math.abs(allowance - fuel))}`);
      } else {
        out("fuel", "–");
        out("diff", "–");
      }
    };

    form.addEventListener("input", update);
    form.addEventListener("submit", (e) => e.preventDefault());
    update();
  }
})();
