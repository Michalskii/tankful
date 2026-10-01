(() => {
  const url = new URL(location.href);
  const pathEn = /\/en(\.html)?$/.test(url.pathname) || /\/route\/[^/]+$/.test(url.pathname);
  const param = url.searchParams.get("lang");
  const site = globalThis.document?.documentElement?.dataset?.lang === "de" ? "de" : "pl";
  if (site === "pl" && ((param === "en" && !pathEn) || (param === "pl" && pathEn))) {
    url.searchParams.delete("lang");
    const dir = url.pathname.replace(/[^/]*$/, "");
    url.pathname = param === "en" ? `${dir}en` : dir;
    location.replace(url);
  }
  const lang = site === "de" ? "de" : pathEn ? "en" : "pl";
  const messages = MAPKA_MESSAGES[lang];
  const i18n = {
    getUILanguage: () => lang,
    getMessage: (key, subs = []) =>
      messages[key] ? messages[key].message.replace(/\$(\d)/g, (_, n) => subs[n - 1] ?? "") : "",
  };
  window.chrome = Object.assign(window.chrome || {}, { i18n });
})();
