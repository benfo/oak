import { api, errorMessage } from './api'
import type { RepoCtx } from './useRepo'
import { reportOpError } from './actions'
import { notify } from './notices'
import { chooseFromList } from './components/ChecklistDialog'
import {
  checkupDone,
  checkupFacts,
  checkupRows,
  COMPACT_ID,
  storageBytes,
  tickedBranches,
  type RepoCheckup
} from '../../shared/repoCheckup'

/** Check the repository's health in one go, review what can be cleaned, then run the ticked steps. */
export async function repositoryCheckup(r: RepoCtx) {
  let checkup: RepoCheckup
  try {
    checkup = await api.repoCheckup(r.path)
  } catch (e) {
    return notify.error(errorMessage(e))
  }
  const ticked = await chooseFromList({
    title: 'Repository check-up',
    message: 'Tick what to clean up. Commits that are only on a deleted branch are lost with it.',
    facts: checkupFacts(checkup, r.status?.state ?? 'clean'),
    items: checkupRows(checkup),
    ok: (count) => (count === 1 ? 'Clean up 1 item' : `Clean up ${count} items`),
    danger: (ids) => tickedBranches(ids).length > 0
  })
  if (!ticked?.length) return

  const branches = tickedBranches(ticked)
  const before = storageBytes(checkup.storage)
  try {
    await r.withBusy(
      'Cleaning up',
      async () => {
        await api.deleteBranches(r.path, branches)
        return ticked.includes(COMPACT_ID) ? before - storageBytes(await api.compactRepo(r.path)) : null
      },
      { done: (freed) => checkupDone(branches, freed) }
    )
  } catch (e) {
    reportOpError(r, e)
  }
}
