import type { PluginFactory } from '@obieg-zero/sdk'

type RegistryEntry = {
  id: string; label: string; description?: string; version?: string;
  repo: string; requires?: string[]; tags?: string[]
}

const REGISTRY_URL = 'https://raw.githubusercontent.com/obieg-zero/plugin-registry/main/index.json'

const plugin: PluginFactory = ({ React, ui, icons, store, sdk }) => {
  const { useState, useEffect, useMemo } = React

  const STORE_ID = '__plugin-manager'

  async function getSaved(): Promise<string[]> {
    return (await store.get(STORE_ID))?.data?.specs ?? []
  }

  async function setSaved(specs: string[]) {
    const existing = await store.get(STORE_ID)
    if (existing) await store.update(STORE_ID, { specs })
    else await store.add('meta', { specs }, { id: STORE_ID })
  }

  function Center() {
    const plugins = sdk.getAllPlugins()
    const [spec, setSpec] = useState('')
    const [installed, setInstalled] = useState<string[]>([])
    const [registry, setRegistry] = useState<RegistryEntry[]>([])

    useEffect(() => { getSaved().then(setInstalled) }, [plugins.length])

    useEffect(() => {
      fetch(REGISTRY_URL)
        .then(r => r.json())
        .then(data => setRegistry(data.plugins ?? []))
        .catch(() => sdk.log('Nie udało się pobrać katalogu pluginów', 'error'))
    }, [])

    const loadedIds = useMemo(() => new Set(plugins.map(p => p.id)), [plugins])

    const isSearch = spec.trim() && !spec.includes('/')

    const filtered = useMemo(() => {
      if (!isSearch) return []
      const q = spec.toLowerCase()
      return registry.filter(e =>
        !loadedIds.has(e.id) && (
          e.label.toLowerCase().includes(q) ||
          e.id.toLowerCase().includes(q) ||
          (e.description ?? '').toLowerCase().includes(q) ||
          (e.tags ?? []).some(t => t.includes(q))
        )
      )
    }, [registry, spec, loadedIds, isSearch])

    function specForPlugin(p: { id: string }) {
      return installed.find(s => s.endsWith(p.id) || s.endsWith('plugin-' + p.id) || s.includes(p.id))
    }

    async function installSpec(s: string) {
      s = s.trim()
      if (!s) return
      await sdk.loadPlugin(s)
      const saved = await getSaved()
      if (!saved.includes(s)) {
        const next = [...saved, s]
        await setSaved(next)
        setInstalled(next)
      }
      setSpec('')
      sdk.log('Zainstalowano: ' + s, 'ok')
    }

    async function uninstall(id: string) {
      const pluginSpec = specForPlugin({ id })
      sdk.unregisterPlugin(id)
      if (pluginSpec) {
        const next = (await getSaved()).filter(s => s !== pluginSpec)
        await setSaved(next)
        setInstalled(next)
      }
      sdk.log('Odinstalowano: ' + id, 'ok')
    }

    return (
      <ui.Page>
        <ui.Card title="Zainstaluj plugin">
          <ui.Row>
            <ui.Input
              placeholder="Szukaj lub wpisz org/repo@branch"
              value={spec}
              onChange={e => setSpec(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && spec.includes('/')) installSpec(spec) }}
            />
            {spec.includes('/') && <ui.Button onClick={() => installSpec(spec)}>Zainstaluj</ui.Button>}
          </ui.Row>
          {isSearch && filtered.length > 0 && (
            <ui.Stack>
              {filtered.map(entry => (
                <ui.ListItem
                  key={entry.id}
                  label={entry.label}
                  detail={(entry.version ? 'v' + entry.version + ' · ' : '') + (entry.description ?? '')}
                  action={<ui.Button size="xs" onClick={() => setSpec(entry.repo + '@main')}>Wybierz</ui.Button>}
                />
              ))}
            </ui.Stack>
          )}
        </ui.Card>

        <ui.Card title={`Załadowane (${plugins.length})`}>
          <ui.Stack>
            {plugins.map(p => {
              const fromSpec = specForPlugin(p)
              return (
                <ui.ListItem
                  key={p.id}
                  label={p.label}
                  detail={p.id + (p.version ? ' v' + p.version : '') + (p.description ? ' · ' + p.description : '')}
                  action={!fromSpec
                    ? <ui.Badge color="ghost">config</ui.Badge>
                    : <ui.Button color="error" size="xs" outline onClick={() => uninstall(p.id)}>Odinstaluj</ui.Button>
                  }
                />
              )
            })}
          </ui.Stack>
        </ui.Card>
      </ui.Page>
    )
  }

  function Footer() {
    const tofu = store.usePosts('_integrity')
    return (
      <ui.Button size="xs" color="warning" outline onClick={async () => {
        let count = 0
        for (const p of tofu) {
          try { await store.remove(p.id); count++ } catch {}
        }
        sdk.log(`Wyczyszczono TOFU (${count}) — przeładuj stronę`, 'ok')
      }}>Resetuj TOFU ({tofu.length})</ui.Button>
    )
  }

  function setup() {
    getSaved().then(specs => {
      for (const s of specs) sdk.loadPlugin(s)
    })
  }

  sdk.registerView('manager.center', { slot: 'center', component: Center })
  sdk.registerView('manager.footer', { slot: 'footer', component: Footer })

  return {
    id: 'manager',
    label: 'Plugins',
    version: '0.2.0',
    description: 'Install and manage plugins',
    icon: icons.Package,
    setup,
  }
}

export default plugin
