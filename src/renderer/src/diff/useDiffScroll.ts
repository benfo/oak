import { useEffect, useRef, useState, type RefObject } from 'react'
import { useVirtualRows } from '../lib/useVirtualRows'
import type { FileDiff } from './diff'
import type { DiffSide, Item, Row } from './diffTypes'

// Longer diffs render only the rows near the viewport (shorter ones stay fully in the page, so native select-all and copy keep working).
const VIRTUALIZE_MIN = 600
// First guesses only: rows are measured once rendered.
const LINE_ESTIMATE = 20
const HEADER_ESTIMATE = 36
// Electron's Chromium supports container; the project's DOM types do not expose it yet.
const REVEAL_LINE: ScrollIntoViewOptions & { container: 'nearest' } = { block: 'center', inline: 'nearest', container: 'nearest' }
const KEEP_LINE_VISIBLE: ScrollIntoViewOptions & { container: 'nearest' } = { block: 'nearest', inline: 'nearest', container: 'nearest' }

interface Options {
  ref: RefObject<HTMLDivElement | null>
  diff: FileDiff | null
  split: boolean
  cursor: number
  cursorSide: DiffSide
  rows: Row[]
  items: Item[]
  rowItem: number[]
  posItem: number[]
  positions: Map<number, number>
  itemRow: (item: Item | undefined) => number
}

/**
 * Scrolling for the diff pane: windows long diffs, scrolls a row into view (a long diff by position, since rows outside
 * the window are not in the page), keeps the first visible row across a layout change and keeps the cursor visible.
 */
export function useDiffScroll({ ref, diff, split, cursor, cursorSide, rows, items, rowItem, posItem, positions, itemRow }: Options) {
  // The scroller is the diff, or the Before column when side by side.
  const virtualize = items.length > VIRTUALIZE_MIN
  const {
    virtual,
    items: windowed,
    spacer
  } = useVirtualRows({
    count: virtualize ? items.length : 0,
    getScrollElement: () => (split ? ref.current?.querySelector<HTMLElement>('.side-column[data-side="old"]') : ref.current) ?? null,
    estimateSize: (i) => (items[i]?.header ? HEADER_ESTIMATE : LINE_ESTIMATE),
    overscan: 30,
    getItemKey: (i) => items[i]?.key ?? i
  })
  const visibleRange = virtualize ? virtual.range : null

  const revealRow = (index: number, block: 'center' | 'nearest') => {
    if (virtualize) {
      const item = split ? posItem[positions.get(index) ?? 0] : rowItem[index]
      if (item !== undefined) virtual.scrollToIndex(item, { align: block === 'center' ? 'center' : 'auto' })
      return
    }
    ref.current
      ?.querySelector(`[data-idx="${index}"]${split ? `[data-side="${cursorSide}"]` : ''} .gutter`)
      ?.scrollIntoView(block === 'center' ? REVEAL_LINE : KEEP_LINE_VISIBLE)
  }

  // The first visible row survives a layout change, which rebuilds the list from the top.
  const topRow = useRef(0)
  const wasSplit = useRef(split)
  const layoutChanged = useRef(false)
  useEffect(() => {
    if (wasSplit.current === split) return
    wasSplit.current = split
    if (!virtualize) return
    layoutChanged.current = true
    const item = split ? posItem[positions.get(topRow.current) ?? 0] : rowItem[topRow.current]
    if (item !== undefined) virtual.scrollToIndex(item, { align: 'start' })
  }, [split])
  useEffect(() => {
    if (visibleRange) topRow.current = itemRow(items[visibleRange.startIndex])
  })

  useEffect(() => {
    if (split && ref.current) ref.current.scrollLeft = 0
    // After a layout change the first visible row stays put (see above) rather than following the cursor.
    if (layoutChanged.current) layoutChanged.current = false
    else revealRow(cursor, 'nearest')
  }, [cursor, cursorSide, split])

  // A single change needs no cycling while any of its changed lines are visible. Observe both
  // sides' gutters, not just the first line, so scrolling within a long change keeps it disabled.
  // (A virtualized diff derives this from the rendered range instead.)
  const [observedVisible, setObservedVisible] = useState(false)
  useEffect(() => {
    setObservedVisible(false)
    if (diff?.hunks.length !== 1 || virtualize) return
    const targets = ref.current?.querySelectorAll('.dl.add .gutter, .dl.del .gutter')
    if (!targets?.length) return
    const visible = new Set<Element>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.01) visible.add(entry.target)
          else visible.delete(entry.target)
        }
        setObservedVisible(visible.size > 0)
      },
      { root: ref.current, threshold: 0.01 }
    )
    targets.forEach((target) => observer.observe(target))
    return () => observer.disconnect()
  }, [diff, rows, split, virtualize])
  const rangeShowsChange = !!visibleRange && items.slice(visibleRange.startIndex, visibleRange.endIndex + 1).some((item) => item.change)
  const singleChangeVisible = virtualize ? rangeShowsChange : observedVisible

  return { virtualize, measure: virtualize ? virtual.measureElement : null, windowed, spacer, singleChangeVisible, revealRow }
}
