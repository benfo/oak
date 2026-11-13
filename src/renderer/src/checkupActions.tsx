import { api, errorMessage } from './api'
import type { RepoCtx } from './useRepo'
import { reportOpError } from './actions'
import { notify } from './notices'
import { chooseFromList } from './components/ChecklistDialog'
import type { IconName } from './components/Icon'
import { SummaryTiles } from './components/SummaryTiles'
import {
  CHECKUP_PENDING,
  checkupCaution,
  checkupDone,
  checkupRows,
  checkupTiles,
  checkupVerdict,
  COMPACT_ID,
  pendingTiles,
  storageBytes,
  tickedBranches,
  type CheckupTile
} from '../../shared/repoCheckup'

const TILE_ICONS: Record<CheckupTile['id'], IconName> = { branches: 'branch', storage: 'storage', state: 'health' }

/** Check the repository's health in one go, review what can be cleaned, then run the ticked steps. */
export async function repositoryCheckup(r: RepoCtx) {
  const withIcons = (tiles: CheckupTile[]) => tiles.map((tile) => ({ ...tile, icon: TILE_ICONS[tile.id] }))
  // The dialog opens at once; git's findings fill it in when they arrive.
  const reading = api.repoCheckup(r.path)
  let ticked: string[] | null
  try {
    ticked = await chooseFromList({
      title: 'Repository check-up',
      message: CHECKUP_PENDING,
      summary: <SummaryTiles tiles={withIcons(pendingTiles())} />,
      items: [],
      loading: reading.then((checkup) => {
        const rows = checkupRows(checkup)
        return {
          message: checkupVerdict(rows),
          summary: <SummaryTiles tiles={withIcons(checkupTiles(checkup, r.status?.state ?? 'clean'))} />,
          caution: checkupCaution(checkup),
          items: rows
        }
      }),
      ok: (count) => (count === 1 ? 'Clean up 1 item' : `Clean up ${count} items`),
      danger: (ids) => tickedBranches(ids).length > 0
    })
  } catch (e) {
    return notify.error(errorMessage(e))
  }
  if (!ticked?.length) return

  const branches = tickedBranches(ticked)
  const before = storageBytes((await reading).storage)
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
