import { useMemo } from 'react'
import { lineKey, type FileDiff } from './diff'
import { alignDiffLines } from './sideDiff'
import type { Item, Row, SidePair } from './diffTypes'

const LINE_LIMIT = 4000

/**
 * Everything the pane renders, derived from the parsed diff: the lines (cut short unless `showAll`), their
 * hunks, the side-by-side pairs, and the flat list of headers and lines or pairs that is windowed when long.
 */
export function useDiffRows(diff: FileDiff | null, showAll: boolean, split: boolean) {
  const { rows, truncated } = useMemo(() => {
    const rows: Row[] = []
    let budget = showAll ? Infinity : LINE_LIMIT
    let truncated = false
    diff?.hunks.forEach((h, hunk) => {
      if (budget <= 0) return void (truncated = true)
      const lines = h.lines.slice(0, budget)
      if (lines.length < h.lines.length) truncated = true
      budget -= h.lines.length
      lines.forEach((l, line) =>
        rows.push({ index: rows.length, hunk, line, key: lineKey(hunk, line), change: l.type === 'add' || l.type === 'del' })
      )
    })
    return { rows, truncated }
  }, [diff, showAll])

  const hunkRows = useMemo(() => {
    const groups: Row[][] = diff?.hunks.map(() => []) ?? []
    for (const r of rows) groups[r.hunk].push(r)
    return groups
  }, [diff, rows])
  const sideHunks = useMemo(
    () =>
      diff?.hunks.map((h, hi): SidePair[] => {
        const visible = hunkRows[hi]
        return alignDiffLines(h.lines.slice(0, visible.length)).map((pair) => ({
          old: pair.old === null ? null : visible[pair.old].index,
          new: pair.new === null ? null : visible[pair.new].index
        }))
      }) ?? [],
    [diff, hunkRows]
  )
  const sideRows = useMemo(() => sideHunks.flat(), [sideHunks])
  const positions = useMemo(() => {
    const map = new Map<number, number>()
    sideRows.forEach((pair, i) => {
      if (pair.old !== null) map.set(pair.old, i)
      if (pair.new !== null) map.set(pair.new, i)
    })
    return map
  }, [sideRows])

  // Where each row (inline) or row pair (side by side) sits in the flat list.
  const { items, rowItem, posItem } = useMemo(() => {
    const items: Item[] = []
    const rowItem: number[] = []
    const posItem: number[] = []
    let pos = 0
    diff?.hunks.forEach((_, hi) => {
      if (!hunkRows[hi].length) return
      items.push({ key: `h${hi}`, hunk: hi, header: true, change: false })
      if (split) {
        for (const pair of sideHunks[hi]) {
          posItem[pos] = items.length
          const change = [pair.old, pair.new].some((i) => i !== null && rows[i].change)
          items.push({ key: `p${pos}`, hunk: hi, pos, change })
          pos++
        }
      } else {
        for (const r of hunkRows[hi]) {
          rowItem[r.index] = items.length
          items.push({ key: r.key, hunk: hi, row: r.index, change: r.change })
        }
      }
    })
    return { items, rowItem, posItem }
  }, [diff, rows, hunkRows, sideHunks, split])

  /** The row an item stands for (a header stands for its hunk's first row). */
  const itemRow = (item: Item | undefined) =>
    !item
      ? 0
      : item.row !== undefined
        ? item.row
        : item.pos !== undefined
          ? (sideRows[item.pos].new ?? sideRows[item.pos].old ?? 0)
          : (hunkRows[item.hunk][0]?.index ?? 0)

  return { rows, truncated, hunkRows, sideRows, positions, items, rowItem, posItem, itemRow }
}
