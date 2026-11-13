import { api, repoName } from './api'
import * as act from './actions'
import { openRecent, pickAndOpen } from './repoActions'
import type { RepoCtx } from './useRepo'
import type { Branch } from '../../shared/types'
import { openPalette } from './components/Palette'
import { openCloneDialog } from './components/Welcome'
import { notify } from './notices'
import { branchBadges } from './lib/branchBadges'

/*
 * The branch and repository pickers. They drop down from their toolbar button, whether opened by a
 * click or by Ctrl+B / Ctrl+P, so they always appear in the same place. Searchable and virtualized
 * (the palette engine), so thousands of branches stay instant. Actions live in a footer that never
 * scrolls away; typing something that matches nothing offers to create it.
 */

const toolbarButton = (selector: string) => document.querySelector(selector)
/** Keeps footer labels short; the full text is in the search box. */
const clip = (t: string) => (t.length > 28 ? `${t.slice(0, 27)}…` : t)

/** Picks a comparison target for `source` (null = the checked-out branch). */
export function showComparisonBranchPicker(r: RepoCtx, anchor: Element | null, source: Branch | null, onPick: (branch: Branch) => void) {
  if (waitForBranches(r, 'branches')) return
  const sourceName = source?.name ?? r.status?.branch
  openPalette({
    placeholder: `Compare ${sourceName ?? 'HEAD'} with…`,
    anchor,
    items: r.branches
      .filter((b) => b.type !== 'tag' && b.name !== sourceName)
      .map((b) => ({
        id: b.fullName,
        label: b.name,
        group: b.type === 'local' ? 'Local branches' : 'Remote branches',
        detail: `${b.hash.slice(0, 8)} · ${b.subject}`,
        run: () => onPick(b)
      }))
  })
}

export function showBranchPicker(r: RepoCtx, anchor: Element | null = toolbarButton('.tb-branch')) {
  if (waitForBranches(r, 'branches')) return
  const locals = r.branches.filter((b) => b.type === 'local')
  const localNames = new Set(locals.map((b) => b.name))
  // Remote branches without a local counterpart can be checked out as new tracking branches.
  const remotes = r.branches.filter((b) => b.type === 'remote' && !localNames.has(b.name.split('/').slice(1).join('/')))
  const newBranch = (name: string) => act.newBranch(r, undefined, undefined, name || undefined)
  openPalette({
    placeholder: 'Checkout branch…',
    anchor,
    recentIds: r.recentBranches.filter((name) => name !== r.status?.branch).map((name) => `refs/heads/${name}`),
    recentGroup: 'Recently used',
    items: [
      ...locals.map((b) => ({
        id: b.fullName,
        label: b.name,
        group: 'Local branches',
        current: b.current,
        detail: b.worktree ? `opens the worktree at ${b.worktree}` : b.subject,
        badges: branchBadges(b),
        run: () => !b.current && act.checkout(r, b.name, 'local')
      })),
      ...remotes.map((b) => ({
        id: b.fullName,
        label: b.name,
        group: 'Remote branches',
        detail: 'creates a tracking branch',
        run: () => act.checkout(r, b.name, 'remote')
      }))
    ],
    actions: [{ id: 'new', label: (t) => (t ? `New branch "${clip(t)}"…` : 'New branch…'), hint: 'Ctrl+Shift+B', run: newBranch }],
    whenNoMatch: (t) => (t && !act.validRefName(t) ? { label: `Create branch "${t}"…`, run: () => newBranch(t) } : null)
  })
}

const byVersion = new Intl.Collator(undefined, { numeric: true })

/** Tags, newest first (tag date, then version order for tags made at the same moment). */
export const tagsNewestFirst = (branches: Branch[]) =>
  branches.filter((b) => b.type === 'tag').sort((a, b) => b.date - a.date || byVersion.compare(b.name, a.name))

/** Every tag, searchable; picking one shows its commit in History. The sidebar lists only recent ones. */
export function showTagPicker(r: RepoCtx, focusCommit: (hash: string) => void, query = '') {
  if (waitForBranches(r, 'tags')) return
  openPalette({
    placeholder: 'Go to tag…',
    query,
    items: tagsNewestFirst(r.branches).map((b) => ({ id: b.fullName, label: b.name, detail: b.subject, run: () => focusCommit(b.hash) }))
  })
}

/** Something you'd clone from (https, ssh or git URL, or anything ending in .git). */
const isGitUrl = (t: string) => /^(https?:\/\/|ssh:\/\/|git:\/\/|git@)\S+$/i.test(t) || /\S+\.git$/i.test(t)

export async function showRepoPicker(
  current: string,
  onSwitch: (p: string | null) => void,
  anchor: Element | null = toolbarButton('.tb-repo')
) {
  const recents = await api.recentRepos()
  const clone = (url: string) => openCloneDialog(url, onSwitch)
  openPalette({
    placeholder: 'Switch repository…  (or paste a URL to clone)',
    anchor,
    items: recents.map((x) => ({
      id: x.path,
      label: repoName(x.path),
      detail: x.path,
      group: 'Recent repositories',
      current: x.path === current,
      run: async () => {
        // A recent repository can be gone by now (a removed worktree, a deleted folder): opening it says so.
        const opened = x.path === current ? null : await openRecent(x.path)
        if (opened && opened !== current) onSwitch(opened)
      }
    })),
    actions: [
      {
        id: 'open',
        label: () => 'Open…',
        hint: 'Ctrl+O',
        run: async () => {
          const p = await pickAndOpen()
          if (p) onSwitch(p)
        }
      },
      { id: 'clone', label: (t) => (isGitUrl(t) ? 'Clone this URL…' : 'Clone…'), run: (t) => clone(isGitUrl(t) ? t : '') },
      { id: 'close', label: () => 'Close repository', end: true, run: () => onSwitch(null) }
    ],
    whenNoMatch: (t) => (isGitUrl(t) ? { label: `Clone ${t}`, run: () => clone(t) } : null)
  })
}

/** Whether the branch and tag lists, with their ahead/behind counts, dates and subjects, are still arriving. */
export const branchListsLoading = (r: Pick<RepoCtx, 'refsLoaded' | 'detailsLoaded'>) => !r.refsLoaded || !r.detailsLoaded
/**
 * A picker opened over lists that have not fully arrived would look complete while missing entries, badges or
 * subjects, so it does not open yet. Returns true (with a note saying so) when it has to wait; menus need only the
 * lists, pickers also show the details.
 */
export function waitForBranches(r: RepoCtx, what: string, needDetails = true) {
  const loading = needDetails ? branchListsLoading(r) : !r.refsLoaded
  if (loading) notify.info(`Still loading ${what}…`)
  return loading
}
