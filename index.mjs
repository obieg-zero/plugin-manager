import { jsxs, jsx } from "react/jsx-runtime";
const STORE_URL = "https://obieg-zero-store.gotoreadyai.workers.dev";
const productsPromise = fetch(`${STORE_URL}/products`).then((r) => r.json()).catch(() => []);
const stripHtml = (html) => html.replace(/<[^>]*>/g, "");
const plugin = ({ React, ui, icons, store, sdk }) => {
  const { useState, useEffect, useMemo } = React;
  function Center() {
    const plugins = sdk.getAllPlugins();
    const [installed, setInstalled] = useState([]);
    const [products, setProducts] = useState([]);
    const [search, setSearch] = useState("");
    const [licensedProducts, setLicensedProducts] = useState(/* @__PURE__ */ new Set());
    const [activating, setActivating] = useState(false);
    const [versionSpec, setVersionSpec] = useState(null);
    const [versions, setVersions] = useState([]);
    const [loadingVersions, setLoadingVersions] = useState(false);
    const reload = () => sdk.getInstalledPlugins().then(setInstalled);
    useEffect(() => {
      reload();
    }, []);
    useEffect(() => {
      productsPromise.then(setProducts);
    }, []);
    useEffect(() => {
      const auth = sdk.getStoreAuth();
      if (!(auth == null ? void 0 : auth.licenseKey)) return;
      fetch(`${STORE_URL}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseKey: auth.licenseKey })
      }).then((r) => r.json()).then((d) => {
        if (d.productId) setLicensedProducts((prev) => /* @__PURE__ */ new Set([...prev, d.productId]));
      }).catch(() => sdk.log("Nie udalo sie zweryfikowac licencji", "error"));
    }, []);
    useEffect(() => {
      const params = new URLSearchParams(window.location.search);
      const productId = params.get("product_id");
      const checkoutId = params.get("checkout_id");
      if (!productId || !checkoutId) return;
      window.history.replaceState({}, "", window.location.pathname);
      sdk.setStoreAuth({ licenseKey: checkoutId });
      setLicensedProducts((prev) => /* @__PURE__ */ new Set([...prev, productId]));
      setActivating(true);
      installSpec(`store://${productId}`).then(() => sdk.log("Plugin zainstalowany po zakupie", "ok")).catch(() => sdk.log("Blad instalacji po zakupie", "error")).finally(() => setActivating(false));
    }, []);
    const installedSpecs = useMemo(() => new Set(installed.map((p) => p.spec)), [installed]);
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
        const productId = s.startsWith("store://") ? s.slice(8) : null;
        const product = productId ? (await productsPromise).find((p) => p.id === productId) : null;
        await sdk.installPlugin(s, product == null ? void 0 : product.name);
        await reload();
        sdk.log("Zainstalowano: " + s, "ok");
      } finally {
        sdk.useHostStore.setState({ progress: false });
      }
    }
    async function uninstallSpec(spec) {
      await sdk.uninstallPlugin(spec);
      await reload();
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
      const newSpec = `${oldSpec.split("@")[0]}@${tag}`;
      await sdk.uninstallPlugin(oldSpec);
      await sdk.installPlugin(newSpec);
      await reload();
      setVersionSpec(null);
      sdk.log(`Zmieniono na ${newSpec} — przeladuj strone`, "ok");
    }
    async function buyPlugin(p) {
      try {
        const res = await fetch(`${STORE_URL}/checkout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId: p.id, successUrl: window.location.origin + window.location.pathname })
        });
        const data = await res.json();
        if (data.checkoutUrl) window.location.href = data.checkoutUrl;
        else sdk.log(data.error || "Blad tworzenia platnosci", "error");
      } catch {
        sdk.log("Blad polaczenia ze sklepem", "error");
      }
    }
    function pluginAction(p) {
      const spec = `store://${p.id}`;
      const isInstalled = installedSpecs.has(spec);
      const isLoaded = plugins.some((pl) => pl.id === p.pluginId);
      if (isInstalled || isLoaded) return /* @__PURE__ */ jsxs(ui.Row, { children: [
        licensedProducts.has(p.id) && /* @__PURE__ */ jsx(ui.Badge, { color: "success", children: "Licencja" }),
        /* @__PURE__ */ jsx(ui.Badge, { children: "Zainstalowany" }),
        isInstalled && /* @__PURE__ */ jsx(ui.Button, { color: "error", size: "xs", outline: true, onClick: () => uninstallSpec(spec), children: "Odinstaluj" })
      ] });
      if (licensedProducts.has(p.id)) return /* @__PURE__ */ jsxs(ui.Row, { children: [
        /* @__PURE__ */ jsx(ui.Badge, { color: "success", children: "Licencja" }),
        /* @__PURE__ */ jsx(ui.Button, { size: "xs", onClick: () => installSpec(spec), children: "Dodaj" })
      ] });
      if (p.price === 0) return /* @__PURE__ */ jsx(ui.Button, { size: "xs", onClick: () => installSpec(spec), children: "Dodaj" });
      return /* @__PURE__ */ jsxs(ui.Button, { size: "xs", onClick: () => buyPlugin(p), children: [
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
        /* @__PURE__ */ jsx(ui.Stack, { children: filtered.map(
          (p) => /* @__PURE__ */ jsx(
            ui.ListItem,
            {
              label: p.name,
              detail: stripHtml(p.description) + (p.price > 0 ? " · " + p.priceFormatted : " · Darmowy"),
              action: pluginAction(p)
            },
            p.id
          )
        ) })
      ] }),
      installed.length > 0 && /* @__PURE__ */ jsx(ui.Card, { title: "Zainstalowane pluginy", children: /* @__PURE__ */ jsx(ui.Stack, { children: installed.map((p) => {
        const isGh = p.spec.includes("/") && !p.spec.startsWith("store://");
        const pluginDef = plugins.find((pl) => pl.id === p.spec.replace(/^store:\/\//, "").split("@")[0].split("/").pop());
        const ver = pluginDef == null ? void 0 : pluginDef.version;
        const detail = [ver && `v${ver}`, isGh && (p.spec.split("@")[1] ?? "main")].filter(Boolean).join(" · ");
        return /* @__PURE__ */ jsxs(React.Fragment, { children: [
          /* @__PURE__ */ jsx(
            ui.ListItem,
            {
              label: p.label,
              detail: detail || void 0,
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
    return /* @__PURE__ */ jsxs(ui.Button, { size: "xs", color: "warning", outline: true, onClick: () => {
      for (const p of tofu) store.remove(p.id);
      sdk.log(`Wyczyszczono TOFU (${tofu.length}) — przeladuj strone`, "ok");
    }, children: [
      "Resetuj TOFU (",
      tofu.length,
      ")"
    ] });
  }
  sdk.registerView("manager.center", { slot: "center", component: Center });
  sdk.registerView("manager.footer", { slot: "footer", component: Footer });
  return {
    id: "plugin-manager",
    label: "Pluginy",
    version: "0.7.0",
    description: "Sklep pluginow",
    icon: icons.Package
  };
};
export {
  plugin as default
};
