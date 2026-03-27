import { jsxs, jsx } from "react/jsx-runtime";
const STORE_URL = "https://obieg-zero-store.gotoreadyai.workers.dev";
const AUTH_ID = "__store_auth";
const plugin = ({ React, ui, icons, store, sdk }) => {
  const { useState, useEffect, useMemo } = React;
  const STORE_ID = "__plugin-manager";
  async function getSaved() {
    var _a, _b;
    return ((_b = (_a = await store.get(STORE_ID)) == null ? void 0 : _a.data) == null ? void 0 : _b.specs) ?? [];
  }
  async function setSaved(specs) {
    const existing = await store.get(STORE_ID);
    if (existing) await store.update(STORE_ID, { specs });
    else await store.add("meta", { specs }, { id: STORE_ID });
  }
  function Center() {
    const plugins = sdk.getAllPlugins();
    const [installed, setInstalled] = useState(() => {
      var _a;
      const rec = store.get(STORE_ID);
      return ((_a = rec == null ? void 0 : rec.data) == null ? void 0 : _a.specs) ?? [];
    });
    const [products, setProducts] = useState([]);
    const [search, setSearch] = useState("");
    const [hasLicense, setHasLicense] = useState(false);
    const [activating, setActivating] = useState(false);
    const [buyingId, setBuyingId] = useState(null);
    const [buyEmail, setBuyEmail] = useState("");
    const [versionSpec, setVersionSpec] = useState(null);
    const [versions, setVersions] = useState([]);
    const [loadingVersions, setLoadingVersions] = useState(false);
    useEffect(() => {
      var _a;
      const auth = store.get(AUTH_ID);
      if ((_a = auth == null ? void 0 : auth.data) == null ? void 0 : _a.licenseKey) {
        setHasLicense(true);
        sdk.setStoreAuth({ licenseKey: auth.data.licenseKey });
      }
    }, []);
    useEffect(() => {
      fetch(`${STORE_URL}/products`).then((r) => r.json()).then(setProducts).catch(() => sdk.log("Nie udalo sie pobrac sklepu", "error"));
    }, []);
    useEffect(() => {
      var _a, _b;
      const pendingEmail = (_b = (_a = store.get("__pending_purchase")) == null ? void 0 : _a.data) == null ? void 0 : _b.email;
      if (!pendingEmail) return;
      store.remove("__pending_purchase");
      setActivating(true);
      fetch(`${STORE_URL}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pendingEmail })
      }).then((r) => r.json()).then(async (data) => {
        if (data.error) {
          sdk.log(data.error, "error");
          return;
        }
        const keys = Array.isArray(data) ? data : [];
        for (const k of keys) {
          saveLicense(k.licenseKey);
          await installSpec(`store://${k.productId}`);
        }
        if (keys.length) sdk.log("Zakup aktywowany", "ok");
      }).catch(() => sdk.log("Blad aktywacji zakupu", "error")).finally(() => setActivating(false));
    }, []);
    function saveLicense(licenseKey) {
      const existing = store.get(AUTH_ID);
      if (existing) store.update(AUTH_ID, { licenseKey });
      else store.add("meta", { licenseKey }, { id: AUTH_ID });
      sdk.setStoreAuth({ licenseKey });
      setHasLicense(true);
    }
    useMemo(() => new Set(plugins.map((p) => p.id)), [plugins]);
    const installedSpecs = useMemo(() => new Set(installed), [installed]);
    useMemo(
      () => installed.filter((s) => s.startsWith("store://")),
      [installed]
    );
    const myPlugins = useMemo(
      () => installed.map((spec) => {
        var _a;
        const cached = store.get(`__label:${spec}`);
        const label = ((_a = cached == null ? void 0 : cached.data) == null ? void 0 : _a.label) ?? spec;
        return { spec, label };
      }),
      [installed]
    );
    const filtered = useMemo(() => {
      if (!search.trim() || search.includes("/")) return [];
      const q = search.toLowerCase();
      return products.filter(
        (p) => !installedSpecs.has(`store://${p.id}`) && (p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.pluginId.toLowerCase().includes(q))
      );
    }, [products, search, installedSpecs]);
    async function installSpec(s) {
      s = s.trim();
      if (!s) return;
      sdk.useHostStore.setState({ progress: true });
      try {
        await sdk.loadPlugin(s);
        const saved = await getSaved();
        if (!saved.includes(s)) {
          const next = [...saved, s];
          await setSaved(next);
          setInstalled(next);
          const productId = s.startsWith("store://") ? s.slice(8) : null;
          const product = productId ? products.find((p) => p.id === productId) : null;
          const label = (product == null ? void 0 : product.name) ?? s;
          store.add("meta", { label }, { id: `__label:${s}` });
        }
        sdk.log("Zainstalowano: " + s, "ok");
      } finally {
        sdk.useHostStore.setState({ progress: false });
      }
    }
    async function uninstallSpec(spec) {
      const next = (await getSaved()).filter((s) => s !== spec);
      await setSaved(next);
      setInstalled(next);
      sdk.log("Odinstalowano — przeladuj strone aby zakonczyc", "ok");
    }
    async function fetchVersions(spec) {
      const repo = spec.split("@")[0];
      if (!repo.includes("/")) return;
      setVersionSpec(spec);
      setLoadingVersions(true);
      setVersions([]);
      try {
        const tags = await fetch(`${STORE_URL}/tags/${repo}`).then((r) => r.json());
        setVersions(tags);
      } catch {
        sdk.log("Nie udalo sie pobrac wersji", "error");
      } finally {
        setLoadingVersions(false);
      }
    }
    async function changeVersion(oldSpec, tag) {
      const repo = oldSpec.split("@")[0];
      const newSpec = `${repo}@${tag}`;
      const saved = await getSaved();
      const next = saved.map((s) => s === oldSpec ? newSpec : s);
      await setSaved(next);
      setInstalled(next);
      const oldLabel = store.get(`__label:${oldSpec}`);
      if (oldLabel) {
        store.add("meta", { label: oldLabel.data.label }, { id: `__label:${newSpec}` });
        store.remove(`__label:${oldSpec}`);
      }
      setVersionSpec(null);
      sdk.log(`Zmieniono na ${newSpec} — przeladuj strone`, "ok");
    }
    function stripHtml(html) {
      const div = document.createElement("div");
      div.innerHTML = html;
      return div.textContent ?? "";
    }
    function buyPlugin(p, email) {
      const existing = store.get("__pending_purchase");
      if (existing) store.update("__pending_purchase", { email });
      else store.add("meta", { email }, { id: "__pending_purchase" });
      const returnUrl = encodeURIComponent(window.location.origin + window.location.pathname);
      window.location.href = p.buyUrl + "?checkout[custom][redirect_url]=" + returnUrl + "&checkout[email]=" + encodeURIComponent(email);
    }
    function pluginAction(p) {
      const spec = `store://${p.id}`;
      const isInstalled = installed.includes(spec);
      if (isInstalled) {
        return /* @__PURE__ */ jsx(ui.Button, { color: "error", size: "xs", outline: true, onClick: () => uninstallSpec(spec), children: "Odinstaluj" });
      }
      if (p.price === 0 || hasLicense) {
        return /* @__PURE__ */ jsx(ui.Button, { size: "xs", onClick: () => installSpec(spec), children: "Dodaj" });
      }
      return /* @__PURE__ */ jsxs(ui.Button, { size: "xs", onClick: () => setBuyingId(p.id), children: [
        "Kup ",
        p.priceFormatted
      ] });
    }
    return /* @__PURE__ */ jsxs(ui.Page, { children: [
      /* @__PURE__ */ jsxs(ui.Card, { title: activating ? "Aktywacja zakupu..." : "Dodaj nowy plugin", children: [
        /* @__PURE__ */ jsxs(ui.Row, { children: [
          /* @__PURE__ */ jsx(
            ui.Input,
            {
              placeholder: "Szukaj pluginu...",
              value: search,
              onChange: (e) => setSearch(e.target.value),
              onKeyDown: (e) => {
                if (e.key === "Enter" && search.includes("/")) installSpec(search);
              }
            }
          ),
          search.includes("/") && /* @__PURE__ */ jsx(ui.Button, { onClick: () => installSpec(search), children: "Zainstaluj" })
        ] }),
        /* @__PURE__ */ jsx(ui.Stack, { children: filtered.map((p) => /* @__PURE__ */ jsxs(React.Fragment, { children: [
          /* @__PURE__ */ jsx(
            ui.ListItem,
            {
              label: p.name,
              detail: stripHtml(p.description) + (p.price > 0 ? " · " + p.priceFormatted : " · Darmowy"),
              action: pluginAction(p)
            }
          ),
          buyingId === p.id && /* @__PURE__ */ jsxs(ui.Row, { children: [
            /* @__PURE__ */ jsx(
              ui.Input,
              {
                placeholder: "Twoj email",
                value: buyEmail,
                onChange: (e) => setBuyEmail(e.target.value),
                onKeyDown: (e) => {
                  if (e.key === "Enter" && buyEmail.includes("@")) buyPlugin(p, buyEmail);
                }
              }
            ),
            /* @__PURE__ */ jsx(ui.Button, { onClick: () => buyPlugin(p, buyEmail), disabled: !buyEmail.includes("@"), children: "Przejdz do platnosci" })
          ] })
        ] }, p.id)) })
      ] }),
      myPlugins.length > 0 && /* @__PURE__ */ jsx(ui.Card, { title: "Zainstalowane pluginy", children: /* @__PURE__ */ jsx(ui.Stack, { children: myPlugins.map((p) => {
        const isGh = p.spec.includes("/") && !p.spec.startsWith("store://");
        const currentRef = p.spec.split("@")[1] ?? "main";
        return /* @__PURE__ */ jsxs(React.Fragment, { children: [
          /* @__PURE__ */ jsx(
            ui.ListItem,
            {
              label: p.label,
              detail: isGh ? currentRef : void 0,
              action: /* @__PURE__ */ jsxs(ui.Row, { children: [
                isGh && /* @__PURE__ */ jsx(ui.Button, { size: "xs", outline: true, onClick: () => versionSpec === p.spec ? setVersionSpec(null) : fetchVersions(p.spec), children: "Zmien wersje" }),
                /* @__PURE__ */ jsx(ui.Button, { color: "error", size: "xs", outline: true, onClick: () => uninstallSpec(p.spec), children: "Odinstaluj" })
              ] })
            }
          ),
          versionSpec === p.spec && /* @__PURE__ */ jsx(ui.Row, { children: loadingVersions ? /* @__PURE__ */ jsx("span", { children: "Ladowanie..." }) : versions.length === 0 ? /* @__PURE__ */ jsx("span", { children: "Brak tagow" }) : /* @__PURE__ */ jsxs("select", { onChange: (e) => e.target.value && changeVersion(p.spec, e.target.value), style: { padding: "4px 8px" }, children: [
            /* @__PURE__ */ jsx("option", { value: "", children: "Wybierz wersje..." }),
            /* @__PURE__ */ jsx("option", { value: "main", children: "main (najnowsza)" }),
            versions.map((v) => /* @__PURE__ */ jsx("option", { value: v, children: v }, v))
          ] }) })
        ] }, p.spec);
      }) }) })
    ] });
  }
  function Footer() {
    const tofu = store.usePosts("_integrity");
    return /* @__PURE__ */ jsxs(ui.Button, { size: "xs", color: "warning", outline: true, onClick: async () => {
      let count = 0;
      for (const p of tofu) {
        try {
          await store.remove(p.id);
          count++;
        } catch {
        }
      }
      sdk.log(`Wyczyszczono TOFU (${count}) — przeladuj strone`, "ok");
    }, children: [
      "Resetuj TOFU (",
      tofu.length,
      ")"
    ] });
  }
  function setup() {
    var _a;
    const auth = store.get(AUTH_ID);
    if ((_a = auth == null ? void 0 : auth.data) == null ? void 0 : _a.licenseKey) {
      sdk.setStoreAuth({ licenseKey: auth.data.licenseKey });
    }
    getSaved().then((specs) => {
      for (const s of specs) sdk.loadPlugin(s);
    });
  }
  sdk.registerView("manager.center", { slot: "center", component: Center });
  sdk.registerView("manager.footer", { slot: "footer", component: Footer });
  return {
    id: "manager",
    label: "Pluginy",
    version: "0.5.0",
    description: "Sklep pluginow",
    icon: icons.Package,
    setup
  };
};
export {
  plugin as default
};
