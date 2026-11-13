import { api, errorMessage } from './api'
import type { RepoCtx } from './useRepo'
import { reportOpError } from './actions'
import { notify } from './notices'
import { chooseFromList } from './components/ChecklistDialog'
import type { IconName } from './components/Icon'
import { SummaryTiles } from './components/SummaryTiles'
import {
  checkupCaution,
  checkupDone,
  checkupRows,
  checkupTiles,
  checkupVerdict,
  COMPACT_ID,
  storageBytes,
  tickedBranches,
  type CheckupTile,
  type RepoCheckup
} from '../../shared/repoCheckup'

const TILE_ICONS: Record<CheckupTile['id'], IconName> = { branches: 'branch', storage: 'storage', state: 'health' }

/** Check the repository's health in one go, review what can be cleaned, then run the ticked steps. */
export async function repositoryCheckup(r: RepoCtx) {
  let checkup: RepoCheckup
  try {
    checkup = await api.repoCheckup(r.path)
  } catch (e) {
    return notify.error(errorMessage(e))
  }
  const rows = checkupRows(checkup)
  const tiles = checkupTiles(checkup, r.status?.state ?? 'clean').map((tile) => ({ ...tile, icon: TILE_ICONS[tile.id] }))
  const ticked = await chooseFromList({
    title: 'Repository check-up',
    message: checkupVerdict(rows),
    summary: <SummaryTiles tiles={tiles} />,
    caution: checkupCaution(checkup),
    items: rows,
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
