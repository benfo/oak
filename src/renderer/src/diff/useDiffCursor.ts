import { useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from 'react'
import type { FileDiff } from './diff'
import type { Row } from './diffTypes'

/** Keep the same source line through review-option changes; content edits keep a nearby row. */
export function useDiffCursor(
  diff: FileDiff | null,
  rows: Row[],
  cursor: number,
  setCursor: Dispatch<SetStateAction<number>>,
  reviewMode: string,
  clearSelection: () => void,
  pendingHunk: RefObject<number | null>
) {
  const shownMode = useRef(reviewMode)
  const cursorSource = useRef<{ old: number | null; next: number | null } | null>(null)
  useEffect(() => {
    clearSelection()
    pendingHunk.current = null
    const source = shownMode.current !== reviewMode ? cursorSource.current : null
    shownMode.current = reviewMode
    const same =
      source &&
      rows.find((r) => {
        const line = diff?.hunks[r.hunk].lines[r.line]
        return source.next !== null ? line?.newNo === source.next : source.old !== null && line?.oldNo === source.old
      })
    setCursor((c) => (same ? same.index : Math.max(0, Math.min(c, rows.length - 1))))
  }, [diff])
  useEffect(() => {
    const row = rows[cursor]
    const line = row && diff?.hunks[row.hunk].lines[row.line]
    cursorSource.current = line ? { old: line.oldNo, next: line.newNo } : null
  }, [diff, cursor])
}
