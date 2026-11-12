import type { Commit } from '../../../shared/types'
import type { GraphRow } from './graph'

export type FollowStep = { hash: string } | { none: 'root' | 'tip' }

/** The commit Alt+Down lands on: the first parent, the line the commit continues (it may not be loaded yet). */
export function lineParent(commit: Commit): FollowStep {
  return commit.parents[0] ? { hash: commit.parents[0] } : { none: 'root' }
}

/**
 * The commit Alt+Up lands on: a loaded child that continues this commit's line. Children whose first parent is this
 * commit come first, preferring the checked-out line, then the same graph lane, then the nearest row. With none, a
 * merge that took this commit in (a merged branch's tip leads to its merge) so the walk never stops short.
 */
export function lineChild(commits: readonly Commit[], rows: readonly GraphRow[], index: number): FollowStep {
  const hash = commits[index]?.hash
  const first: number[] = []
  const merged: number[] = []
  for (let i = index - 1; i >= 0; i--) {
    const parents = commits[i].parents
    if (parents[0] === hash) first.push(i)
    else if (parents.includes(hash)) merged.push(i)
  }
  const col = rows[index]?.col
  const pick = first.find((i) => rows[i]?.current) ?? first.find((i) => rows[i]?.col === col) ?? first[0] ?? merged[0]
  return pick === undefined ? { none: 'tip' } : { hash: commits[pick].hash }
}
