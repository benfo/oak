import { api, errorMessage } from './api'
import type { RepoCtx } from './useRepo'
import { runOp } from './actions'
import { notify } from './notices'
import { chooseFromList } from './components/ChecklistDialog'
import { cleanupNote, type BranchCleanup } from '../../shared/branchCleanup'

/** Review the local branches that are merged or whose upstream is gone, then delete the ticked ones. */
export async function cleanUpBranches(r: RepoCtx) {
  let found: BranchCleanup
  try {
    found = await api.branchCleanup(r.path)
  } catch (e) {
    return notify.error(errorMessage(e))
  }
  const { target, candidates } = found
  if (!target) return notify.info('No default branch to measure against, so there is nothing to clean up')
  if (!candidates.length) return notify.info(`Nothing to clean up: no branch is merged into ${target} or has lost its upstream`)

  const names = await chooseFromList({
    title: 'Clean up branches',
    message: `Local branches that are merged into ${target}, or whose upstream was deleted. Commits not in ${target} are lost with their branch.`,
    items: candidates.map((c) => ({ id: c.name, label: c.name, note: cleanupNote(c, target), warn: c.reason === 'gone', checked: true })),
    ok: (count) => (count === 1 ? 'Delete 1 branch' : `Delete ${count} branches`),
    danger: true
  })
  if (!names?.length) return
  const done = names.length === 1 ? `Deleted ${names[0]}` : `Deleted ${names.length} branches`
  await runOp(r, 'Deleting branches', () => api.deleteBranches(r.path, names), done)
}
