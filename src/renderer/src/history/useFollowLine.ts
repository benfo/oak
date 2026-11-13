import { useMemo, useState } from 'react'
import type { RepoCtx } from '../useRepo'
import { firstParentLine, type GraphRow } from './graph'
import { lineChild, type FollowTrail } from './followLine'
import { followLine, type FollowLineContext } from './followLineAction'

type Options = Pick<FollowLineContext, 'working' | 'comparing' | 'select'>

/**
 * Alt+Down / Alt+Up along a graph line, remembering the walk down so climbing back returns the same way. `child` is
 * where Alt+Up from the commit at `index` lands, for the details' child link.
 */
export function useFollowLine(r: RepoCtx, rows: readonly GraphRow[], index: number, options: Options) {
  const [trail, setTrail] = useState<FollowTrail>([])
  const headLine = useMemo(() => firstParentLine(r.commits, r.status?.head), [r.commits, r.status?.head])
  const child = useMemo(() => {
    if (index < 0 || r.commitsFile) return undefined
    const step = lineChild(r.commits, rows, index, { trail, headLine })
    return 'hash' in step ? step.hash : undefined
  }, [r.commits, r.commitsFile, rows, index, trail, headLine])
  const follow = (from: string, direction: 'parent' | 'child') =>
    followLine({ r, rows, headLine, trail, setTrail, ...options }, from, direction)
  return { child, follow }
}
