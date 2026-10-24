import { useEffect, useRef, useState, type RefObject } from 'react'
import { hunkPatch, linesPatch, type FileDiff } from './diff'
import type { DiffActions, DiffSide, Row, SidePair } from './diffTypes'

interface Options {
  diff: FileDiff | null
  rows: Row[]
  acts: DiffActions | null
  ref: RefObject<HTMLDivElement | null>
  split: boolean
  positions: Map<number, number>
  sideRows: SidePair[]
  cursor: number
  cursorSide: DiffSide
  cursorHunk: number
  setCursor: (index: number) => void
  setSide: (side: DiffSide) => void
}

/** Picking lines (keyboard and gutter mouse selection) and running the stage, unstage or discard actions on them. */
export function useDiffSelection({
  diff,
  rows,
  acts,
  ref,
  split,
  positions,
  sideRows,
  cursor,
  cursorSide,
  cursorHunk,
  setCursor,
  setSide
}: Options) {
  const [anchor, setAnchor] = useState<number | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const dragging = useRef(false)
  useEffect(() => {
    const up = () => (dragging.current = false)
    window.addEventListener('mouseup', up)
    return () => window.removeEventListener('mouseup', up)
  }, [])

  // Picking lines makes them the thing to copy, so an older text selection must not win.
  useEffect(() => {
    if (selected.size) window.getSelection()?.removeAllRanges()
  }, [selected])

  const clear = () => {
    setSelected(new Set())
    setAnchor(null)
  }
  const rangeKeys = (a: number, b: number, targetSide = cursorSide) => {
    if (split) {
      const from = positions.get(a) ?? 0
      const to = positions.get(b) ?? 0
      return new Set(
        sideRows
          .slice(Math.min(from, to), Math.max(from, to) + 1)
          .map((pair) => pair[targetSide])
          .filter((i): i is number => i !== null && rows[i].change)
          .map((i) => rows[i].key)
      )
    }
    const [lo, hi] = a < b ? [a, b] : [b, a]
    return new Set(
      rows
        .slice(lo, hi + 1)
        .filter((r) => r.change)
        .map((r) => r.key)
    )
  }
  const toggle = (idx: number) => {
    const r = rows[idx]
    if (!r?.change) return
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(r.key)) next.delete(r.key)
      else next.add(r.key)
      return next
    })
    setAnchor(idx)
  }
  const selectAllChanges = () => setSelected(new Set(rows.filter((r) => r.change).map((r) => r.key)))
  /** Selects the range from the anchor to `idx`, starting a range at the cursor if there is no anchor yet. */
  const extendTo = (idx: number) => {
    const from = anchor ?? cursor
    setAnchor(from)
    setSelected(rangeKeys(from, idx))
  }

  /** Runs an action on the selected lines, or on the cursor's hunk when nothing is selected. */
  const runOn = (which: 'primary' | 'discard') => {
    if (!diff || !acts) return
    const act = which === 'primary' ? acts.primary : acts.discard
    if (!act) return
    const reverse = which === 'discard' || acts.primary.reverse
    const patch = selected.size ? linesPatch(diff, selected, reverse) : diff.hunks[cursorHunk] && hunkPatch(diff, diff.hunks[cursorHunk])
    if (patch) act.run(patch)
  }

  /** Mouse selection happens in the gutter, so clicking code still selects text for copying. */
  const onLineMouseDown = (e: React.MouseEvent, idx: number, targetSide = cursorSide) => {
    setSide(targetSide)
    setCursor(idx)
    if (!acts || !(e.target as HTMLElement).closest('.gutter') || !rows[idx].change || e.button !== 0) return
    e.preventDefault()
    ref.current?.focus()
    if (e.shiftKey && anchor !== null) setSelected(rangeKeys(anchor, idx, targetSide))
    else if (e.ctrlKey || e.metaKey) toggle(idx)
    else {
      setAnchor(idx)
      setSelected(new Set([rows[idx].key]))
      dragging.current = true
    }
  }
  const onLineMouseEnter = (idx: number) => {
    if (dragging.current && anchor !== null) setSelected(rangeKeys(anchor, idx))
  }

  return { selected, clear, toggle, selectAllChanges, extendTo, runOn, onLineMouseDown, onLineMouseEnter }
}
