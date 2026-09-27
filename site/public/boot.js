(() => {
  const param = new URLSearchParams(location.search).get("lang");
  const browserPl = (navigator.language || "").toLowerCase().startsWith("pl");
  const lang = param === "pl" || param === "en" ? param : browserPl ? "pl" : "en";
  const messages = MAPKA_MESSAGES[lang];
  const i18n = {
    getUILanguage: () => lang,
    getMessage: (key, subs = []) =>
      messages[key] ? messages[key].message.replace(/\$(\d)/g, (_, n) => subs[n - 1] ?? "") : "",
  };
  window.chrome = Object.assign(window.chrome || {}, { i18n });
})();
