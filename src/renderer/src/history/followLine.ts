import type { Commit } from '../../../shared/types'
import type { GraphRow } from './graph'

export type FollowStep = { hash: string } | { none: 'root' | 'tip' }

/** The commits Alt+Down walked through, in order, so Alt+Up can climb back the same way. */
export type FollowTrail = readonly string[]

export interface ChildPreference {
  trail?: FollowTrail
  /** The checked-out branch's first-parent line (`firstParentLine`). */
  headLine?: ReadonlySet<string>
}

/** The commit Alt+Down lands on: the first parent, the line the commit continues (it may not be loaded yet). */
export function lineParent(commit: Commit): FollowStep {
  return commit.parents[0] ? { hash: commit.parents[0] } : { none: 'root' }
}

/**
 * The commit Alt+Up lands on. Where the last Alt+Down landed here, the commit it came from, so a walk down and back
 * returns to the branch it started on. Otherwise a loaded child that continues this commit's line: children whose
 * first parent is this commit come first, preferring the checked-out line, then the same graph lane, then the nearest
 * row. With none, a merge that took this commit in (a merged branch's tip leads to its merge) so the walk never stops
 * short.
 */
export function lineChild(
  commits: readonly Commit[],
  rows: readonly GraphRow[],
  index: number,
  { trail = [], headLine }: ChildPreference = {}
): FollowStep {
  const hash = commits[index]?.hash
  const back = trail.length > 1 && trail[trail.length - 1] === hash ? trail[trail.length - 2] : undefined
  if (back && commits.some((c) => c.hash === back)) return { hash: back }
  const first: number[] = []
  const merged: number[] = []
  for (let i = index - 1; i >= 0; i--) {
    const parents = commits[i].parents
    if (parents[0] === hash) first.push(i)
    else if (parents.includes(hash)) merged.push(i)
  }
  const col = rows[index]?.col
  const pick = first.find((i) => headLine?.has(commits[i].hash)) ?? first.find((i) => rows[i]?.col === col) ?? first[0] ?? merged[0]
  return pick === undefined ? { none: 'tip' } : { hash: commits[pick].hash }
}

/** The trail after stepping `from` to `to`: Alt+Down extends it (or starts afresh elsewhere), retracing Alt+Up shortens it. */
export function stepTrail(trail: FollowTrail, from: string, to: string, direction: 'parent' | 'child'): FollowTrail {
  const last = trail[trail.length - 1]
  if (direction === 'parent') return last === from ? [...trail, to] : [from, to]
  return last === from && trail[trail.length - 2] === to ? trail.slice(0, -1) : trail
}
