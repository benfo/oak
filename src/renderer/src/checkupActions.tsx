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
  checkupDoneLines,
  checkupRows,
  checkupStep,
  checkupTiles,
  checkupVerdict,
  COMPACT_ID,
  pendingTiles,
  storageBytes,
  tickedBranches,
  type CheckupTile,
  type RepoCheckup
} from '../../shared/repoCheckup'

const TILE_ICONS: Record<CheckupTile['id'], IconName> = { branches: 'branch', storage: 'storage', state: 'health' }

/** Check the repository's health in one go, review what can be cleaned, then run the ticked steps. */
export async function repositoryCheckup(r: RepoCtx) {
  const withIcons = (tiles: CheckupTile[]) => tiles.map((tile) => ({ ...tile, icon: TILE_ICONS[tile.id] }))
  // The dialog opens at once; git's findings fill it in when they arrive.
  const reading = api.repoCheckup(r.path)
  const tilesFor = (checkup: RepoCheckup) => <SummaryTiles tiles={withIcons(checkupTiles(checkup, r.status?.state ?? 'clean'))} />

  /** Runs the ticked steps while the dialog stays open, then reads the repository again for the closing summary. */
  const cleanUp = async (ticked: string[], say: (step: string) => void) => {
    const branches = tickedBranches(ticked)
    const before = storageBytes((await reading).storage)
    try {
      const freed = await r.withBusy(
        'Cleaning up',
        async () => {
          if (branches.length) {
            say(checkupStep.deleting(branches))
            await api.deleteBranches(r.path, branches)
          }
          if (!ticked.includes(COMPACT_ID)) return null
          say(checkupStep.compacting)
          return before - storageBytes(await api.compactRepo(r.path))
        },
        { done: (result) => checkupDone(branches, result) }
      )
      return {
        message: `${checkupDone(branches, freed)}.`,
        summary: tilesFor(await api.repoCheckup(r.path)),
        done: checkupDoneLines(branches, freed)
      }
    } catch (e) {
      reportOpError(r, e)
      throw e
    }
  }

  try {
    await chooseFromList({
      title: 'Repository check-up',
      message: CHECKUP_PENDING,
      summary: <SummaryTiles tiles={withIcons(pendingTiles())} />,
      items: [],
      loading: reading.then((checkup) => {
        const rows = checkupRows(checkup)
        return { message: checkupVerdict(rows), summary: tilesFor(checkup), caution: checkupCaution(checkup), items: rows }
      }),
      ok: (count) => (count === 1 ? 'Clean up 1 item' : `Clean up ${count} items`),
      danger: (ids) => tickedBranches(ids).length > 0,
      run: cleanUp
    })
  } catch (e) {
    notify.error(errorMessage(e))
  }
}
