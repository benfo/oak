import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useVirtualRows } from '../lib/useVirtualRows'
import { Button, Menu, MenuItem, MenuTrigger, Popover, Toolbar } from 'react-aria-components'
import { hunkPatch, lineKey, linesPatch, parseDiff, type FileDiff } from './diff'
import { useDiffTokens } from './highlight'
import { wordChanges, wordSpans } from './wordDiff'
import { alignDiffLines } from './sideDiff'
import { DIFF_LAYOUTS, resolveDiffLayout, type DiffLayout } from './diffLayout'
import {
  canHandleNavigation,
  fileNavigationDirection,
  handleNavigation,
  horizontalScrollDirection,
  movementDelta,
  navigationAction,
  toolbarHomeEnd
} from '../lib/navigation'
import { widgetAction } from '../lib/keymap'
import { shortcutPlatform } from '../lib/shortcuts'
import { usePane } from '../lib/usePane'
import { Tip } from '../components/Tip'
import { PaneFrame } from '../components/Pane'
import { MenuNavigation } from '../components/MenuNavigation'
import { changeDiffLayout } from './changeDiffLayout'
import { useSettings } from '../settings'
import { CONTEXT_STEPS, contextLabel, isFullContext } from './diffContext'
import { showLessContext, showMoreContext, toggleFullContext, useContextLines } from './useDiffContext'
import { Icon } from '../components/Icon'
import { api, showMenu } from '../api'
import { toast } from '../ui'
import { copyFocused, copyDiffAsPatch, hasTextSelection } from '../lib/copy'
import { copiedLabel, copiedPatch, copiedText, noteDiffFocus, registerDiffCopy, type DiffCopySource } from './diffCopy'

const LINE_LIMIT = 4000
// Longer diffs render only the rows near the viewport (shorter ones stay fully in the page, so native select-all and copy keep working).
const VIRTUALIZE_MIN = 600
// First guesses only: rows are measured once rendered.
const LINE_ESTIMATE = 20
const HEADER_ESTIMATE = 36
// Electron's Chromium supports container; the project's DOM types do not expose it yet.
const REVEAL_LINE: ScrollIntoViewOptions & { container: 'nearest' } = { block: 'center', inline: 'nearest', container: 'nearest' }
const KEEP_LINE_VISIBLE: ScrollIntoViewOptions & { container: 'nearest' } = { block: 'nearest', inline: 'nearest', container: 'nearest' }

/** What the diff's lines can be used for. Patches are built by the view (whole hunks or selected lines). */
export interface DiffActions {
  /** Stage (forward) or Unstage (reverse). Runs on Enter. */
  primary: { label: string; reverse: boolean; run: (patch: string) => void }
  /** Discard from the working tree — always a reverse patch. Runs on Delete. */
  discard?: { label: string; run: (patch: string) => void }
}

interface Props {
  title?: string
  metadata?: ReactNode
  text: string | null
  loading?: boolean
  emptyText?: ReactNode
  /** Enables hunk and line actions for this diff (null for read-only diffs). */
  actions?: (diff: FileDiff) => DiffActions | null
  /** For diffs without actions: why not, shown above the diff (e.g. a deleted file). */
  readOnlyReason?: (diff: FileDiff) => string | null
  /** Escape (or ← at the left edge) — return focus to the list this diff belongs to. */
  onBack?: () => void
  /** V — switch the changed-files list between list and tree; omit when that list is hidden or not switchable. */
  onSwitchView?: () => void
  files?: { index: number; count: number; onSelect: (index: number) => void }
  /** Whole-file content (a synthetic all-added diff): shown as plain numbered code, without diff markings or tools. */
  plain?: boolean
}

/** One rendered line, in display order. */
interface Row {
  index: number
  hunk: number
  line: number
  key: string
  change: boolean
}

/** One entry of the flat list the pane renders: a hunk header, or a line (inline) or line pair (side by side). */
interface Item {
  key: string
  hunk: number
  header?: boolean
  row?: number
  pos?: number
  change: boolean
}

export function DiffView({
  title,
  metadata,
  text,
  loading,
  emptyText = 'Select a file to see its changes',
  actions,
  readOnlyReason,
  onBack,
  onSwitchView,
  files,
  plain = false
}: Props) {
  const diff = useMemo(() => (text === null ? null : parseDiff(text)), [text])
  const acts = diff && actions ? actions(diff) : null
  const notice = diff && !acts && readOnlyReason ? readOnlyReason(diff) : null
  const [showAll, setShowAll] = useState(false)
  const [cursor, setCursor] = useState(0)
  const [paneWidth, setPaneWidth] = useState(0)
  const [observedVisible, setObservedVisible] = useState(false)
  const [side, setSide] = useState<'old' | 'new'>('new')
  const [anchor, setAnchor] = useState<number | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const ref = useRef<HTMLDivElement>(null)
  const hadFocus = useRef(false)
  const dragging = useRef(false)
  const pendingHunk = useRef<number | null>(null)
  const toolsRef = useRef<HTMLDivElement>(null)
  useEffect(() => toolbarHomeEnd(toolsRef.current), [!!title])

  // Rendered lines (respecting truncation) and whether the diff was cut short.
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

  // Syntax colours arrive from a worker a moment after the plain text. Each line's code element is
  // built once per diff/colours, so moving the cursor doesn't re-render every span.
  const { syntaxHighlighting, diffLayout, vimNavigation } = useSettings()
  const split = !plain && resolveDiffLayout(diffLayout, paneWidth) === 'split'
  const lineType = rows[cursor] && diff?.hunks[rows[cursor].hunk].lines[rows[cursor].line].type
  const cursorSide = lineType === 'del' ? 'old' : lineType === 'add' ? 'new' : side
  const hunkRows = useMemo(() => {
    const groups: Row[][] = diff?.hunks.map(() => []) ?? []
    for (const r of rows) groups[r.hunk].push(r)
    return groups
  }, [diff, rows])
  const sideHunks = useMemo(
    () =>
      diff?.hunks.map((h, hi) => {
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
  // The flat list the pane renders, plus where each row (inline) or row pair (side by side) sits in it.
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
  const itemRow = (item: Item | undefined) =>
    !item
      ? 0
      : item.row !== undefined
        ? item.row
        : item.pos !== undefined
          ? (sideRows[item.pos].new ?? sideRows[item.pos].old ?? 0)
          : (hunkRows[item.hunk][0]?.index ?? 0)

  // Long diffs render only the items near the viewport; the scroller is the diff, or the Before column when side by side.
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
  const rangeShowsChange = !!visibleRange && items.slice(visibleRange.startIndex, visibleRange.endIndex + 1).some((item) => item.change)
  const singleChangeVisible = virtualize ? rangeShowsChange : observedVisible
  /** Scrolls a row into view; rows outside the rendered window are not in the page, so a long diff scrolls by position. */
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
  const hunkCount = rows.length ? rows[rows.length - 1].hunk + 1 : 0
  const tokens = useDiffTokens(diff, text, hunkCount, syntaxHighlighting)
  const words = useMemo(() => (diff ? wordChanges(diff, hunkCount) : []), [diff, hunkCount])
  // Each line's code element is built when first rendered, once per diff/colours, so moving the cursor
  // doesn't re-render every span and a long diff doesn't build elements it never shows.
  const codeCache = useMemo(() => new Map<string, ReactNode>(), [diff, tokens, words])
  const codeOf = (r: Row): ReactNode => {
    let node = codeCache.get(r.key)
    if (node === undefined) {
      const l = diff!.hunks[r.hunk].lines[r.line]
      const spans = wordSpans(l.text, tokens?.[r.hunk]?.[r.line], words[r.hunk]?.[r.line] ?? [])
      node = (
        <span className="code">
          {/* An empty flex item is skipped by text selection, which would drop blank lines from a copy. */}
          {l.text === '' && '\n'}
          {spans.map((s, i) => (
            <span key={i} className={s.changed ? 'word-change' : undefined} style={s.c ? { color: s.c } : undefined}>
              {s.t}
            </span>
          ))}
        </span>
      )
      codeCache.set(r.key, node)
    }
    return node
  }

  // A new diff (e.g. after staging) clears the selection but keeps the cursor near where it was.
  // When the context changed instead, the cursor stays on the same file line.
  const context = useContextLines()
  const shownContext = useRef(context)
  const cursorSource = useRef<number | null>(null)
  useEffect(() => {
    const line = rows[cursor] && diff?.hunks[rows[cursor].hunk].lines.slice(rows[cursor].line).find((l) => l.newNo !== null)
    cursorSource.current = line?.newNo ?? null
  }, [cursor])
  useEffect(() => {
    setSelected(new Set())
    setAnchor(null)
    pendingHunk.current = null
    const source = shownContext.current !== context ? cursorSource.current : null
    shownContext.current = context
    const same = source === null ? undefined : rows.find((r) => diff?.hunks[r.hunk].lines[r.line].newNo === source)
    setCursor((c) => (same ? same.index : Math.max(0, Math.min(c, rows.length - 1))))
  }, [text])

  useEffect(() => {
    if (pendingHunk.current === null) return
    const row = rows.find((r) => r.hunk === pendingHunk.current && r.change)
    if (row) {
      pendingHunk.current = null
      setCursor(row.index)
      revealRow(row.index, 'center')
    }
  }, [rows])

  useEffect(() => {
    if (split && ref.current) ref.current.scrollLeft = 0
    // After a layout change the first visible row stays put (see above) rather than following the cursor.
    if (layoutChanged.current) layoutChanged.current = false
    else revealRow(cursor, 'nearest')
  }, [cursor, cursorSide, split])

  useEffect(() => {
    const up = () => (dragging.current = false)
    window.addEventListener('mouseup', up)
    return () => window.removeEventListener('mouseup', up)
  }, [])

  const cursorHunk = rows[cursor]?.hunk ?? 0

  // A single change needs no cycling while any of its changed lines are visible. Observe both
  // sides' gutters, not just the first line, so scrolling within a long change keeps it disabled.
  // (A virtualized diff derives this from the rendered range instead.)
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
      {
        root: ref.current,
        threshold: 0.01
      }
    )
    targets.forEach((target) => observer.observe(target))
    return () => observer.disconnect()
  }, [diff, rows, split, virtualize])

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

  /** Runs an action on the selected lines, or on the cursor's hunk when nothing is selected. */
  // The bar goes inert once the selection clears, so keep focus on the diff rather than losing it.
  const fromBar = (run: () => void) => {
    ref.current?.focus({ preventScroll: true })
    run()
  }
  const runOn = (which: 'primary' | 'discard') => {
    if (!diff || !acts) return
    const act = which === 'primary' ? acts.primary : acts.discard
    if (!act) return
    const reverse = which === 'discard' || acts.primary.reverse
    const patch = selected.size ? linesPatch(diff, selected, reverse) : diff.hunks[cursorHunk] && hunkPatch(diff, diff.hunks[cursorHunk])
    if (patch) act.run(patch)
  }

  // Picking lines makes them the thing to copy, so an older text selection must not win.
  useEffect(() => {
    if (selected.size) window.getSelection()?.removeAllRanges()
  }, [selected])

  /** The picked lines, or the cursor line when none are picked. */
  const copyLines = (patch: boolean) => {
    if (!diff) return
    const picked = rows.filter((r) => selected.has(r.key))
    const refs = (picked.length ? picked : rows[cursor] ? [rows[cursor]] : []).map((r) => ({ hunk: r.hunk, line: r.line }))
    const copied = patch ? copiedPatch(diff, refs) : copiedText(diff, refs)
    if (!copied) return void toast.info('Nothing to copy')
    void api.copyText(copied.text)
    toast.brief(copiedLabel(copied.lines, patch))
  }
  const copyRef = useRef(copyLines)
  copyRef.current = copyLines
  const copySource = useMemo<DiffCopySource>(() => ({ element: () => ref.current, copy: (patch) => copyRef.current(patch) }), [])
  useEffect(() => registerDiffCopy(copySource), [copySource])

  const showCopyMenu = async (viaKeyboard: boolean) => {
    const anchor = viaKeyboard ? (ref.current?.querySelector('.dl.cursor .gutter') ?? ref.current) : null
    const lines = selected.size > 0
    const id = await showMenu(
      [
        { id: 'copy', label: hasTextSelection() ? 'Copy selection' : lines ? 'Copy lines' : 'Copy line' },
        { id: 'patch', label: lines ? 'Copy lines as patch' : 'Copy line as patch' }
      ],
      anchor
    )
    if (id === 'copy') copyFocused()
    else if (id === 'patch') copyDiffAsPatch()
  }

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

  const pane = usePane('diff', { kind: 'diff' })
  const moveFile = (direction: -1 | 1 | 'first' | 'last') => {
    if (!files || files.index < 0) return
    const next = direction === 'first' ? 0 : direction === 'last' ? files.count - 1 : files.index + direction
    if (next < 0 || next >= files.count || next === files.index) return
    // Move focus before a boundary button disables itself, and retain it through loading/empty diffs.
    ref.current?.focus({ preventScroll: true })
    files.onSelect(next)
  }
  const onFileKey = (e: React.KeyboardEvent) => {
    const direction = fileNavigationDirection(e.nativeEvent)
    if (!files || !direction || e.defaultPrevented || (e.target as HTMLElement).closest('input, textarea, [contenteditable="true"]')) return
    e.preventDefault()
    e.stopPropagation()
    moveFile(direction)
  }
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!canHandleNavigation(e)) return
    const action = navigationAction(e.nativeEvent)
    const widget = widgetAction(e.nativeEvent, 'diff', shortcutPlatform())
    const horizontal = horizontalScrollDirection(e.nativeEvent, vimNavigation)
    if (horizontal) {
      e.preventDefault()
      const scroller = split ? ref.current?.querySelector<HTMLElement>(`.side-column[data-side="${cursorSide}"]`) : ref.current
      // A quarter viewport per press; native key repeat continues scrolling while held.
      if (scroller) scroller.scrollBy({ left: horizontal * Math.max(1, Math.round(scroller.clientWidth / 4)), behavior: 'instant' })
      return
    }
    if (widget === 'switchView') {
      if (onSwitchView) {
        e.preventDefault()
        onSwitchView()
      }
      return
    }
    if (!rows.length) {
      handleNavigation(e, { back: onBack, dismiss: onBack })
      return
    }
    if (widget === 'menu') {
      e.preventDefault()
      void showCopyMenu(true)
      return
    }
    const page = Math.max(1, Math.floor((ref.current?.clientHeight ?? 400) / 20) - 2)
    const move = movementDelta(e.key, page, e.nativeEvent)
    if (move !== undefined && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault()
      let next = Math.max(0, Math.min(rows.length - 1, cursor + move))
      if (split) {
        const pos = positions.get(cursor) ?? 0
        const pair = sideRows[Math.max(0, Math.min(sideRows.length - 1, pos + move))]
        next = pair[cursorSide] ?? pair.old ?? pair.new ?? cursor
        setSide(cursorSide)
      }
      if (e.shiftKey && acts) {
        const from = anchor ?? cursor
        setAnchor(from)
        setSelected(rangeKeys(from, next))
      }
      setCursor(next)
      return
    }
    if (split && (action === 'back' || action === 'deeper')) {
      const targetSide = action === 'back' ? 'old' : 'new'
      const pair = sideRows[positions.get(cursor) ?? 0]
      if (targetSide !== cursorSide) {
        e.preventDefault()
        if (pair[targetSide] !== null) {
          setSide(targetSide)
          setCursor(pair[targetSide]!)
        } else if (targetSide === 'old' && onBack && !ref.current?.querySelector('.side-column[data-side="new"]')?.scrollLeft) {
          onBack()
        }
      } else if (targetSide === 'old' && onBack) {
        const column = ref.current?.querySelector('.side-column')
        if (!column?.scrollLeft) {
          e.preventDefault()
          onBack()
        }
      }
      return
    }
    if (widget === 'nextHunk') {
      e.preventDefault()
      jumpHunk(1)
    } else if (widget === 'prevHunk') {
      e.preventDefault()
      jumpHunk(-1)
    } else if (widget === 'toggleSelect' && acts) {
      e.preventDefault()
      toggle(cursor)
    } else if (action === 'activate' && acts) {
      e.preventDefault()
      runOn('primary')
    } else if (action === 'discard' && acts?.discard) {
      e.preventDefault()
      runOn('discard')
    } else if (widget === 'selectAll' && acts) {
      e.preventDefault()
      setSelected(new Set(rows.filter((r) => r.change).map((r) => r.key)))
    } else if (action === 'dismiss') {
      if (selected.size) {
        e.preventDefault()
        setSelected(new Set())
        setAnchor(null)
      } else if (onBack) {
        e.preventDefault()
        onBack()
      }
    } else if (action === 'back' && ref.current?.scrollLeft === 0 && onBack) {
      e.preventDefault()
      onBack()
    }
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

  // The pane element is replaced when the diff changes shape (loading, empty, a different file,
  // e.g. after staging a file's last hunk). If it had focus, the new one takes it back, so the
  // keyboard stays in the diff instead of falling to the page.
  // --view-w is the visible width (without the vertical scrollbar), so hunk headers can span exactly
  // what you see while long lines scroll sideways beneath them.
  const resize = useRef<ResizeObserver | null>(null)
  const resizeFrame = useRef(0)
  const setPane = useCallback((el: HTMLDivElement | null) => {
    ref.current = el
    resize.current?.disconnect()
    cancelAnimationFrame(resizeFrame.current)
    if (!el) return
    const updateWidth = () => {
      el.style.setProperty('--view-w', `${el.clientWidth}px`)
      setPaneWidth(el.clientWidth)
    }
    updateWidth()
    resize.current = new ResizeObserver(() => {
      cancelAnimationFrame(resizeFrame.current)
      resizeFrame.current = requestAnimationFrame(updateWidth)
    })
    resize.current.observe(el)
    if (hadFocus.current && document.activeElement === document.body) el.focus({ preventScroll: true })
  }, [])
  const setSideColumn = useCallback((el: HTMLDivElement | null) => {
    if (!el) return
    let frame = 0
    const updateWidth = () => el.style.setProperty('--side-w', `${el.clientWidth}px`)
    updateWidth()
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(updateWidth)
    })
    observer.observe(el)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [])
  const paneProps = {
    ref: setPane,
    tabIndex: 0,
    ...pane.targetProps,
    ...pane.resetProps,
    onKeyDown,
    onKeyDownCapture: (e: React.KeyboardEvent) => pane.navigate(e),
    onFocus: () => {
      hadFocus.current = true
      noteDiffFocus(copySource)
    },
    onContextMenu: (e: React.MouseEvent) => {
      if (!rows.length) return
      e.preventDefault()
      void showCopyMenu(false)
    },
    onBlur: (e: React.FocusEvent<HTMLDivElement>) => {
      // Removal can blur too; only a real move elsewhere (element still in the page) counts.
      const el = e.currentTarget
      setTimeout(() => el.isConnected && (hadFocus.current = false))
    }
  }

  const layoutLabel = DIFF_LAYOUTS.find((layout) => layout.id === diffLayout)!.label
  const changeCount = diff?.hunks.length ?? 0
  const navigationDisabled = !changeCount || (changeCount === 1 && singleChangeVisible)
  const header = title && (
    <div className="diff-title">
      <span className="diff-filename" title={title}>
        {title}
      </span>
      {metadata}
      <Toolbar className="diff-controls" aria-label="Diff tools" ref={toolsRef}>
        {files && (
          <span className="diff-navigation-group">
            <Tip label="Previous file" keys="Alt+PageUp">
              <Button className="icon-btn" aria-label="Previous file" isDisabled={files.index <= 0} onPress={() => moveFile(-1)}>
                <Icon name="chevronLeft" size={14} />
              </Button>
            </Tip>
            <span className="diff-counter" aria-label={`File ${files.index + 1} of ${files.count}`}>
              File {files.index + 1} of {files.count}
            </span>
            <Tip label="Next file" keys="Alt+PageDown">
              <Button
                className="icon-btn"
                aria-label="Next file"
                isDisabled={files.index < 0 || files.index >= files.count - 1}
                onPress={() => moveFile(1)}
              >
                <Icon name="chevronRight" size={14} />
              </Button>
            </Tip>
          </span>
        )}
        {!plain && (
          <>
            <span className="diff-navigation-group">
              <Tip label={changeCount === 1 ? 'Reveal change' : 'Previous change'} keys="P">
                <Button
                  className="icon-btn"
                  aria-label={changeCount === 1 ? 'Reveal change' : 'Previous change'}
                  isDisabled={navigationDisabled}
                  onPress={() => jumpHunk(-1)}
                >
                  <Icon name="arrowUp" size={14} />
                </Button>
              </Tip>
              <span
                className="diff-counter"
                aria-label={
                  changeCount
                    ? `Change ${cursorHunk + 1} of ${changeCount}${changeCount === 1 && singleChangeVisible ? ', already visible' : ''}`
                    : 'No changes'
                }
                title={changeCount === 1 && singleChangeVisible ? 'The only change is already visible' : undefined}
              >
                {changeCount ? `${cursorHunk + 1} of ${changeCount}` : loading && text === null ? 'Loading…' : 'No changes'}
              </span>
              <Tip label={changeCount === 1 ? 'Reveal change' : 'Next change'} keys="N">
                <Button
                  className="icon-btn"
                  aria-label={changeCount === 1 ? 'Reveal change' : 'Next change'}
                  isDisabled={navigationDisabled}
                  onPress={() => jumpHunk(1)}
                >
                  <Icon name="arrowDown" size={14} />
                </Button>
              </Tip>
            </span>
            <span className="diff-context-group">
              <Tip label="Show less context" keys="Ctrl+Shift+-">
                <Button
                  className="icon-btn"
                  aria-label="Show less context"
                  isDisabled={context <= CONTEXT_STEPS[0]}
                  onPress={showLessContext}
                >
                  <Icon name="minus" size={14} />
                </Button>
              </Tip>
              <span className="diff-context-value" aria-label={`Context: ${isFullContext(context) ? 'whole file' : `${context} lines`}`}>
                Context {contextLabel(context)}
              </span>
              <Tip label="Show more context" keys="Ctrl+Shift+=">
                <Button className="icon-btn" aria-label="Show more context" isDisabled={isFullContext(context)} onPress={showMoreContext}>
                  <Icon name="plus" size={14} />
                </Button>
              </Tip>
              <Tip label="Show the whole file" keys="Ctrl+Shift+W">
                <Button className="diff-full-button" aria-pressed={isFullContext(context)} onPress={toggleFullContext}>
                  Full file
                </Button>
              </Tip>
            </span>
            <MenuTrigger>
              <Tip label="Diff layout" keys="Ctrl+Shift+D">
                <Button
                  className="diff-layout-button"
                  aria-label={`Diff layout: ${layoutLabel}${diffLayout === 'auto' ? ` (currently ${split ? 'side by side' : 'inline'})` : ''}`}
                >
                  {layoutLabel}
                  <Icon name="chevronDown" size={12} />
                </Button>
              </Tip>
              <Popover className="menu-popover" placement="bottom end">
                <MenuNavigation>
                  <Menu
                    className="menu"
                    aria-label="Diff layout"
                    selectionMode="single"
                    disallowEmptySelection
                    selectedKeys={[diffLayout]}
                    onAction={(id) => changeDiffLayout(id as DiffLayout)}
                  >
                    {DIFF_LAYOUTS.map((layout) => (
                      <MenuItem key={layout.id} id={layout.id} className="menu-item row" textValue={layout.label}>
                        {({ isSelected }) => (
                          <>
                            <span className="menu-check">{isSelected && <Icon name="check" size={14} />}</span>
                            <span className="menu-label">{layout.label}</span>
                          </>
                        )}
                      </MenuItem>
                    ))}
                  </Menu>
                </MenuNavigation>
              </Popover>
            </MenuTrigger>
          </>
        )}
      </Toolbar>
    </div>
  )
  const empty = (content: ReactNode) => (
    <div className="diff-wrap" {...pane.ownerProps} onKeyDownCapture={onFileKey}>
      {header}
      <PaneFrame>
        <div className="diff diff-empty" {...paneProps}>
          {content}
        </div>
      </PaneFrame>
    </div>
  )

  if (diff === null) return empty(loading ? 'Loading…' : emptyText)
  if (diff.binary) return empty('Binary file — no preview')
  if (!diff.hunks.length) {
    const info = diff.header.filter((l) => !/^(diff --git|index |--- |\+\+\+ )/.test(l))
    return empty(info.length ? info.map((l, i) => <div key={i}>{l}</div>) : 'No content changes')
  }

  const n = selected.size
  const hint = acts
    ? `Diff. ↑↓ move${split ? ', ←→ switch sides' : ''}, Shift+↑↓ or Space select lines, Enter to ${acts.primary.label.toLowerCase()}${acts.discard ? ', Delete to discard' : ''}, N/P next/previous hunk`
    : `Diff. ↑↓ move${split ? ', ←→ switch sides' : ''}, N/P next/previous hunk`

  // Rows of a long diff are measured once rendered (see the virtualizer above).
  const slot = (i: number) => (virtualize ? { ref: virtual.measureElement, 'data-index': i } : {})
  const renderLine = (i: number | null, index: number, key: string, targetSide?: 'old' | 'new', hunk?: number) => {
    if (i === null) return <div key={key} {...slot(index)} className="dl side-blank" aria-hidden="true" />
    const r = rows[i]
    const l = diff.hunks[r.hunk].lines[r.line]
    return (
      <div
        key={key}
        {...slot(index)}
        data-idx={i}
        data-side={targetSide}
        className={`dl ${l.type} ${i === cursor && (!targetSide || targetSide === cursorSide) ? 'cursor' : ''} ${selected.has(r.key) ? 'picked' : ''} ${(hunk ?? r.hunk) === cursorHunk ? 'active-hunk' : ''}`}
        onMouseDown={(e) => onLineMouseDown(e, i, targetSide)}
        onMouseEnter={() => onLineMouseEnter(i)}
      >
        <span className="gutter">
          {targetSide ? (
            <span className="ln">{(targetSide === 'old' ? l.oldNo : l.newNo) ?? ''}</span>
          ) : (
            <>
              <span className="ln">{l.oldNo ?? ''}</span>
              <span className="ln">{l.newNo ?? ''}</span>
            </>
          )}
          <span className="sign">{l.type === 'add' ? '+' : l.type === 'del' ? '-' : ''}</span>
        </span>
        {codeOf(r)}
      </div>
    )
  }
  const renderHeader = (hi: number, index: number, key: string, targetSide?: 'old' | 'new') => {
    const h = diff.hunks[hi]
    const patch = () => hunkPatch(diff, h)
    return (
      <div key={key} {...slot(index)} className={`hunk-slot ${hi > 0 ? 'gap' : ''}`}>
        <div className={`hunk-header ${hi === cursorHunk ? 'active-hunk' : ''}`}>
          <span className="hunk-range" title={h.header}>
            {h.header}
          </span>
          {acts && targetSide !== 'old' && (
            <span className="hunk-actions">
              {acts.discard && (
                <Tip label="Discard this hunk" placement="top">
                  <button className="btn" tabIndex={-1} onClick={() => acts.discard!.run(patch())}>
                    {acts.discard.label}
                    {!targetSide && ' hunk'}
                  </button>
                </Tip>
              )}
              <Tip label={`${acts.primary.label} this hunk`} placement="top">
                <button className="btn primary" tabIndex={-1} onClick={() => acts.primary.run(patch())}>
                  {acts.primary.label}
                  {!targetSide && ' hunk'}
                </button>
              </Tip>
            </span>
          )}
        </div>
      </div>
    )
  }
  const renderItem = (index: number, targetSide?: 'old' | 'new') => {
    const item = items[index]
    if (!item) return null
    if (item.header) return renderHeader(item.hunk, index, item.key, targetSide)
    if (targetSide) return renderLine(sideRows[item.pos!][targetSide], index, item.key, targetSide, item.hunk)
    return renderLine(item.row!, index, item.key)
  }
  // Only the items near the viewport are rendered when virtualizing; spacers stand in for the rest.
  const itemList = (targetSide?: 'old' | 'new') => (
    <div style={virtualize ? spacer : undefined}>
      {(virtualize ? windowed : items.map((_, i) => ({ index: i }))).map((v) => renderItem(v.index, targetSide))}
    </div>
  )
  const truncation = truncated && (
    <div className="diff-truncated">
      Large diff truncated.{' '}
      <button className="link" onClick={() => setShowAll(true)}>
        Show everything
      </button>
    </div>
  )
  return (
    <div className={`diff-wrap ${plain ? 'plain' : ''}`} {...pane.ownerProps} onKeyDownCapture={onFileKey}>
      {header}
      {notice && (
        <div className="diff-notice" role="note">
          <Icon name="info" size={14} />
          {notice}
        </div>
      )}
      <PaneFrame>
        <div className={`diff ${split ? 'side-mode' : ''} ${acts ? 'selectable' : ''}`} {...paneProps} aria-label={hint}>
          {split ? (
            <div
              className="side-columns"
              onMouseDownCapture={(e) => {
                // Text selection stays within the column where the drag began, so a copy never interleaves both sides.
                const column = (e.target as HTMLElement).closest<HTMLElement>('.side-column')
                if (column) e.currentTarget.dataset.selectSide = column.dataset.side
              }}
            >
              {(['old', 'new'] as const).map((targetSide) => (
                <div
                  className="side-column"
                  key={targetSide}
                  data-side={targetSide}
                  tabIndex={-1}
                  ref={setSideColumn}
                  aria-label={targetSide === 'old' ? 'Before' : 'After'}
                  onFocus={(e) => {
                    // Deferred: moving focus while the browser is still starting a mouse selection cancels the selection.
                    const column = e.currentTarget
                    if (e.target === column)
                      setTimeout(() => {
                        if (document.activeElement === column) ref.current?.focus({ preventScroll: true })
                      })
                  }}
                  onScroll={(e) => {
                    const other = e.currentTarget.parentElement?.querySelector<HTMLElement>(
                      `.side-column[data-side="${targetSide === 'old' ? 'new' : 'old'}"]`
                    )
                    if (other && other.scrollTop !== e.currentTarget.scrollTop) other.scrollTop = e.currentTarget.scrollTop
                  }}
                >
                  <div className="side-inner">
                    {itemList(targetSide)}
                    {truncation}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="diff-inner">
              {itemList()}
              {truncation}
            </div>
          )}
        </div>
      </PaneFrame>
      {/* Floats over the diff (space is reserved at the bottom), so selecting never moves the lines. */}
      {acts && (
        <div className={`line-actions ${n > 0 ? 'visible' : ''}`} role="status" inert={n === 0}>
          <span>
            {n} {n === 1 ? 'line' : 'lines'} selected
          </span>
          {acts.discard && (
            <Tip label="Discard selected lines" keys="Delete" placement="top">
              <button className="btn" onClick={() => fromBar(() => runOn('discard'))}>
                {acts.discard.label}
              </button>
            </Tip>
          )}
          <Tip label={`${acts.primary.label} selected lines`} keys="Enter" placement="top">
            <button className="btn primary" onClick={() => fromBar(() => runOn('primary'))}>
              {acts.primary.label} lines
            </button>
          </Tip>
          <Tip label="Clear selection" keys="Esc" placement="top">
            <button className="icon-btn" aria-label="Clear selection" onClick={() => fromBar(() => setSelected(new Set()))}>
              <Icon name="x" size={14} />
            </button>
          </Tip>
        </div>
      )}
    </div>
  )
}
