import { useMemo, type RefObject } from 'react'
import { diffFindLine } from '../../../shared/diffFind'
import { useFindInFile } from '../lib/useFindInFile'
import type { FileDiff } from './diff'
import type { DiffSide, Row } from './diffTypes'

/** Adapt shared find to displayed diff rows. Context is counted once, even in two columns. */
export function useDiffFind(
  diff: FileDiff | null,
  rows: Row[],
  cursor: number,
  ref: RefObject<HTMLDivElement | null>,
  setCursor: (row: number) => void,
  setSide: (side: DiffSide) => void,
  showAll: () => void
) {
  const lines = useMemo(() => rows.map((row) => diff!.hunks[row.hunk].lines[row.line]), [diff, rows])
  const find = useFindInFile({
    lines,
    at: cursor,
    scrollerRef: ref,
    moveTo: (row) => {
      setSide(lines[row]?.type === 'del' ? 'old' : 'new')
      setCursor(row)
    },
    resolveLine: (query) => diffFindLine(lines, query),
    lineNotFound: 'Line not in diff'
  })
  return {
    ...find,
    open: () => {
      // Search every supplied hunk, including rows beyond the initial truncation limit.
      showAll()
      find.open()
    }
  }
}
