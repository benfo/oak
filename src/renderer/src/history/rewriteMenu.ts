import type { MenuItem } from '../../../shared/types'
import { showMenu } from '../api'
import type { RepoCtx } from '../useRepo'
import { checkRewrite, rewriteCommits } from '../rewriteActions'

/** "Combine commits" with Squash and Fixup inside, or one disabled row giving the reason neither can run. */
export function combineMenuItem(r: RepoCtx, hashes: string[]): MenuItem {
  // Whether a rewrite is possible does not depend on the mode, so one check serves both items.
  const check = checkRewrite(r, hashes, 'fixup')
  if (!check.ok) return { label: `Combine commits: ${check.reason}`, enabled: false }
  if (hashes.length > 1) {
    return {
      label: `Combine ${hashes.length} commits`,
      submenu: [
        { id: 'squash', label: `Squash ${hashes.length} commits… (edit the message)` },
        { id: 'fixup', label: `Fixup ${hashes.length} commits (keep the oldest message)` }
      ]
    }
  }
  return {
    label: 'Combine commits',
    submenu: [
      { id: 'squash', label: 'Squash into previous… (edit the message)' },
      { id: 'fixup', label: 'Fixup into previous (keep the older message)' }
    ]
  }
}

/** The menu for a selected range: the commits it covers have only this in common, so it offers only this. */
export async function showRangeMenu(r: RepoCtx, hashes: string[]) {
  const id = await showMenu([combineMenuItem(r, hashes)])
  if (id === 'squash' || id === 'fixup') await rewriteCommits(r, hashes, id)
}
