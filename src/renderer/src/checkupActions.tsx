import { api, errorMessage } from './api'
import type { RepoCtx } from './useRepo'
import { reportOpError } from './actions'
import { notify } from './notices'
import { chooseFromList } from './components/ChecklistDialog'
import type { IconName } from './components/Icon'
import { SummaryTiles } from './components/SummaryTiles'
import type { TaskUpdate } from '../../shared/taskList'
import {
  CHECKUP_PENDING,
  checkupCaution,
  checkupDone,
  checkupRows,
  checkupStopped,
  checkupTasks,
  checkupTiles,
  checkupVerdict,
  BRANCHES_TASK,
  COMPACT_ID,
  compactNote,
  pendingTiles,
  storageBytes,
  tickedBranches,
  type CheckupTile,
  type RepoCheckup
} from '../../shared/repoCheckup'

const firstLine = (text: string) => text.split(/[\r\n]+/).find((line) => line.trim())

const TILE_ICONS: Record<CheckupTile['id'], IconName> = { branches: 'branch', storage: 'storage', state: 'health' }

/** Check the repository's health in one go, review what can be cleaned, then run the ticked steps. */
export async function repositoryCheckup(r: RepoCtx) {
  const withIcons = (tiles: CheckupTile[]) => tiles.map((tile) => ({ ...tile, icon: TILE_ICONS[tile.id] }))
  // The dialog opens at once; git's findings fill it in when they arrive.
  const reading = api.repoCheckup(r.path)
  const tilesFor = (checkup: RepoCheckup) => <SummaryTiles tiles={withIcons(checkupTiles(checkup, r.status?.state ?? 'clean'))} />

  /** Runs the ticked steps while the dialog stays open, then reads the repository again for the tiles. */
  const cleanUp = async (ticked: string[], report: (taskId: string, update: TaskUpdate) => void) => {
    const tasks = checkupTasks(ticked)
    const branches = tickedBranches(ticked)
    const before = storageBytes((await reading).storage)
    const progress = { current: '', freed: null as number | null, stopped: false }
    const step = async (id: string, work: () => Promise<string>) => {
      if (!tasks.some((task) => task.id === id)) return
      progress.current = id
      report(id, 'running')
      report(id, { done: await work() })
    }
    try {
      await r.withBusy(
        'Cleaning up',
        async () => {
          await step(BRANCHES_TASK, async () => {
            await api.deleteBranches(r.path, branches)
            return 'done'
          })
          await step(COMPACT_ID, async () => {
            progress.freed = before - storageBytes(await api.compactRepo(r.path))
            return compactNote(progress.freed)
          })
        },
        { done: () => checkupDone(branches, progress.freed) }
      )
    } catch (e) {
      progress.stopped = true
      reportOpError(r, e)
      report(progress.current, { failed: firstLine(errorMessage(e)) ?? 'failed' })
    }
    const after = await api.repoCheckup(r.path).catch(() => null)
    const stoppedAt = tasks.find((task) => task.id === progress.current)?.label ?? ''
    return {
      message: progress.stopped ? checkupStopped(stoppedAt) : `${checkupDone(branches, progress.freed)}.`,
      summary: after ? tilesFor(after) : undefined
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
        return {
          message: checkupVerdict(rows),
          summary: tilesFor(checkup),
          caution: checkupCaution(checkup),
          items: rows
        }
      }),
      ok: (count) => (count === 1 ? 'Clean up 1 item' : `Clean up ${count} items`),
      danger: (ids) => tickedBranches(ids).length > 0,
      tasks: checkupTasks,
      runningMessage: 'Cleaning up…',
      run: cleanUp
    })
  } catch (e) {
    notify.error(errorMessage(e))
  }
}
