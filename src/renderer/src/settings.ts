import { useSyncExternalStore } from 'react'
import type { PullMode } from '../../shared/types'
import { api } from './api'
import type { DiffLayout } from './diff/diffLayout'

/** User preferences (Preferences dialog, Ctrl+,). Stored in localStorage; read anywhere with getSettings(). */
export interface Settings {
  /** Add plain hjkl alongside arrow navigation; explicit search is shared by both schemes. */
  vimNavigation: boolean
  /** Hide repository navigation without losing its width or current branch cursor. */
  sidebarHidden: boolean
  /** Page zoom, 1 = 100%. */
  zoom: number
  /** Ctrl+scroll (and touchpad pinch) steps the zoom level. */
  wheelZoom: boolean
  /** Font for diffs, hashes and code; empty = the built-in monospace stack. */
  codeFont: string
  /** Columns a tab character takes in diffs. */
  tabWidth: number
  /** Colour code in diffs by language (Shiki, in a worker). */
  syntaxHighlighting: boolean
  /** Draw spaces and tabs in diffs and blame (a dot per space, an arrow per tab). */
  showWhitespace: boolean
  /** Shared layout for working-tree and history diffs. */
  diffLayout: DiffLayout
  /** Changed files (History and working tree) as a folder tree instead of a flat list. */
  changesTree: boolean
  /** History's file list: only the files a commit changed, or every file in its snapshot. */
  /** Trace the checked-out branch's first-parent line and soften other graph lines. */
  emphasizeCurrentBranch: boolean
  /** Unchanged lines shown around each change in diffs (`git diff -U`). At least 1 so hunks stay stageable. */
  contextLines: number
  /** Offer "Open pull request" in the toast after pushing a new branch. */
  pullRequestPrompt: boolean
  /** What the Pull button does; 'default' follows git config (pull.rebase / pull.ff). */
  pullMode: PullMode
  /** Fetch all remotes in the background every N minutes; 0 = off. */
  autoFetchMinutes: number
  /** Warn when a commit subject is longer than this; 0 = no warning. */
  subjectLimit: number
  /** Add a Signed-off-by line to commits (`git commit --signoff`). */
  signoff: boolean
  /** Commit without asking when nothing is staged: stages tracked changes (new files only if nothing else changed). */
  autoStageOnCommit: boolean
  /** Remove remote-tracking branches that no longer exist on the remote when fetching. */
  fetchPrune: boolean
  /** The git executable; empty = "git" from PATH. */
  gitPath: string
  /** Where author pictures come from; initials are always the fallback. */
  avatars: AvatarSource
  /** Reopen the last repository on startup (otherwise start on the welcome screen). */
  reopenLastRepo: boolean
  /** Check for new versions of Oak in the background and download them. */
  autoUpdate: boolean
}

export const DEFAULTS: Settings = {
  vimNavigation: false,
  sidebarHidden: false,
  zoom: 1,
  wheelZoom: true,
  codeFont: '',
  tabWidth: 4,
  syntaxHighlighting: true,
  showWhitespace: false,
  diffLayout: 'auto',
  changesTree: false,
  emphasizeCurrentBranch: true,
  contextLines: 3,
  pullRequestPrompt: true,
  pullMode: 'default',
  autoFetchMinutes: 0,
  subjectLimit: 72,
  reopenLastRepo: true,
  autoUpdate: true,
  signoff: false,
  autoStageOnCommit: false,
  fetchPrune: true,
  gitPath: '',
  avatars: 'all'
}

/** all = GitHub and Gravatar (Gravatar gets a hash of each email); github = GitHub noreply addresses only. */
export type AvatarSource = 'all' | 'github' | 'off'

export const ZOOM_STEPS = [0.8, 0.9, 1, 1.1, 1.25, 1.5]
const MONO_STACK = "'Cascadia Code', 'Cascadia Mono', 'JetBrains Mono', Consolas, monospace"
const KEY = 'settings'

function load(): Settings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return DEFAULTS
  }
}

let current = load()
const subs = new Set<() => void>()

export const getSettings = () => current

export function updateSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(current))
  } catch {
    // applies for this session only
  }
  apply()
  subs.forEach((s) => s())
}

export function useSettings() {
  return useSyncExternalStore((s) => {
    subs.add(s)
    return () => void subs.delete(s)
  }, getSettings)
}

export function stepZoom(direction: 1 | -1 | 0) {
  if (direction === 0) return updateSettings({ zoom: 1 })
  const i = ZOOM_STEPS.findIndex((z) => z >= current.zoom - 0.001)
  const next = ZOOM_STEPS[Math.max(0, Math.min(ZOOM_STEPS.length - 1, (i < 0 ? ZOOM_STEPS.length - 1 : i) + direction))]
  updateSettings({ zoom: next })
}

/** Settings that take effect outside React: CSS variables, page zoom and the git executable. */
function apply() {
  const root = document.documentElement.style
  const font = current.codeFont.trim()
  if (font) root.setProperty('--mono', `${/[\s,'"]/.test(font) ? font : `'${font}'`}, ${MONO_STACK}`)
  else root.removeProperty('--mono')
  root.setProperty('--tab-size', String(current.tabWidth))
  window.bridge.setZoom(current.zoom)
  api.setGitPath(current.gitPath).catch(() => {})
  // The native title-bar buttons don't zoom, so the toolbar keeps their size in real pixels.
  root.setProperty('--zoom', String(current.zoom))
}

/** Call before the first render. */
export function initSettings() {
  apply()
}
