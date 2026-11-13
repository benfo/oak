import type { RepoCtx } from '../useRepo'
import type { GraphRow } from './graph'
import { notify } from '../notices'
import { WORKING_HASH } from '../../../shared/working.ts'
import { lineChild, lineParent, stepTrail, type FollowTrail } from './followLine'

export interface FollowLineContext {
  r: RepoCtx
  rows: readonly GraphRow[]
  /** The checked-out branch's first-parent line. */
  headLine: ReadonlySet<string>
  trail: FollowTrail
  setTrail: (trail: FollowTrail) => void
  /** The working changes row is showing above HEAD. */
  working: boolean
  /** A comparison lists only a range, so a parent outside it cannot be loaded. */
  comparing: boolean
  select: (hash: string) => void
}

/** Alt+Down or Alt+Up in the graph: select the next or previous commit on the line `from` belongs to. */
export function followLine(ctx: FollowLineContext, from: string, direction: 'parent' | 'child') {
  const { r, rows, headLine, trail, setTrail, working, comparing, select } = ctx
  const head = r.status?.head
  if (from === WORKING_HASH) {
    if (direction === 'parent' && head) select(head)
    else notify.info('Nothing newer: these are your working changes.')
    return
  }
  const index = r.commits.findIndex((c) => c.hash === from)
  if (index < 0) return
  // A file's history is drawn as one lane: the list itself is the line.
  if (r.commitsFile) {
    const next = r.commits[index + (direction === 'parent' ? 1 : -1)]
    if (next) select(next.hash)
    else notify.info(direction === 'parent' ? 'No older commit touches this file.' : 'No newer commit touches this file.')
    return
  }
  if (direction === 'child' && working && from === head) return select(WORKING_HASH)
  const step = direction === 'parent' ? lineParent(r.commits[index]) : lineChild(r.commits, rows, index, { trail, headLine })
  if ('none' in step) {
    notify.info(step.none === 'root' ? 'This is the first commit: it has no parent.' : 'Nothing newer on this line in the graph.')
    return
  }
  const loaded = r.commits.some((c) => c.hash === step.hash)
  if (!loaded && (comparing || !r.hasMore)) return notify.info('The parent commit is outside this view.')
  setTrail(stepTrail(trail, from, step.hash, direction))
  select(step.hash)
}
