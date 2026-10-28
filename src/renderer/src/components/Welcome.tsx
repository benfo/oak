import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { api, errorMessage } from '../api'
import { openFolder, pickAndOpen } from '../repoActions'
import { relativeTime } from '../lib/format'
import { handleListNav, handleNavigation, revealActive } from '../lib/navigation'
import { useNavigation } from '../lib/useNavigation'
import { useShortcutScope } from '../lib/useShortcuts'
import { createStore, Modal, toast } from '../ui'
import { Icon } from './Icon'
import { Tip } from './Tip'
import type { RecentRepo } from '../../../shared/types'
import oakIcon from '../../../../build/icon.svg'

export function Welcome({ onOpen }: { onOpen: (repo: string) => void }) {
  const paneKeys = useNavigation()
  const [recent, setRecent] = useState<RecentRepo[]>([])
  const [filter, setFilter] = useState('')
  const [version, setVersion] = useState('')
  useEffect(() => {
    api.appVersion().then(setVersion)
  }, [])
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLUListElement>(null)
  const filterRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.recentRepos().then((list) => {
      setRecent(list)
      // Land on the list so arrows + Enter work immediately.
      if (list.length) setTimeout(() => listRef.current?.focus(), 0)
    })
  }, [])

  const open = async (p: string | null) => {
    if (p) onOpen(p)
  }
  const remove = async (p: string) => {
    await api.removeRecent(p)
    setRecent(await api.recentRepos())
  }

  const shown = recent.filter((r) => (r.name + r.path).toLowerCase().includes(filter.toLowerCase()))
  useEffect(() => setActive((a) => Math.min(a, Math.max(0, shown.length - 1))), [shown.length])
  useEffect(() => revealActive(listRef.current), [active])

  return (
    <div className="welcome">
      <div className="titlebar-drag" />
      <div className="welcome-inner">
        <div className="brand">
          <img className="brand-logo" src={oakIcon} alt="" />
          <div>
            <h1>oak</h1>
            <p>
              A modern Git client<span className="app-version">v{version}</span>
            </p>
          </div>
        </div>

        <div className="welcome-actions">
          <button className="action-card" onClick={async () => open(await pickAndOpen())}>
            <Icon name="folder" size={20} />
            <span>Open repository</span>
            <small>Ctrl+O</small>
          </button>
          <button className="action-card" onClick={() => openCloneDialog('', onOpen)}>
            <Icon name="download" size={20} />
            <span>Clone repository</span>
            <small>From a URL</small>
          </button>
          <button
            className="action-card"
            onClick={async () => {
              const dir = await api.pickFolder('Choose a folder for the new repository')
              if (!dir) return
              try {
                open(await api.initRepo(dir))
              } catch (e) {
                toast.error(errorMessage(e))
              }
            }}
          >
            <Icon name="plus" size={20} />
            <span>New repository</span>
            <small>git init</small>
          </button>
        </div>

        <div className="recent">
          <div className="recent-head">
            <h3>Recent repositories</h3>
            {recent.length > 0 && (
              <input
                ref={filterRef}
                className="input small"
                placeholder="Filter… (/ or Ctrl+F)"
                value={filter}
                spellCheck={false}
                onChange={(e) => setFilter(e.target.value)}
                onKeyDown={(e) => {
                  const leave = () => {
                    setActive(0)
                    listRef.current?.focus()
                  }
                  if (
                    handleNavigation(
                      e,
                      {
                        activate: leave,
                        dismiss: () => {
                          setFilter('')
                          leave()
                        }
                      },
                      { allowTextInput: true }
                    )
                  )
                    return
                  if (e.key === 'ArrowDown' && !e.nativeEvent.isComposing && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
                    e.preventDefault()
                    leave()
                  }
                }}
              />
            )}
          </div>
          {shown.length === 0 && <p className="muted">{recent.length ? 'No matches.' : 'Repositories you open will show up here.'}</p>}
          <ul
            ref={listRef}
            tabIndex={shown.length ? 0 : -1}
            data-pane="recent"
            aria-label="Recent repositories, Enter to open, Delete to remove"
            onKeyDownCapture={(e) =>
              paneKeys(e, () => {
                filterRef.current?.focus()
                filterRef.current?.select()
              })
            }
            onKeyDown={async (e) => {
              if (handleListNav(e, shown.length, active, setActive)) return
              const r = shown[active]
              handleNavigation(e, {
                activate: r
                  ? async () => {
                      open(await openFolder(r.path))
                    }
                  : undefined,
                discard: r
                  ? () => {
                      remove(r.path)
                    }
                  : undefined
              })
            }}
          >
            {shown.map((r, i) => (
              <li
                key={r.path}
                className={i === active ? 'active' : ''}
                onMouseDown={() => setActive(i)}
                onClick={async () => open(await openFolder(r.path))}
              >
                <Icon name="folder" />
                <div className="recent-text">
                  <strong>{r.name}</strong>
                  <span>{r.path}</span>
                </div>
                <span className="muted small">{relativeTime(r.lastOpened)}</span>
                <Tip label="Remove from list" keys="Delete" placement="left">
                  <button
                    className="icon-btn"
                    tabIndex={-1}
                    aria-label="Remove from list"
                    onClick={(e) => {
                      e.stopPropagation()
                      remove(r.path)
                    }}
                  >
                    <Icon name="x" size={14} />
                  </button>
                </Tip>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <WelcomeShortcuts onOpen={open} />
    </div>
  )
}

function WelcomeShortcuts({ onOpen }: { onOpen: (p: string | null) => void }) {
  useShortcutScope({
    id: 'welcome',
    priority: 10,
    bindings: [{ id: 'open-repo', keys: 'Mod+O', allowInInput: true, run: async () => onOpen(await pickAndOpen()) }]
  })
  return null
}

/** The repository name a clone URL implies (`…/oak.git` → `oak`). */
const guessName = (u: string) =>
  u
    .trim()
    .replace(/\/+$/, '')
    .split(/[/:]/)
    .pop()
    ?.replace(/\.git$/, '') ?? ''

// Clone can be started from the welcome screen or the repository picker (paste a URL there).
const cloneStore = createStore<{ url: string; onCloned: (p: string) => void } | null>(null)
export const openCloneDialog = (url: string, onCloned: (p: string) => void) => cloneStore.set({ url, onCloned })

export function CloneHost() {
  const req = useSyncExternalStore(cloneStore.subscribe, cloneStore.get)
  if (!req) return null
  const close = () => cloneStore.set(null)
  return (
    <CloneDialog
      initialUrl={req.url}
      onClose={close}
      onCloned={(p) => {
        close()
        req.onCloned(p)
      }}
    />
  )
}

function CloneDialog({ initialUrl, onClose, onCloned }: { initialUrl: string; onClose: () => void; onCloned: (p: string) => void }) {
  const [url, setUrl] = useState(initialUrl)
  const [parent, setParent] = useState(() => localStorage.getItem('cloneParent') ?? '')
  const [name, setName] = useState(() => guessName(initialUrl))
  const [nameTouched, setNameTouched] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    try {
      localStorage.setItem('cloneParent', parent)
      onCloned(await api.cloneRepo(url.trim(), parent, name.trim()))
    } catch (e) {
      toast.error(errorMessage(e))
      setBusy(false)
    }
  }

  return (
    <Modal title="Clone repository" onClose={() => !busy && onClose()} width={520}>
      <label className="field">
        <span>Repository URL</span>
        <input
          autoFocus
          value={url}
          spellCheck={false}
          placeholder="https://github.com/user/repo.git"
          onChange={(e) => {
            setUrl(e.target.value)
            if (!nameTouched) setName(guessName(e.target.value))
          }}
        />
      </label>
      <label className="field">
        <span>Clone into</span>
        <div className="input-row">
          <input value={parent} spellCheck={false} onChange={(e) => setParent(e.target.value)} placeholder="C:\dev" />
          <button
            className="btn"
            onClick={async () => {
              const d = await api.pickFolder('Clone into')
              if (d) setParent(d)
            }}
          >
            Browse…
          </button>
        </div>
      </label>
      <label className="field">
        <span>Folder name</span>
        <input
          value={name}
          spellCheck={false}
          onChange={(e) => {
            setName(e.target.value)
            setNameTouched(true)
          }}
        />
      </label>
      <div className="modal-actions">
        {busy && (
          <span className="busy">
            <span className="spinner" /> Cloning…
          </span>
        )}
        <button className="btn" disabled={busy} onClick={onClose}>
          Cancel
        </button>
        <button className="btn primary" disabled={busy || !url.trim() || !parent.trim() || !name.trim()} onClick={submit}>
          Clone
        </button>
      </div>
    </Modal>
  )
}
