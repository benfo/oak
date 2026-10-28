import { copyText } from '../lib/copy'
import { showMenu } from '../api'
import * as act from '../actions'
import type { Branch, Commit, MenuItem, Ref } from '../../../shared/types'
import type { RepoCtx } from '../useRepo'
import { compareMenuItems, runCompareItem, showBranchMenu, type CompareBranch } from '../lib/branchMenu'
import { showTagMenu } from '../lib/tagMenu'

export async function commitMenu(r: RepoCtx, c: Commit, onCompare: CompareBranch, onCompareCommit: (c: Commit) => void) {
  const cur = r.status?.branch ?? 'HEAD'
  const isHead = c.hash === r.status?.head
  const locals = c.refs.filter((x) => x.type === 'local' && !x.current)
  const hasLocal = (name: string) => r.branches.some((b) => b.type === 'local' && b.name === name)
  const remotes = c.refs.filter((x) => x.type === 'remote' && !hasLocal(x.name.slice(x.name.indexOf('/') + 1)))
  const checkouts: MenuItem[] = [
    ...locals.map((x) => ({ id: `co:${x.name}`, label: x.name })),
    ...remotes.map((x) => ({ id: `cor:${x.name}`, label: `${x.name} as local branch` }))
  ]
  const allTips = c.refs.flatMap((x) =>
    x.type === 'local' || x.type === 'remote' ? r.branches.filter((b) => b.type === x.type && b.name === x.name) : []
  )
  // A remote branch beside its same-named local one is the same line; offer only the local.
  const tips = allTips.filter(
    (t) => t.type === 'local' || !allTips.some((o) => o.type === 'local' && o.name === t.name.slice(t.name.indexOf('/') + 1))
  )
  const compares: MenuItem[] = []
  const compareItems = await Promise.all(tips.map((tip) => compareMenuItems(r, tip, tips.length > 1)))
  tips.forEach((tip, i) => {
    compares.push(...compareItems[i].map((item) => ({ ...item, id: `${tip.fullName}|${item.id}` })))
  })
  // Only commits that are a local branch tip get it, like the sidebar's branch menu.
  const prBranches = c.refs.filter((x) => x.type === 'local')
  const pullRequests: MenuItem[] = prBranches.map((x) => ({
    id: `pr:${x.name}`,
    label: prBranches.length > 1 ? `Open pull request for ${x.name}` : 'Open pull request'
  }))
  const items: MenuItem[] = [
    ...(checkouts.length > 1
      ? [{ label: 'Checkout branch', submenu: checkouts }]
      : checkouts.map((item) => ({ ...item, label: `Checkout ${item.label}` }))),
    { id: 'branch', label: 'New branch from here…' },
    { id: 'pick', label: `Cherry-pick onto ${cur}`, enabled: !isHead },
    { type: 'separator' },
    { label: 'Compare', submenu: [...compares, { id: 'compare-commit', label: 'Compare commit with…' }] },
    {
      label: 'Merge / Rebase',
      enabled: !isHead,
      submenu: [
        { id: 'merge', label: `Merge into ${cur}` },
        { id: 'rebase', label: `Rebase ${cur} onto this` }
      ]
    },
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
    },
    {
      label: 'More',
      submenu: [
        { id: 'detach', label: 'Checkout this commit (detached)' },
        { id: 'tag', label: 'New tag from here…' },
        ...pullRequests
      ]
    },
    { type: 'separator' },
    {
      label: 'Copy',
      submenu: [
        { id: 'copy', label: 'Commit hash' },
        { id: 'copymsg', label: 'Commit message' }
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
  else if (id === 'detach') act.checkout(r, c.hash, 'detached')
  else if (id === 'branch') act.newBranch(r, c.hash)
  else if (id === 'tag') act.createTag(r, c.hash)
  else if (id === 'merge') act.merge(r, c.hash, label)
  else if (id === 'rebase') act.rebase(r, c.hash, label)
  else if (id === 'pick') act.cherryPick(r, c)
  else if (id === 'revert') act.revert(r, c)
  else if (id.startsWith('reset:')) act.reset(r, c, id.slice(6) as 'soft' | 'mixed' | 'hard')
  else if (id === 'copy') copyText(c.hash, 'commit hash')
  else if (id === 'copymsg') copyText(c.subject, 'commit message')
}

export async function showRefMenu(r: RepoCtx, branch: Branch, onCompare: CompareBranch) {
  if (branch.type === 'tag') return showTagMenu(r, branch)
  return showBranchMenu(r, branch, onCompare)
}

export function branchForRef(r: RepoCtx, c: Commit, ref: Ref) {
  if (ref.type !== 'local' && ref.type !== 'remote' && ref.type !== 'tag') return undefined
  return r.branches.find((b) => b.type === ref.type && b.name === ref.name && b.hash === c.hash)
}
