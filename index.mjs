import { jsxs, jsx } from "react/jsx-runtime";
const REGISTRY_URL = "https://raw.githubusercontent.com/obieg-zero/plugin-registry/main/index.json";
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
    const [spec, setSpec] = useState("");
    const [installed, setInstalled] = useState([]);
    const [registry, setRegistry] = useState([]);
    useEffect(() => {
      getSaved().then(setInstalled);
    }, [plugins.length]);
    useEffect(() => {
      fetch(REGISTRY_URL).then((r) => r.json()).then((data) => setRegistry(data.plugins ?? [])).catch(() => sdk.log("Nie udało się pobrać katalogu pluginów", "error"));
    }, []);
    const loadedIds = useMemo(() => new Set(plugins.map((p) => p.id)), [plugins]);
    const isSearch = spec.trim() && !spec.includes("/");
    const filtered = useMemo(() => {
      if (!isSearch) return [];
      const q = spec.toLowerCase();
      return registry.filter(
        (e) => !loadedIds.has(e.id) && (e.label.toLowerCase().includes(q) || e.id.toLowerCase().includes(q) || (e.description ?? "").toLowerCase().includes(q) || (e.tags ?? []).some((t) => t.includes(q)))
      );
    }, [registry, spec, loadedIds, isSearch]);
    function specForPlugin(p) {
      return installed.find((s) => s.endsWith(p.id) || s.endsWith("plugin-" + p.id) || s.includes(p.id));
    }
    async function installSpec(s) {
      s = s.trim();
      if (!s) return;
      await sdk.loadPlugin(s);
      const saved = await getSaved();
      if (!saved.includes(s)) {
        const next = [...saved, s];
        await setSaved(next);
        setInstalled(next);
      }
      setSpec("");
      sdk.log("Zainstalowano: " + s, "ok");
    }
    async function uninstall(id) {
      const pluginSpec = specForPlugin({ id });
      sdk.unregisterPlugin(id);
      if (pluginSpec) {
        const next = (await getSaved()).filter((s) => s !== pluginSpec);
        await setSaved(next);
        setInstalled(next);
      }
      sdk.log("Odinstalowano: " + id, "ok");
    }
    return /* @__PURE__ */ jsxs(ui.Page, { children: [
      /* @__PURE__ */ jsxs(ui.Card, { title: "Zainstaluj plugin", children: [
        /* @__PURE__ */ jsxs(ui.Row, { children: [
          /* @__PURE__ */ jsx(
            ui.Input,
            {
              placeholder: "Szukaj lub wpisz org/repo@branch",
              value: spec,
              onChange: (e) => setSpec(e.target.value),
              onKeyDown: (e) => {
                if (e.key === "Enter" && spec.includes("/")) installSpec(spec);
              }
            }
          ),
          spec.includes("/") && /* @__PURE__ */ jsx(ui.Button, { onClick: () => installSpec(spec), children: "Zainstaluj" })
        ] }),
        isSearch && filtered.length > 0 && /* @__PURE__ */ jsx(ui.Stack, { children: filtered.map((entry) => /* @__PURE__ */ jsx(
          ui.ListItem,
          {
            label: entry.label,
            detail: (entry.version ? "v" + entry.version + " · " : "") + (entry.description ?? ""),
            action: /* @__PURE__ */ jsx(ui.Button, { size: "xs", onClick: () => setSpec(entry.repo + "@main"), children: "Wybierz" })
          },
          entry.id
        )) })
      ] }),
      /* @__PURE__ */ jsx(ui.Card, { title: `Załadowane (${plugins.length})`, children: /* @__PURE__ */ jsx(ui.Stack, { children: plugins.map((p) => {
        const fromSpec = specForPlugin(p);
        return /* @__PURE__ */ jsx(
          ui.ListItem,
          {
            label: p.label,
            detail: p.id + (p.version ? " v" + p.version : "") + (p.description ? " · " + p.description : ""),
            action: !fromSpec ? /* @__PURE__ */ jsx(ui.Badge, { color: "ghost", children: "config" }) : /* @__PURE__ */ jsx(ui.Button, { color: "error", size: "xs", outline: true, onClick: () => uninstall(p.id), children: "Odinstaluj" })
          },
          p.id
        );
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
      sdk.log(`Wyczyszczono TOFU (${count}) — przeładuj stronę`, "ok");
    }, children: [
      "Resetuj TOFU (",
      tofu.length,
      ")"
    ] });
  }
  function setup() {
    getSaved().then((specs) => {
      for (const s of specs) sdk.loadPlugin(s);
    });
  }
  sdk.registerView("manager.center", { slot: "center", component: Center });
  sdk.registerView("manager.footer", { slot: "footer", component: Footer });
  return {
    id: "manager",
    label: "Plugins",
    version: "0.2.0",
    description: "Install and manage plugins",
    icon: icons.Package,
    setup
  };
};
export {
  plugin as default
};
