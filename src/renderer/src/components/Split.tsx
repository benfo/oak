import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Group, Panel, Separator, usePanelRef } from 'react-resizable-panels'
import { handleResizeNavigation } from '../lib/navigation'
import { registerSplit, resizeFocusedPane, RESIZE_KEYS, type ResizeKey } from '../lib/paneResize'

interface Props {
  id: string
  /** Accessible name of the divider and its command-picker entry. */
  label: string
  /** 'row' places panes side by side; 'column' stacks them. */
  dir?: 'row' | 'column'
  /** Initial size of the first pane in px. */
  initial: number
  min?: number
  max?: number
  /** Controlled first-pane visibility; never collapse implicitly while dragging. */
  collapsed?: boolean
  /** Maximize the first pane while keeping the second pane mounted. */
  restCollapsed?: boolean
  children: [ReactNode, ReactNode]
}

const load = (id: string, fallback: number) => {
  try {
    const v = Number(localStorage.getItem(`split:${id}`))
    return Number.isFinite(v) && v > 0 ? v : fallback
  } catch {
    return fallback
  }
}

/** The library owns pointer/keyboard resizing, bounds, ARIA values and resize observation.
 * Oak keeps its pixel preferences and explicit pane navigation.
 */
export function Split({ id, label, dir = 'row', initial, min = 120, max = 2000, collapsed, restCollapsed, children }: Props) {
  const [size] = useState(() => load(id, initial))
  const group = useRef<HTMLDivElement | null>(null)
  const separator = useRef<HTMLDivElement | null>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const panel = usePanelRef()
  const restoreSize = useRef<number | null>(null)
  useLayoutEffect(() => {
    // Re-enabling the library separator restores its default tabIndex as well.
    if (separator.current) separator.current.tabIndex = -1
    if (collapsed === undefined && restCollapsed === undefined) return
    // The library settles changed constraints before its panel resize notification.
    // Restore from that notification, rather than resizing against the old zero bound.
    restoreSize.current = collapsed || restCollapsed ? null : load(id, size)
  }, [collapsed, restCollapsed, id, size])
  useEffect(() => {
    const element = group.current
    if (!element) return
    return registerSplit(element, {
      enabled: () => !collapsed && !restCollapsed,
      resizeBy: (delta) => {
        const p = panel.current
        if (!p) return
        p.resize(Math.min(max, Math.max(min, p.getSize().inPixels + delta)))
        // Imperative resizes are not "user interactions" to the library, so persist here once it settles.
        requestAnimationFrame(() => {
          try {
            localStorage.setItem(`split:${id}`, String(Math.round(p.getSize().inPixels)))
          } catch {
            /* Session only. */
          }
        })
      }
    })
  }, [id, min, max, collapsed, restCollapsed])
  const setSeparator = useCallback((el: HTMLDivElement | null) => {
    separator.current = el
    // Separator exposes elementRef but not a tabIndex prop. It remains focusable via
    // Resize panes… and pointer input while collections keep their existing Tab path.
    if (el) el.tabIndex = -1
  }, [])

  return (
    <Group
      id={`split-${id}`}
      className={`split split-${dir}`}
      elementRef={group}
      orientation={dir === 'row' ? 'horizontal' : 'vertical'}
      onLayoutChanged={(layout, { isUserInteraction }) => {
        if (!isUserInteraction || collapsed || restCollapsed) return
        if (!group.current || !separator.current) return
        // The callback precedes the imperative panel ref's update. Convert its
        // committed percentage using the available panel space, excluding the divider.
        const axis = dir === 'row' ? 'width' : 'height'
        const available = group.current.getBoundingClientRect()[axis] - separator.current.getBoundingClientRect()[axis]
        const pixels = (available * layout[`${id}-first`]) / 100
        try {
          localStorage.setItem(`split:${id}`, String(Math.round(pixels)))
        } catch {
          /* Session only. */
        }
      }}
      onFocusCapture={(e) => {
        if (e.target !== separator.current) return
        const from = e.relatedTarget instanceof HTMLElement ? e.relatedTarget : null
        returnFocus.current = from
        const owner = from?.closest<HTMLElement>('[data-pane], [data-pane-owner], [data-search-pane]')
        const pane = owner?.dataset.pane ?? owner?.dataset.paneOwner ?? owner?.dataset.searchPane
        if (pane) separator.current!.dataset.paneOwner = pane
        else separator.current!.removeAttribute('data-pane-owner')
      }}
    >
      <Panel
        id={`${id}-first`}
        className="split-pane"
        defaultSize={collapsed ? 0 : restCollapsed ? '100%' : size}
        minSize={collapsed || restCollapsed ? 0 : min}
        maxSize={collapsed ? 0 : restCollapsed ? '100%' : max}
        hidden={collapsed}
        inert={collapsed}
        aria-hidden={collapsed || undefined}
        onResize={() => {
          if (restoreSize.current === null || collapsed) return
          const pixels = restoreSize.current
          restoreSize.current = null
          panel.current?.resize(pixels)
        }}
        groupResizeBehavior="preserve-pixel-size"
        panelRef={panel}
      >
        {children[0]}
      </Panel>
      <Separator
        id={`${id}-divider`}
        className="split-handle"
        aria-label={label}
        elementRef={setSeparator}
        disableDoubleClick
        disabled={collapsed || restCollapsed}
        hidden={collapsed || restCollapsed}
        onKeyDownCapture={(e) => {
          // A clicked divider keeps focus; the pane-resize shortcut must still work and skip the library's own handler.
          if (
            e.altKey &&
            e.shiftKey &&
            !e.ctrlKey &&
            !e.metaKey &&
            !e.nativeEvent.isComposing &&
            RESIZE_KEYS.includes(e.key as ResizeKey)
          ) {
            e.preventDefault()
            e.stopPropagation()
            resizeFocusedPane(e.key as ResizeKey, e.currentTarget)
            return
          }
          handleResizeNavigation(e, () => {
            if (returnFocus.current?.isConnected) returnFocus.current.focus({ preventScroll: true })
          })
        }}
      />
      <Panel
        id={`${id}-rest`}
        className="split-pane split-rest"
        minSize={restCollapsed ? 0 : 80}
        maxSize={restCollapsed ? 0 : '100%'}
        hidden={restCollapsed}
        inert={restCollapsed}
        aria-hidden={restCollapsed || undefined}
      >
        {children[1]}
      </Panel>
    </Group>
  )
}
