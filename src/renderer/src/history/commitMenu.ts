import { copyText } from '../lib/copy'
import { copyRemoteLink, openOnRemote } from '../lib/openOnRemote'
import { isUnpushed, remoteItem } from '../lib/remoteMenu'
import { isBranchNotOnRemote } from '../../../shared/remote'
import { findBranch } from '../../../shared/refList'
import { showMenu } from '../api'
import * as act from '../actions'
import type { Branch, Commit, MenuItem, Ref } from '../../../shared/types'
import type { RepoCtx } from '../useRepo'
import { compareMenuItems, runCompareItem, showBranchMenu, type CompareBranch } from '../lib/branchMenu'
import { showTagMenu } from '../lib/tagMenu'
import { rewriteCommits } from '../rewriteActions'
import { waitForBranches } from '../pickers'
import { combineMenuItem } from './rewriteMenu'

/** A commit can carry thousands of refs; a menu lists the first few and says how many it left out. */
const MENU_REFS = 12
function capped<T>(list: T[]) {
  return list.slice(0, MENU_REFS)
}
const moreRow = (total: number): MenuItem[] =>
  total > MENU_REFS ? [{ id: 'more-refs', label: `${total - MENU_REFS} more branches not listed (use the sidebar)`, enabled: false }] : []

export async function commitMenu(r: RepoCtx, c: Commit, onCompare: CompareBranch, onCompareCommit: (c: Commit) => void) {
  if (waitForBranches(r, 'branches', false)) return
  const cur = r.status?.branch ?? 'HEAD'
  const isHead = c.hash === r.status?.head
  const locals = c.refs.filter((x) => x.type === 'local' && !x.current)
  const hasLocal = (name: string) => r.branches.some((b) => b.type === 'local' && b.name === name)
  const remotes = c.refs.filter((x) => x.type === 'remote' && !hasLocal(x.name.slice(x.name.indexOf('/') + 1)))
  // A branch another worktree holds cannot be checked out here: its item opens that worktree, and says so.
  const held = (name: string) => r.branches.some((b) => b.type === 'local' && b.name === name && b.worktree)
  const checkoutCandidates = [
    ...locals.map((x) =>
      held(x.name)
        ? { id: `co:${x.name}`, label: `${x.name} (open worktree)`, alone: `Open worktree of ${x.name}` }
        : { id: `co:${x.name}`, label: x.name, alone: `Checkout ${x.name}` }
    ),
    ...remotes.map((x) => ({ id: `cor:${x.name}`, label: `${x.name} as local branch`, alone: `Checkout ${x.name} as local branch` }))
  ]
  const checkouts: MenuItem[] = [
    ...capped(checkoutCandidates).map(({ id, label }) => ({ id, label })),
    ...moreRow(checkoutCandidates.length)
  ]
  const allTips = c.refs.flatMap((x) =>
    x.type === 'local' || x.type === 'remote' ? r.branches.filter((b) => b.type === x.type && b.name === x.name) : []
  )
  // A remote branch beside its same-named local one is the same line; offer only the local.
  const tips = allTips.filter(
    (t) => t.type === 'local' || !allTips.some((o) => o.type === 'local' && o.name === t.name.slice(t.name.indexOf('/') + 1))
  )
  const compares: MenuItem[] = []
  const compareItems = await Promise.all(capped(tips).map((tip) => compareMenuItems(r, tip, tips.length > 1)))
  capped(tips).forEach((tip, i) => {
    compares.push(...compareItems[i].map((item) => ({ ...item, id: `${tip.fullName}|${item.id}` })))
  })
  // Only commits that are a local branch tip get it, like the sidebar's branch menu.
  const prBranches = c.refs.filter((x) => x.type === 'local')
  const prItem = (x: Ref, label: string) => {
    const unpushedBranch = r.branches.some((b) => b.type === 'local' && b.name === x.name && isBranchNotOnRemote(b))
    return remoteItem(`pr:${x.name}`, label, unpushedBranch)
  }
  // One branch: a flat row. Several: one "Open pull request" submenu, so they never flood the menu.
  const pullRequests: MenuItem[] =
    prBranches.length > 1
      ? [{ label: 'Open pull request', submenu: [...capped(prBranches).map((x) => prItem(x, x.name)), ...moreRow(prBranches.length)] }]
      : prBranches.map((x) => prItem(x, 'Open pull request'))
  const unpushed = isUnpushed(r.path, c.hash)
  const detach: MenuItem = { id: 'detach', label: 'Checkout this commit (detached)' }
  const items: MenuItem[] = [
    ...(checkouts.length > 1
      ? [{ label: 'Checkout', submenu: [...checkouts, { type: 'separator' as const }, detach] }]
      : [...checkoutCandidates.map(({ id, alone }) => ({ id, label: alone })), detach]),
    { id: 'branch', label: 'New branch from here…' },
    { id: 'tag', label: 'New tag from here…' },
    { id: 'pick', label: `Cherry-pick onto ${cur}`, enabled: !isHead },
    {
      label: 'Merge / Rebase',
      enabled: !isHead,
      submenu: [
        { id: 'merge', label: `Merge into ${cur}` },
        { id: 'rebase', label: `Rebase ${cur} onto this` }
      ]
    },
    combineMenuItem(r, [c.hash]),
    { type: 'separator' },
    { label: 'Compare', submenu: [...compares, { id: 'compare-commit', label: 'Compare commit with…' }] },
    { type: 'separator' },
    remoteItem('remote', 'Open in browser', unpushed),
    ...pullRequests,
    {
      label: 'Copy',
      submenu: [
        { id: 'copy', label: 'Commit hash' },
        { id: 'copymsg', label: 'Commit message' },
        remoteItem('copylink', 'Commit link', unpushed)
      ]
    },
    { type: 'separator' },
    {
      label: 'Undo',
      submenu: [
        { id: 'revert', label: 'Revert commit…' },
        { type: 'separator' },
        ...(isHead
          ? [{ label: 'Reset: already at this commit', enabled: false }]
          : [
              { id: 'reset:soft', label: 'Reset to here, keep changes staged' },
              { id: 'reset:mixed', label: 'Reset to here, keep changes unstaged' },
              { type: 'separator' as const },
              { id: 'reset:hard', label: 'Reset to here, discard changes…' }
            ])
      ]
    }
  ]
  const id = await showMenu(items)
  if (!id) return
  if (id === 'compare-commit') return onCompareCommit(c)
  const [tipRef, tipItem] = id.split('|')
  const tip = tipItem ? r.branches.find((b) => b.fullName === tipRef) : undefined
  if (tip && (await runCompareItem(tipItem, r, tip, onCompare))) return
  const label = c.refs.find((x) => x.type !== 'head')?.name ?? c.hash.slice(0, 8)
  if (id.startsWith('co:')) act.checkout(r, id.slice(3), 'local')
  else if (id.startsWith('cor:')) act.checkout(r, id.slice(4), 'remote')
  else if (id.startsWith('pr:')) act.openPullRequest(r, id.slice(3))
  else if (id === 'remote') void openOnRemote(r.path, { kind: 'commit', hash: c.hash })
  else if (id === 'detach') act.checkout(r, c.hash, 'detached')
  else if (id === 'branch') act.newBranch(r, c.hash)
  else if (id === 'tag') act.createTag(r, c.hash)
  else if (id === 'merge') act.merge(r, c.hash, label)
  else if (id === 'rebase') act.rebase(r, c.hash, label)
  else if (id === 'pick') act.cherryPick(r, c)
  else if (id === 'squash' || id === 'fixup') void rewriteCommits(r, [c.hash], id)
  else if (id === 'revert') act.revert(r, c)
  else if (id.startsWith('reset:')) act.reset(r, c, id.slice(6) as 'soft' | 'mixed' | 'hard')
  else if (id === 'copy') copyText(c.hash, 'commit hash')
  else if (id === 'copymsg') copyText(c.subject, 'commit message')
  else if (id === 'copylink') void copyRemoteLink(r.path, { kind: 'commit', hash: c.hash }, 'commit link')
}

export async function showRefMenu(r: RepoCtx, branch: Branch, onCompare: CompareBranch, anchor?: Element | null) {
  if (waitForBranches(r, 'branches', false)) return
  if (branch.type === 'tag') return showTagMenu(r, branch, anchor)
  return showBranchMenu(r, branch, onCompare, undefined, anchor)
}

const REF_ORDER = { local: 0, remote: 1, tag: 2 } as const

/** The commit's refs that have a menu: the current branch first, then local branches, remotes and tags. */
export function refMenuTargets(r: RepoCtx, c: Commit) {
  return c.refs
    .flatMap((ref) => {
      const branch = branchForRef(r, c, ref)
      return branch ? [{ ref, branch }] : []
    })
    .sort(
      (a, b) =>
        Number(!!b.ref.current) - Number(!!a.ref.current) ||
        REF_ORDER[a.branch.type as keyof typeof REF_ORDER] - REF_ORDER[b.branch.type as keyof typeof REF_ORDER]
    )
}

export function branchForRef(r: RepoCtx, c: Commit, ref: Ref) {
  if (ref.type !== 'local' && ref.type !== 'remote' && ref.type !== 'tag') return undefined
  return findBranch(r.branches, ref.type, ref.name, c.hash)
}
