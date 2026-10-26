import { useMemo, useRef, useState } from 'react'
import { findHits, gotoLine } from '../../../shared/find'
import { useRevealFindMatch } from './useRevealFindMatch'

const NO_HITS: [number, number][] = []

interface Options {
  /** The file's lines; matching runs over their text. Pass a stable array: matches are recomputed when it changes. */
  lines: readonly { text: string }[]
  /** The cursor's line (0-based). */
  at: number
  /** Moves the cursor to a line; the view scrolls it into place. */
  moveTo: (line: number) => void
  /** The scroller that takes focus back when the bar closes. */
  scrollerRef: React.RefObject<HTMLElement | null>
  /** Map a source line number to a displayed row (diffs have gaps and two number columns). */
  resolveLine?: (query: string) => { row: number; label: string } | null
  lineNotFound?: string
}

/**
 * Find in a file's lines, for a view with a line cursor: the text typed, every occurrence (a line with the text twice has two),
 * the current one, and stepping with Enter. A query that starts with ":" is a line number to go to instead.
 * The view draws `FindBar` from `query`, `status` and the handlers, and marks `hitsOn(line)` in its rows.
 */
export function useFindInFile({ lines, at, moveTo, scrollerRef, resolveLine, lineNotFound = 'Line number' }: Options) {
  /** The bar's text; null while it is closed. */
  const [query, setQuery] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const goto = query?.startsWith(':') ?? false
  const hits = useMemo(() => (query && !goto ? findHits(lines, query) : []), [lines, query, goto])
  const rowsWithHits = useMemo(() => {
    const byLine = new Map<number, { first: number; ranges: [number, number][] }>()
    hits.forEach((h, i) => {
      const row = byLine.get(h.line) ?? { first: i, ranges: [] }
      row.ranges.push([h.start, h.end])
      byLine.set(h.line, row)
    })
    return byLine
  }, [hits])
  /** The occurrence Enter last moved to; it only counts while the cursor is still on its line. */
  const [hitIndex, setHitIndex] = useState(0)
  const current = hits[hitIndex]?.line === at ? hitIndex : (rowsWithHits.get(at)?.first ?? -1)
  const [revealRequest, setRevealRequest] = useState(0)
  useRevealFindMatch(scrollerRef, query && current >= 0 ? JSON.stringify([query, current, revealRequest]) : null)
  const resolved = query !== null && goto && resolveLine ? resolveLine(query) : null
  const target = query !== null && goto ? (resolveLine ? (resolved?.row ?? null) : gotoLine(query, lines.length)) : null

  const status = goto
    ? target === null
      ? lineNotFound
      : `Go to line ${resolved?.label ?? target + 1}`
    : !query
      ? ''
      : !hits.length
        ? 'No matches'
        : current >= 0
          ? `${current + 1} of ${hits.length}`
          : `${hits.length} ${hits.length === 1 ? 'match' : 'matches'}`

  const close = () => {
    setQuery(null)
    scrollerRef.current?.focus({ preventScroll: true })
  }
  const open = () => {
    if (query === null) setQuery('')
    else inputRef.current?.select()
    inputRef.current?.focus()
  }
  // Typing moves the cursor to the first match from where it is, or to the line a ":120" names, so the view follows as you type.
  const change = (text: string) => {
    setQuery(text)
    if (text.startsWith(':')) {
      const to = resolveLine ? (resolveLine(text)?.row ?? null) : gotoLine(text, lines.length)
      if (to !== null) moveTo(to)
      return
    }
    const found = findHits(lines, text)
    const first = found.findIndex((h) => h.line >= at)
    const to = first >= 0 ? first : found.length ? 0 : -1
    if (to < 0) return
    setRevealRequest((n) => n + 1)
    setHitIndex(to)
    moveTo(found[to].line)
  }
  /** Enter (or Shift+Enter): the next (previous) occurrence, wrapping; for a ":120" query, go to the line and close. */
  const enter = (backwards: boolean) => {
    if (goto) {
      if (target === null) return
      moveTo(target)
      return close()
    }
    const n = hits.length
    if (!n) return
    let to: number
    if (current >= 0) to = (current + (backwards ? -1 : 1) + n) % n
    else if (backwards) {
      const before = hits.findLastIndex((h) => h.line < at)
      to = before >= 0 ? before : n - 1
    } else {
      const after = hits.findIndex((h) => h.line > at)
      to = after >= 0 ? after : 0
    }
    setHitIndex(to)
    setRevealRequest((n) => n + 1)
    moveTo(hits[to].line)
  }
  /** The occurrences on one line, and which of them (if any) is the current one, for drawing the row. */
  const hitsOn = (line: number) => {
    const row = rowsWithHits.get(line)
    return { ranges: row?.ranges ?? NO_HITS, current: row && hits[current]?.line === line ? current - row.first : -1 }
  }

  return { query, inputRef, status, open, close, change, enter, hitsOn }
}
