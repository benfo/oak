import type React from 'react'
import { isListSearchKey, widgetAction, type WidgetAction } from './keymap.ts'
import { shortcutPlatform } from './shortcuts.ts'

export { isListSearchKey }

/** Shared policy. Components provide actions; React Aria keeps collection/selection mechanics. */
export type NavigationAction = 'activate' | 'deeper' | 'back' | 'dismiss' | 'discard' | 'menu' | 'switchList' | 'switchView'
export type NavigationActions = Partial<Record<NavigationAction, () => void>>

const COMMON_ACTIONS: ReadonlySet<WidgetAction> = new Set([
  'activate',
  'deeper',
  'back',
  'dismiss',
  'discard',
  'menu',
  'switchList',
  'switchView'
])

/** The common pane action for a key; the key table itself lives in lib/keymap.ts. */
export function navigationAction(e: KeyInput): NavigationAction | undefined {
  const action = widgetAction(e, 'list', shortcutPlatform())
  return action && COMMON_ACTIONS.has(action) ? (action as NavigationAction) : undefined
}

/** Native controls own their keys, including buttons nested inside a collection row. */
export function isNavigationControl(target: EventTarget | null) {
  return !!(target as HTMLElement | null)?.closest?.(
    'input, textarea, select, button, [contenteditable]:not([contenteditable="false"]), [role="textbox"]'
  )
}

export function canHandleNavigation(e: React.KeyboardEvent) {
  return !e.defaultPrevented && !e.nativeEvent.isComposing && !isNavigationControl(e.target)
}

/** Only consume an action the current area actually supports. Child handlers run first. */
export function handleNavigation(e: React.KeyboardEvent, actions: NavigationActions, { allowTextInput = false } = {}) {
  if (allowTextInput ? e.defaultPrevented : !canHandleNavigation(e)) return false
  const action = navigationAction(e.nativeEvent)
  const run = action && actions[action]
  if (!run) return false
  e.preventDefault()
  e.stopPropagation()
  run()
  return true
}

/** Collection movement shared by custom lists, graph cursors and diff rows. */
const halfPageEvents = new WeakSet<object>()

/** Synthetic page keys retain their meaning in both custom panes and library collections. */
export function markHalfPage(event: object) {
  halfPageEvents.add(event)
}

export function movementDelta(key: string, page = 10, event?: object): number | undefined {
  if (event && halfPageEvents.has(event)) page = Math.max(1, Math.floor(page / 2))
  return ({ ArrowDown: 1, ArrowUp: -1, PageDown: page, PageUp: -page, Home: -Infinity, End: Infinity } as Record<string, number>)[key]
}

/** File browsing is separate from line/page movement and N/P hunk navigation. */
export function fileNavigationDirection(e: KeyInput): -1 | 1 | 'first' | 'last' | undefined {
  const action = widgetAction(e, 'diff', shortcutPlatform())
  return action === 'filePrev'
    ? -1
    : action === 'fileNext'
      ? 1
      : action === 'fileFirst'
        ? 'first'
        : action === 'fileLast'
          ? 'last'
          : undefined
}

/**
 * Shared keyboard behaviour for list panes: ↑/↓, PageUp/PageDown and Home/End move the selection.
 * With no selection, ↓ selects the first item and ↑ the last. Returns true when the key was handled.
 */
export function handleListNav(e: React.KeyboardEvent, count: number, index: number, select: (i: number) => void, page = 10) {
  if (!canHandleNavigation(e) || e.altKey || e.ctrlKey || e.metaKey || !count) return false
  const delta = movementDelta(e.key, page, e.nativeEvent)
  if (delta === undefined) return false
  e.preventDefault()
  const base = index < 0 ? (delta > 0 ? -1 : count) : index
  select(Math.max(0, Math.min(count - 1, base + delta)))
  return true
}

export function focusPane(selector: string) {
  const el = document.querySelector<HTMLElement>(selector)
  if (el && el.offsetParent !== null) {
    el.focus()
    return true
  }
  return false
}

/** Persistent find fields keep focus for repeated matches; leaving search is explicit. */
export function handleSearchNavigation(e: React.KeyboardEvent, find: (backwards: boolean) => void, leave: () => void) {
  if (e.defaultPrevented || e.nativeEvent.isComposing || e.ctrlKey || e.metaKey || e.altKey) return
  if (e.key !== 'Enter' && e.key !== 'Escape' && e.key !== 'Tab') return
  e.preventDefault()
  e.stopPropagation()
  if (e.key === 'Enter') find(e.shiftKey)
  else if (e.key === 'Escape') leave()
  // The field precedes its list: Tab enters it, Shift+Tab goes to the preceding pane.
  else if (e.shiftKey) cyclePanes(true)
  else leave()
}

/** Escape on a pane tool (a control beside, not inside, its pane's focus target) returns to
 * that pane. Attach to the owner element; keys from the pane itself, menus and text editing
 * keep their own meaning.
 */
export function handleToolNavigation(e: React.KeyboardEvent, focusOwner: (paneId: string) => boolean = focusPaneById) {
  if (e.defaultPrevented || e.key !== 'Escape' || e.nativeEvent.isComposing || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey)
    return false
  const owner = e.currentTarget as HTMLElement
  const target = e.target as HTMLElement
  const paneId = owner.dataset.paneOwner
  if (
    !paneId ||
    !owner.contains(target) ||
    target.closest('[data-pane], input, textarea, [contenteditable]:not([contenteditable="false"])')
  )
    return false
  if (!focusOwner(paneId)) return false
  e.preventDefault()
  e.stopPropagation()
  return true
}

function focusPaneById(paneId: string) {
  return focusPane(`[data-pane="${CSS.escape(paneId)}"]`)
}

/** Keep the resize library's keys local and F6 consistent with every other control. */
export function handleResizeNavigation(e: React.KeyboardEvent, leave: () => void) {
  if (e.defaultPrevented) return
  const libraryKey = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Enter', 'F6'].includes(e.key)
  if (e.nativeEvent.isComposing || e.ctrlKey || e.metaKey || e.altKey || (e.shiftKey && e.key !== 'F6')) {
    // The library's native key listener does not guard modifiers/composition. Stop
    // those resize keys before the target listener without consuming other shortcuts.
    if (libraryKey) e.stopPropagation()
    return
  }
  if (e.key !== 'Escape' && e.key !== 'F6') return
  e.preventDefault()
  e.stopPropagation()
  if (e.key === 'Escape') leave()
  else cyclePanes(e.shiftKey)
}

/** Panes in Tab order. F6 / Shift+F6 cycle through the visible ones. */
export function cyclePanes(backwards: boolean) {
  const active = document.activeElement as HTMLElement | null
  // Menus and dialogs own their focus. Never cycle into the repository behind an overlay.
  const scope =
    active?.closest('[role="dialog"], [role="menu"]') ??
    document.querySelector('[aria-modal="true"], .palette.dropdown, .menu-popover') ??
    document
  const panes = [...scope.querySelectorAll<HTMLElement>('[data-pane]')].filter((el) => el.offsetParent !== null && !el.closest('[inert]'))
  if (!panes.length) return
  // Pane tools and forms may sit beside the pane's focus target rather than inside it.
  // Resolve their owner without adding another Tab stop or taking keys from controls.
  const ownerElement = active?.closest<HTMLElement>('[data-pane-owner], [data-search-pane]')
  const owner = ownerElement?.dataset.paneOwner ?? ownerElement?.dataset.searchPane
  const current = panes.findIndex((p) => p.contains(active) || p.dataset.pane === owner)
  const next = panes[current < 0 ? (backwards ? panes.length - 1 : 0) : (current + (backwards ? -1 : 1) + panes.length) % panes.length]
  // A toolbar pane forwards focus to a button; React Aria then restores the one used last.
  const target = next.matches('[role=toolbar]') ? (next.querySelector<HTMLElement>('button:not(:disabled)') ?? next) : next
  target.focus()
}

/** Keeps the active row of a list scrolled into view. */
export function revealActive(container: HTMLElement | null) {
  container?.querySelector('.active, .selected')?.scrollIntoView({ block: 'nearest' })
}

/**
 * React Aria's Toolbar handles ←/→ and makes the toolbar one Tab stop; this adds Home/End.
 * Returns a cleanup function (for useEffect).
 */
export function toolbarHomeEnd(toolbar: HTMLElement | null) {
  if (!toolbar) return
  const onKey = (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.isComposing || (e.key !== 'Home' && e.key !== 'End') || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey)
      return
    const list = [...toolbar.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
    const btn = e.key === 'Home' ? list[0] : list[list.length - 1]
    if (!btn) return
    e.preventDefault()
    btn.focus()
  }
  toolbar.addEventListener('keydown', onKey)
  return () => toolbar.removeEventListener('keydown', onKey)
}

/** Focuses the Changes file list that holds the current selection, else the first non-empty one. */
export function focusFiles() {
  return (
    focusPane('.changes-files .file-grid.lead') ||
    focusPane('.changes-files .file-grid:not(.empty)') ||
    focusPane('.changes-files .file-grid')
  )
}

interface KeyInput {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
  isComposing: boolean
}

/** Only plain lowercase navigation keys; modified keys and IME input keep their usual meaning. */
export function vimArrow(e: KeyInput): string | undefined {
  if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || e.isComposing) return
  return ({ h: 'ArrowLeft', j: 'ArrowDown', k: 'ArrowUp', l: 'ArrowRight' } as Record<string, string>)[e.key]
}

/** Only gg is a sequence; any other key, focus change or pointer action cancels it. */
export function createVimMotions() {
  let pending: { target: object; until: number } | null = null
  const reset = () => {
    pending = null
  }
  return {
    reset,
    read(
      e: KeyInput & { repeat?: boolean },
      target: object,
      now = Date.now()
    ): 'prefix' | 'Home' | 'End' | 'PageDown' | 'PageUp' | undefined {
      const previous = pending
      reset()
      if (e.isComposing || e.altKey || e.metaKey) return
      if (e.ctrlKey) {
        if (!e.shiftKey && e.key.toLowerCase() === 'd') return 'PageDown'
        if (!e.shiftKey && e.key.toLowerCase() === 'u') return 'PageUp'
        return
      }
      if (e.key === 'G') return 'End'
      if (e.key !== 'g' || e.shiftKey) return
      // Holding g is not gg. Repeats neither complete nor extend the sequence.
      if (e.repeat) {
        pending = previous
        return 'prefix'
      }
      if (previous?.target === target && now <= previous.until) return 'Home'
      pending = { target, until: now + 1000 }
      return 'prefix'
    }
  }
}

/** Horizontal scrolling is separate from pane/column navigation and line selection. */
export function horizontalScrollDirection(
  e: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'ctrlKey' | 'metaKey' | 'altKey' | 'isComposing'>,
  vimNavigation: boolean
): -1 | 0 | 1 {
  if (!e.shiftKey || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return 0
  if (e.key === 'ArrowLeft' || (vimNavigation && e.key.toLowerCase() === 'h')) return -1
  if (e.key === 'ArrowRight' || (vimNavigation && e.key.toLowerCase() === 'l')) return 1
  return 0
}
