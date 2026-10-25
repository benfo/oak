import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { parseDiff, type FileDiff } from './diff'
import { resolveDiffLayout } from './diffLayout'
import {
  canHandleNavigation,
  fileNavigationDirection,
  handleNavigation,
  horizontalScrollDirection,
  movementDelta,
  navigationAction
} from '../lib/navigation'
import { widgetAction } from '../lib/keymap'
import { shortcutPlatform } from '../lib/shortcuts'
import { usePane } from '../lib/usePane'
import { Tip } from '../components/Tip'
import { PaneFrame } from '../components/Pane'
import { Icon } from '../components/Icon'
import { useSettings } from '../settings'
import { useContextLines } from './useDiffContext'
import { noteDiffFocus } from './diffCopy'
import type { DiffActions, DiffSide } from './diffTypes'
import { useDiffRows } from './useDiffRows'
import { useDiffScroll } from './useDiffScroll'
import { useDiffCode } from './useDiffCode'
import { useDiffSelection } from './useDiffSelection'
import { useDiffCopy } from './useDiffCopy'
import { useDiffPane } from './useDiffPane'
import { DiffToolbar } from './DiffToolbar'
import { renderDiffItems } from './DiffItems'
import { SideColumns } from './SideColumns'

export type { DiffActions }

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
  /** Put the cursor on the line with this new-side number, scroll to it and focus the diff, then call `onRevealed` (also when there is no such line). */
  revealLine?: number
  onRevealed?: () => void
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
  plain = false,
  revealLine,
  onRevealed
}: Props) {
  const diff = useMemo(() => (text === null ? null : parseDiff(text)), [text])
  const acts = diff && actions ? actions(diff) : null
  const notice = diff && !acts && readOnlyReason ? readOnlyReason(diff) : null
  const [showAll, setShowAll] = useState(false)
  const [cursor, setCursor] = useState(0)
  const [side, setSide] = useState<DiffSide>('new')
  const pendingHunk = useRef<number | null>(null)
  const { ref, hadFocus, paneWidth, setPane, setSideColumn } = useDiffPane()

  const { syntaxHighlighting, showWhitespace, diffLayout, vimNavigation } = useSettings()
  const split = !plain && resolveDiffLayout(diffLayout, paneWidth) === 'split'
  const { rows, truncated, sideRows, positions, items, rowItem, posItem, itemRow } = useDiffRows(diff, showAll, split)
  const lineType = rows[cursor] && diff?.hunks[rows[cursor].hunk].lines[rows[cursor].line].type
  const cursorSide = lineType === 'del' ? 'old' : lineType === 'add' ? 'new' : side
  const cursorHunk = rows[cursor]?.hunk ?? 0

  const scroll = useDiffScroll({ ref, diff, split, cursor, cursorSide, rows, items, rowItem, posItem, positions, itemRow })
  const codeOf = useDiffCode(diff, text, rows, syntaxHighlighting, showWhitespace)
  const selection = useDiffSelection({
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
  })
  const { selected } = selection
  const { copySource, showCopyMenu } = useDiffCopy({ diff, rows, cursor, selected, ref })

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
    selection.clear()
    pendingHunk.current = null
    const source = shownContext.current !== context ? cursorSource.current : null
    shownContext.current = context
    const same = source === null ? undefined : rows.find((r) => diff?.hunks[r.hunk].lines[r.line].newNo === source)
    setCursor((c) => (same ? same.index : Math.max(0, Math.min(c, rows.length - 1))))
  }, [text])

  // After the [text] effect above, so a new diff's cursor reset doesn't undo it.
  useEffect(() => {
    if (revealLine === undefined || !diff) return
    const row = rows.find((r) => diff.hunks[r.hunk].lines[r.line].newNo === revealLine)
    if (!row && truncated && !showAll) return setShowAll(true)
    if (row) {
      setCursor(row.index)
      setSide('new')
      scroll.revealRow(row.index, 'center')
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
      scroll.revealRow(row.index, 'center')
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
    scroll.revealRow(idx, 'center')
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
      if (e.shiftKey && acts) selection.extendTo(next)
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
      selection.toggle(cursor)
    } else if (action === 'activate' && acts) {
      e.preventDefault()
      selection.runOn('primary')
    } else if (action === 'discard' && acts?.discard) {
      e.preventDefault()
      selection.runOn('discard')
    } else if (widget === 'selectAll' && acts) {
      e.preventDefault()
      selection.selectAllChanges()
    } else if (action === 'dismiss') {
      if (selected.size) {
        e.preventDefault()
        selection.clear()
      } else if (onBack) {
        e.preventDefault()
        onBack()
      }
    } else if (action === 'back' && ref.current?.scrollLeft === 0 && onBack) {
      e.preventDefault()
      onBack()
    }
  }

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

  const header = title && (
    <DiffToolbar
      title={title}
      metadata={metadata}
      files={files}
      plain={plain}
      split={split}
      diffLayout={diffLayout}
      changeCount={diff?.hunks.length ?? 0}
      currentChange={cursorHunk}
      singleChangeVisible={scroll.singleChangeVisible}
      counterEmpty={loading && text === null ? 'Loading…' : 'No changes'}
      moveFile={moveFile}
      jumpHunk={jumpHunk}
    />
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
  const itemList = (targetSide?: DiffSide) =>
    renderDiffItems(
      {
        diff,
        rows,
        items,
        sideRows,
        acts,
        cursor,
        cursorSide,
        cursorHunk,
        selected,
        codeOf,
        measure: scroll.measure,
        windowed: scroll.windowed,
        spacer: scroll.spacer,
        onLineMouseDown: selection.onLineMouseDown,
        onLineMouseEnter: selection.onLineMouseEnter
      },
      targetSide
    )
  const truncation = truncated && (
    <div className="diff-truncated">
      Large diff truncated.{' '}
      <button className="link" onClick={() => setShowAll(true)}>
        Show everything
      </button>
    </div>
  )
  // The bar goes inert once the selection clears, so keep focus on the diff rather than losing it.
  const fromBar = (run: () => void) => {
    ref.current?.focus({ preventScroll: true })
    run()
  }
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
            <SideColumns
              setColumn={setSideColumn}
              focusPane={() => ref.current?.focus({ preventScroll: true })}
              renderColumn={(targetSide) => (
                <div className="side-inner">
                  {itemList(targetSide)}
                  {truncation}
                </div>
              )}
            />
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
              <button className="btn" onClick={() => fromBar(() => selection.runOn('discard'))}>
                {acts.discard.label}
              </button>
            </Tip>
          )}
          <Tip label={`${acts.primary.label} selected lines`} keys="Enter" placement="top">
            <button className="btn primary" onClick={() => fromBar(() => selection.runOn('primary'))}>
              {acts.primary.label} lines
            </button>
          </Tip>
          <Tip label="Clear selection" keys="Esc" placement="top">
            <button className="icon-btn" aria-label="Clear selection" onClick={() => fromBar(selection.clear)}>
              <Icon name="x" size={14} />
            </button>
          </Tip>
        </div>
      )}
    </div>
  )
}
