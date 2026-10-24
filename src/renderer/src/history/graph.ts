import type { Commit } from '../../../shared/types'

/** A line segment within one row, between lane columns. */
export interface Edge {
  from: number
  to: number
  color: number
  current: boolean
}

export interface GraphRow {
  col: number
  color: number
  current: boolean
  /** Edges in the upper half of the row (row top -> node / passthrough). */
  top: Edge[]
  /** Edges in the lower half of the row (node / passthrough -> row bottom). */
  bottom: Edge[]
}

export interface Graph {
  rows: GraphRow[]
  width: number
}

interface Lane {
  hash: string
  color: number
  current: boolean
}

/**
 * Assigns each commit a lane and computes the edges to draw. Commits must be in
 * topological-ish order (children before parents), which `git log --date-order` gives us.
 */
export function buildGraph(commits: Commit[], head?: string | null): Graph {
  // A lane colour can be reused by unrelated commits. Follow actual first-parent hashes,
  // then carry emphasis along the edges originating at those commits, including passthroughs.
  const byHash = new Map(commits.map((c) => [c.hash, c]))
  const currentPath = new Set<string>()
  let next = head
  while (next && byHash.has(next) && !currentPath.has(next)) {
    currentPath.add(next)
    next = byHash.get(next)!.parents[0]
  }
  const lanes: (Lane | null)[] = []
  const rows: GraphRow[] = []
  let nextColor = 0
  let width = 1

  const freeSlot = () => {
    const i = lanes.indexOf(null)
    return i === -1 ? lanes.length : i
  }

  for (const c of commits) {
    const lanesIn = lanes.slice()
    let col = lanes.findIndex((l) => l?.hash === c.hash)
    if (col === -1) {
      col = freeSlot()
      lanes[col] = { hash: c.hash, color: nextColor++, current: false }
    }
    const color = lanes[col]!.color
    const current = currentPath.has(c.hash)

    const top: Edge[] = []
    lanesIn.forEach((l, i) => {
      if (!l) return
      top.push({ from: i, to: l.hash === c.hash ? col : i, color: l.color, current: l.current })
    })

    // Other lanes that were waiting for this commit end here.
    lanes.forEach((l, i) => {
      if (l && l.hash === c.hash && i !== col) lanes[i] = null
    })

    const mergeTargets: number[] = []
    if (c.parents.length === 0) {
      lanes[col] = null
    } else {
      lanes[col] = { hash: c.parents[0], color, current }
      for (const p of c.parents.slice(1)) {
        let idx = lanes.findIndex((l) => l?.hash === p)
        if (idx === -1) {
          idx = freeSlot()
          lanes[idx] = { hash: p, color: nextColor++, current: false }
        }
        mergeTargets.push(idx)
      }
    }

    const bottom: Edge[] = []
    lanes.forEach((l, i) => {
      if (!l) return
      if (i === col) bottom.push({ from: col, to: col, color: l.color, current: l.current })
      else if (lanesIn[i] && lanesIn[i]!.hash === l.hash && l.hash !== c.hash)
        bottom.push({ from: i, to: i, color: l.color, current: l.current })
    })
    for (const idx of mergeTargets) bottom.push({ from: col, to: idx, color: lanes[idx]!.color, current: false })

    while (lanes.length && lanes[lanes.length - 1] === null) lanes.pop()
    width = Math.max(width, lanesIn.length, lanes.length, col + 1)
    rows.push({ col, color, current, top, bottom })
  }

  return { rows, width }
}
