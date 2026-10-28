import { copyText } from './copy'
import { showMenu } from '../api'
import * as act from '../actions'
import type { Branch, MenuItem } from '../../../shared/types'
import type { RepoCtx } from '../useRepo'
import { resolveCompareTarget } from './compareTarget'
import { showComparisonBranchPicker } from '../pickers'
import { suggestHidePatterns } from '../sidebar/sidebarBranches'

/** Starts a comparison of `source` against `target`; a null target means the repository's default. */
export type CompareBranch = (source: Branch, target: Branch | null) => void

/** The "Compare with…" items every branch menu starts with, so wording and order never differ between places. */
export async function compareMenuItems(r: RepoCtx, source: Branch, named = false): Promise<MenuItem[]> {
  const others = r.branches.filter((b) => b.type !== 'tag' && b.fullName !== source.fullName)
  if (!others.length) return []
  const target = await resolveCompareTarget(r.path, r.branches, source)
  return [
    ...(target ? [{ id: 'compare', label: named ? `Compare ${source.name} with ${target.name}` : `Compare with ${target.name}` }] : []),
    { id: 'compare-with', label: named ? `Compare ${source.name} with…` : 'Compare with…' }
  ]
}

/** Runs a compare item chosen from a branch menu; returns whether the id was one of them. */
export async function runCompareItem(id: string | null, r: RepoCtx, source: Branch, onCompare: CompareBranch) {
  if (id === 'compare') onCompare(source, null)
  else if (id === 'compare-with') showComparisonBranchPicker(r, null, source, (target) => onCompare(source, target))
  else return false
  return true
}

/** One definition for local and remote branch menus (sidebar and graph). */
export async function showBranchMenu(
  r: RepoCtx,
  b: Branch,
  onCompare: CompareBranch,
  onHide?: (pattern: string) => void,
  anchor?: Element | null
) {
  const hide = onHide && !(b.type === 'local' && b.name === r.status?.branch) ? suggestHidePatterns(b) : null
  const remote = b.type === 'remote'
  const cur = r.status?.branch
  const compares = await compareMenuItems(r, b)
  const isCurrent = !remote && b.name === cur
  const id = await showMenu(
    [
      { id: 'checkout', label: remote ? 'Checkout as local branch' : 'Checkout', enabled: !isCurrent },
      { id: 'new', label: 'New branch from here…' },
      ...(remote ? [] : [{ id: 'pr', label: 'Open pull request' }]),
      { type: 'separator' },
      ...(compares.length ? [{ label: 'Compare', submenu: compares }] : []),
      {
        label: 'Merge / Rebase',
        enabled: !isCurrent,
        submenu: [
          { id: 'merge', label: `Merge into ${cur ?? 'HEAD'}` },
          { id: 'rebase', label: `Rebase ${cur ?? 'HEAD'} onto ${b.name}` }
        ]
      },
      {
        label: 'Manage',
        submenu: [
          ...(remote ? [] : [{ id: 'rename', label: 'Rename…' }]),
          { id: 'delete', label: remote ? 'Delete on remote…' : 'Delete…', enabled: !isCurrent },
          ...(hide
            ? [{ id: 'hide', label: 'Hide this branch' }, ...(hide.folder ? [{ id: 'hide-folder', label: `Hide ${hide.folder}` }] : [])]
            : [])
        ]
      },
      { type: 'separator' },
      {
        label: 'Copy',
        submenu: [
          { id: 'copy', label: 'Branch name' },
          { id: 'copyhash', label: 'Commit hash' }
        ]
      }
    ],
    anchor
  )
  if (await runCompareItem(id, r, b, onCompare)) return
  if (id === 'checkout') act.checkout(r, b.name, remote ? 'remote' : 'local')
  else if (id === 'merge') act.merge(r, b.name)
  else if (id === 'rebase') act.rebase(r, b.name)
  else if (id === 'new') act.newBranch(r, b.name, b.name)
  else if (id === 'pr') act.openPullRequest(r, b.name)
  else if (id === 'rename') act.renameBranch(r, b)
  else if (id === 'delete') remote ? act.deleteRemoteBranch(r, b.name) : act.deleteBranch(r, b.name)
  else if (id === 'hide' && hide) onHide?.(hide.exact)
  else if (id === 'hide-folder' && hide?.folder) onHide?.(hide.folder)
  else if (id === 'copy') copyText(b.name, 'branch name')
  else if (id === 'copyhash') copyText(b.hash, 'commit hash')
}
