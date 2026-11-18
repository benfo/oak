import { useEffect, type Dispatch, type RefObject, type SetStateAction } from 'react'
import type { FileDiff } from './diff'
import type { DiffSide, Row } from './diffTypes'

interface Options {
  diff: FileDiff | null
  rows: Row[]
  truncated: boolean
  showAll: boolean
  setShowAll: (show: boolean) => void
  cursorHunk: number
  setCursor: Dispatch<SetStateAction<number>>
  setSide: (side: DiffSide) => void
  revealRow: (index: number, align: 'center') => void
  ref: RefObject<HTMLDivElement | null>
  /** A hunk to land on once a truncated diff has loaded in full. Shared with `useDiffCursor`, which clears it on a new diff. */
  pendingHunk: RefObject<number | null>
  revealLine?: number
  onRevealed?: () => void
}

/**
 * Moving the cursor to a requested line or to the next or previous change, loading a truncated diff in full first
 * when the target isn't shown yet. Call after `useDiffCursor`, so a diff reset can't undo the requested line.
 */
export function useDiffJumps({
  diff,
  rows,
  truncated,
  showAll,
  setShowAll,
  cursorHunk,
  setCursor,
  setSide,
  revealRow,
  ref,
  pendingHunk,
  revealLine,
  onRevealed
}: Options) {
  useEffect(() => {
    if (revealLine === undefined || !diff) return
    const row = rows.find((r) => diff.hunks[r.hunk].lines[r.line].newNo === revealLine)
    if (!row && truncated && !showAll) return setShowAll(true)
    if (row) {
      setCursor(row.index)
      setSide('new')
      revealRow(row.index, 'center')
      ref.current?.focus({ preventScroll: true })
    }
    onRevealed?.()
  }, [revealLine, diff, rows])

  useEffect(() => {
    if (pendingHunk.current === null) return
    const row = rows.find((r) => r.hunk === pendingHunk.current && r.change)
    if (row) {
      pendingHunk.current = null
      setCursor(row.index)
      revealRow(row.index, 'center')
    }
  }, [rows])

  const jumpHunk = (delta: number) => {
    if (!diff?.hunks.length) return
    const target = (cursorHunk + delta + diff.hunks.length) % diff.hunks.length
    const idx = rows.findIndex((r) => r.hunk === target && r.change)
    if (idx < 0) {
      pendingHunk.current = target
      setShowAll(true)
      return
    }
    setCursor(idx)
    revealRow(idx, 'center')
    // The reveal button becomes disabled once the only change is visible. Move focus to the
    // revealed code first so disabling the button doesn't drop keyboard focus onto the page.
    if (diff.hunks.length === 1) ref.current?.focus({ preventScroll: true })
  }

  return jumpHunk
}
