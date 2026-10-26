import type { RefObject } from 'react'
import {
  canHandleNavigation,
  fileNavigationDirection,
  handleNavigation,
  handleDismissNavigation,
  horizontalScrollDirection,
  movementDelta,
  navigationAction
} from '../lib/navigation'
import { widgetAction } from '../lib/keymap'
import { shortcutPlatform } from '../lib/shortcuts'
import type { DiffActions, DiffSide, Row, SidePair } from './diffTypes'
import type { useDiffSelection } from './useDiffSelection'
import type { useDiffFind } from './useDiffFind'

interface Options {
  ref: RefObject<HTMLDivElement | null>
  vimNavigation: boolean
  split: boolean
  cursorSide: DiffSide
  cursor: number
  rows: Row[]
  positions: Map<number, number>
  sideRows: SidePair[]
  acts: DiffActions | null
  selection: ReturnType<typeof useDiffSelection>
  find: ReturnType<typeof useDiffFind>
  setCursor: (row: number) => void
  setSide: (side: DiffSide) => void
  onSwitchView?: () => void
  onBack?: () => void
  showCopyMenu: (keyboard: boolean) => Promise<void>
  jumpHunk: (delta: number) => void
}

/** Diff widget keys, kept separate from rendering and data loading. */
export function useDiffNavigation({
  ref,
  vimNavigation,
  split,
  cursorSide,
  cursor,
  rows,
  positions,
  sideRows,
  acts,
  selection,
  find,
  setCursor,
  setSide,
  onSwitchView,
  onBack,
  showCopyMenu,
  jumpHunk
}: Options) {
  const { selected } = selection
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!canHandleNavigation(e)) return
    const action = navigationAction(e.nativeEvent)
    const widget = widgetAction(e.nativeEvent, 'diff', shortcutPlatform())
    const horizontal = horizontalScrollDirection(e.nativeEvent, vimNavigation)
    if (widget === 'find' && rows.length) {
      e.preventDefault()
      find.open()
      return
    }
    if (handleDismissNavigation(e, [find.query !== null ? find.close : undefined, selected.size ? selection.clear : undefined])) return
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
      handleNavigation(e, { back: onBack })
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
    } else if (action === 'back' && ref.current?.scrollLeft === 0 && onBack) {
      e.preventDefault()
      onBack()
    }
  }

  return onKeyDown
}

/** Keep file stepping available from code and its toolbar, without taking text-editing keys. */
export function useDiffFileNavigation(
  files: { index: number; count: number; onSelect: (index: number) => void } | undefined,
  ref: RefObject<HTMLDivElement | null>
) {
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

  return { moveFile, onFileKey }
}
