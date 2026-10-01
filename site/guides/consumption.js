(() => {
  for (const form of document.querySelectorAll('form.calc[data-kind="consumption"]')) {
    const prices = JSON.parse(form.dataset.prices);
    const { currency, locale, home } = form.dataset;
    const money = (v) => new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
    const one = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const value = (name) => parseFloat(String(form.elements[name].value).replace(",", "."));
    const out = (name, text) => (form.elements[name].value = text);
    const link = form.querySelector("a.button");
    let edited = false;

    const update = () => {
      const litres = value("litres");
      const km = value("km");
      const price = value("price");
      const fuel = form.elements.fuel.value;
      if (!(litres > 0 && km > 0)) {
        out("consumption", "–");
        out("cost100", "–");
        out("costkm", "–");
        link.href = home;
        return;
      }
      const per100 = (litres / km) * 100;
      out("consumption", `${one.format(per100)} l/100 km`);
      out("cost100", price > 0 ? money(per100 * price) : "–");
      out("costkm", price > 0 ? money((per100 * price) / 100) : "–");
      const params = new URLSearchParams({ fuel, c: String(Math.round(per100 * 10) / 10) });
      link.href = `${home}?${params}`;
    };

    form.elements.price.addEventListener("input", () => (edited = true));
    form.elements.fuel.addEventListener("change", () => {
      if (!edited) form.elements.price.value = prices[form.elements.fuel.value];
    });
    form.addEventListener("input", update);
    form.addEventListener("submit", (e) => e.preventDefault());
    update();
  }
})();
