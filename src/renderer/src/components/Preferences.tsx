import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { Radio, RadioGroup, Tab, TabList, TabPanel, Tabs } from 'react-aria-components'
import { api, errorMessage } from '../api'
import type { Command } from '../commands'
import { allThemes, loadCustomThemes, previewTheme, setTheme, starterTheme, themeSetting, type Theme } from '../theme'
import { FILE_ICON_PACKS, type FileIconPackId } from '../fileIcons/packs'
import { DEFAULTS, stepZoom, updateSettings, useSettings, ZOOM_STEPS, type AvatarSource } from '../settings'
import { createStore, Modal, toast } from '../ui'
import { checkForUpdates, describeUpdate, installUpdate, useUpdateStatus } from '../updates'
import { DIFF_LAYOUTS, type DiffLayout } from '../diff/diffLayout'
import { changeDiffLayout } from '../diff/changeDiffLayout'
import { openWhatsNew } from './WhatsNew'
import { openRepoOrGlobalConfig } from '../lib/useGitConfig'
import { GitPage } from './GitPage'
import { RepositoryPage } from './RepositoryPage'
import { Field } from './prefsFields'
import { Tip } from './Tip'

const openStore = createStore(false)

const TABS = [
  // Everyday app behaviour first, then Git, diffs and looks.
  ['general', 'General'],
  ['git', 'Git'],
  ['repository', 'Repository'],
  ['diffs', 'Diffs'],
  ['appearance', 'Appearance'],
  ['themes', 'Themes']
] as const
type TabId = (typeof TABS)[number][0]
/** Reopens on the category used last (this session). */
let lastTab: TabId = 'general'

export function openPreferences(tab?: TabId) {
  if (tab) lastTab = tab
  // Pick up theme files added since launch, then open.
  loadCustomThemes().finally(() => openStore.set(true))
}

/** Shortcuts that work on every screen (handled in App.tsx; listed in the palette by RepoView). */
export const APP_COMMANDS: Command[] = [
  { id: 'whats-new', title: 'What’s new in Oak', category: 'General', run: () => openWhatsNew() },
  {
    id: 'preferences',
    title: 'Preferences…',
    category: 'General',
    keys: 'Ctrl+,',
    global: true,
    run: () => openPreferences()
  },
  {
    id: 'zoom-in',
    allowInOverlay: true,
    allowRepeat: true,
    title: 'Zoom in',
    category: 'View',
    keys: 'Ctrl+=',
    global: true,
    run: () => stepZoom(1)
  },
  {
    id: 'zoom-out',
    allowInOverlay: true,
    allowRepeat: true,
    title: 'Zoom out',
    category: 'View',
    keys: 'Ctrl+-',
    global: true,
    run: () => stepZoom(-1)
  },
  {
    id: 'zoom-reset',
    allowInOverlay: true,
    title: 'Reset zoom',
    category: 'View',
    keys: 'Ctrl+0',
    global: true,
    run: () => stepZoom(0)
  },
  {
    id: 'open-global-git-config',
    title: 'Open global git config',
    category: 'General',
    run: () => openRepoOrGlobalConfig(null, 'global')
  },
  {
    id: 'check-updates',
    title: 'Check for updates',
    category: 'General',
    run: () => {
      openPreferences('general')
      checkForUpdates()
    }
  }
]

export function PreferencesHost({ repo }: { repo: string | null }) {
  const open = useSyncExternalStore(openStore.subscribe, openStore.get)
  return open ? <Preferences repo={repo} onClose={() => openStore.set(false)} /> : null
}

/**
 * Settings apply as you change them. The theme previews as you move through the cards and is kept
 * with Enter or Close; Escape (or clicking outside) puts the previous theme back.
 */
function Preferences({ repo, onClose }: { repo: string | null; onClose: () => void }) {
  const opener = useRef(document.activeElement as HTMLElement | null)
  const s = useSettings()
  const [theme, setThemeState] = useState(themeSetting())
  const [, refreshThemes] = useState(0)
  const createTheme = async () => {
    try {
      const file = await api.createThemeFile(starterTheme())
      await loadCustomThemes()
      refreshThemes((n) => n + 1)
      toast.info(`Created ${file}`)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }
  const pickTheme = (id: string) => {
    setThemeState(id)
    previewTheme(id)
  }
  const done = () => {
    setTheme(theme)
    onClose()
  }
  const cancel = () => {
    previewTheme(null)
    onClose()
  }
  const num = (v: string) => Number(v)
  const [tab, setTab] = useState<TabId>(lastTab)

  // Start on the category list, so ↑↓ pick a category straight away and Tab goes into its page.
  const navRef = useRef<HTMLDivElement>(null)
  // (A frame later: React Aria focuses the dialog itself after our effects run.)
  useEffect(() => {
    const id = requestAnimationFrame(() => navRef.current?.querySelector<HTMLElement>('[role=tab][aria-selected=true]')?.focus())
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    // On the Themes page the backdrop clears, so you see the whole app in the theme you're trying.
    <Modal title="Preferences" onClose={cancel} width={780} overlayClassName={tab === 'themes' ? 'see-through' : undefined}>
      <Tabs orientation="vertical" className="prefs" selectedKey={tab} onSelectionChange={(k) => setTab((lastTab = k as TabId))}>
        <TabList aria-label="Categories" className="prefs-nav" ref={navRef}>
          {TABS.map(([id, label]) => (
            <Tab key={id} id={id} className="prefs-tab">
              {label}
            </Tab>
          ))}
        </TabList>
        <Section id="git" title="Git">
          <GitPage repo={repo} />
        </Section>

        <Section id="repository" title="Repository">
          <RepositoryPage />
        </Section>

        <Section id="diffs" title="Diffs">
          <Field label="Diff layout" hint="Automatic uses side by side when the diff pane has enough width">
            <select className="select" value={s.diffLayout} onChange={(e) => changeDiffLayout(e.target.value as DiffLayout)}>
              {DIFF_LAYOUTS.map((layout) => (
                <option key={layout.id} value={layout.id}>
                  {layout.label}
                </option>
              ))}
            </select>
          </Field>
          <label className="check">
            <input
              type="checkbox"
              checked={s.syntaxHighlighting}
              onChange={(e) => updateSettings({ syntaxHighlighting: e.target.checked })}
            />
            Syntax highlighting <span className="prefs-hint">colours set by the theme</span>
          </label>
          <label className="check">
            <input type="checkbox" checked={s.showWhitespace} onChange={(e) => updateSettings({ showWhitespace: e.target.checked })} />
            Show spaces and tabs <span className="prefs-hint">a dot per space, an arrow per tab</span>
          </label>
          <Field label="Context lines" hint="Unchanged lines shown around each change">
            <select className="select" value={s.contextLines} onChange={(e) => updateSettings({ contextLines: num(e.target.value) })}>
              {[1, 3, 5, 10, 25].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tab width">
            <select className="select" value={s.tabWidth} onChange={(e) => updateSettings({ tabWidth: num(e.target.value) })}>
              {[2, 4, 8].map((n) => (
                <option key={n} value={n}>
                  {n} spaces
                </option>
              ))}
            </select>
          </Field>
        </Section>

        <Section id="themes" title="Themes">
          {/* Enter on a card keeps that theme and closes, like Close. */}
          <div
            onKeyDownCapture={(e) => {
              if (e.key !== 'Enter') return
              e.preventDefault()
              done()
            }}
          >
            <RadioGroup aria-label="Theme" className="theme-grid" value={theme} onChange={pickTheme}>
              <Radio value="system" className="theme-card">
                <div className="theme-preview split">
                  <Preview theme={{ id: 'light', name: '', base: 'light' }} />
                  <Preview theme={{ id: 'dark', name: '', base: 'dark' }} />
                </div>
                <span className="theme-name">Follow system</span>
              </Radio>
              {allThemes().map((t) => (
                <Radio key={t.id} value={t.id} className="theme-card">
                  <div className="theme-preview">
                    <Preview theme={t} />
                  </div>
                  <span className="theme-name">{t.name}</span>
                </Radio>
              ))}
            </RadioGroup>
          </div>
          <p className="prefs-note">Arrow keys preview a theme. Enter or Close keeps it; Esc puts the previous one back.</p>
          <div className="prefs-row">
            <button className="btn" onClick={createTheme}>
              Create theme from current
            </button>
            <p className="prefs-note">
              Saves an editable copy of the selected theme in the{' '}
              <button className="link" onClick={() => api.openThemesFolder()}>
                custom themes folder
              </button>
              . Change its colours, then reopen Preferences to see the edits.
            </p>
          </div>
        </Section>

        <Section id="appearance" title="Appearance">
          <Field label="Zoom" hint="Ctrl+= and Ctrl+- also zoom, Ctrl+0 resets">
            <select className="select" value={s.zoom} onChange={(e) => updateSettings({ zoom: num(e.target.value) })}>
              {ZOOM_STEPS.map((z) => (
                <option key={z} value={z}>
                  {Math.round(z * 100)}%
                </option>
              ))}
            </select>
          </Field>
          <label className="check">
            <input type="checkbox" checked={s.wheelZoom} onChange={(e) => updateSettings({ wheelZoom: e.target.checked })} />
            Zoom with Ctrl+scroll
          </label>
          <Field
            label="File icons"
            hint="Shown beside files and folders in change lists and trees. Colour is based on Material Icon Theme (MIT)."
          >
            <select
              className="select"
              value={s.fileIcons}
              onChange={(e) => updateSettings({ fileIcons: e.target.value as FileIconPackId })}
            >
              {FILE_ICON_PACKS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Code font" hint="Diffs, hashes and the commit message. Leave empty for Cascadia Code / Consolas.">
            <input
              className="input"
              value={s.codeFont}
              placeholder="Cascadia Code"
              spellCheck={false}
              onChange={(e) => updateSettings({ codeFont: e.target.value })}
            />
          </Field>
        </Section>

        <Section id="general" title="General">
          <label className="check">
            <input type="checkbox" checked={s.vimNavigation} onChange={(e) => updateSettings({ vimNavigation: e.target.checked })} />
            Vim-style navigation
            <span className="prefs-hint">
              Adds h/j/k/l alongside arrow keys in lists, diffs and menus. In lists and diffs, Ctrl+D/U moves half a page and gg/G goes to
              the beginning/end. Both navigation styles use / or Ctrl+F to search a list. Text fields and searchable pickers keep normal
              typing.
            </span>
          </label>
          <label className="check">
            <input type="checkbox" checked={s.reopenLastRepo} onChange={(e) => updateSettings({ reopenLastRepo: e.target.checked })} />
            Reopen the last repository on startup
          </label>
          <Field
            label="Author pictures"
            hint="Initials are shown when there is no picture. Gravatar is sent a hash of each author's email."
          >
            <select className="select" value={s.avatars} onChange={(e) => updateSettings({ avatars: e.target.value as AvatarSource })}>
              <option value="all">GitHub and Gravatar</option>
              <option value="github">GitHub only</option>
              <option value="off">Off (initials only)</option>
            </select>
          </Field>
          <Updates autoUpdate={s.autoUpdate} />
          <About
            onWhatsNew={() => {
              flushSync(done)
              opener.current?.focus()
              openWhatsNew()
            }}
          />
        </Section>
      </Tabs>
      <div className="modal-actions">
        <Tip label="Resets Oak's own settings. Your git config (name, email, signing) is left as it is.">
          <button className="btn" onClick={() => updateSettings(DEFAULTS)}>
            Reset to defaults
          </button>
        </Tip>
        <span className="spacer" />
        <button className="btn primary" onClick={done}>
          Close
        </button>
      </div>
    </Modal>
  )
}

/** One category's page. */
function Section({ id, title, children }: { id: TabId; title: string; children: ReactNode }) {
  return (
    <TabPanel id={id} className="prefs-panel">
      <h3>{title}</h3>
      {children}
    </TabPanel>
  )
}

/** A miniature of the app in a theme: its own palette via data-theme plus the theme's overrides. */
function Preview({ theme }: { theme: Theme }) {
  const vars = Object.fromEntries(Object.entries(theme.colors ?? {}).map(([k, v]) => [`--${k.replace(/^--/, '')}`, v])) as CSSProperties
  return (
    <div className="tp" data-theme={theme.base} style={vars} aria-hidden>
      <div className="tp-side">
        <i />
        <i />
      </div>
      <div className="tp-main">
        <div className="tp-bar" />
        <div className="tp-line ctx" />
        <div className="tp-line del" />
        <div className="tp-line add" />
        <div className="tp-line ctx short" />
        <div className="tp-btn" />
      </div>
    </div>
  )
}

function Updates({ autoUpdate }: { autoUpdate: boolean }) {
  const s = useUpdateStatus()
  const busy = s.state === 'checking' || s.state === 'downloading'
  return (
    <>
      <h4>Updates</h4>
      <label className="check">
        <input type="checkbox" checked={autoUpdate} onChange={(e) => updateSettings({ autoUpdate: e.target.checked })} />
        Check for updates automatically and download them in the background
      </label>
      <div className="prefs-row">
        {s.state === 'ready' ? (
          <button className="btn primary" onClick={installUpdate}>
            Restart to update
          </button>
        ) : (
          <button className="btn" disabled={busy || s.state === 'unsupported'} onClick={checkForUpdates}>
            Check now
          </button>
        )}
        {/* Reserved line, so the status appearing doesn't move anything. */}
        <span className="prefs-note">{describeUpdate(s) || ' '}</span>
      </div>
    </>
  )
}

/** Version info, so testers can say which build they're on. */
function About({ onWhatsNew }: { onWhatsNew: () => void }) {
  const [version, setVersion] = useState('')
  const [git, setGit] = useState('')
  useEffect(() => {
    api.appVersion().then(setVersion)
    api.gitInfo().then((i) => setGit(i.version ?? `git not found (${i.error})`))
  }, [])
  return (
    <>
      <h4>About</h4>
      <p className="prefs-note about">
        Oak {version} · {git} · Electron {window.bridge.versions.electron}
      </p>
      <button className="btn" onClick={onWhatsNew}>
        What’s new
      </button>
    </>
  )
}
