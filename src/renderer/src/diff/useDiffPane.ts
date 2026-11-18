import { useCallback, useRef, useState, type FocusEvent, type KeyboardEvent, type MouseEvent, type RefObject } from 'react'
import type { usePane } from '../lib/usePane'

/**
 * The pane elements and their sizes. The pane element is replaced when the diff changes shape (loading, empty, a
 * different file, e.g. after staging a file's last hunk). If it had focus, the new one takes it back, so the
 * keyboard stays in the diff instead of falling to the page.
 * `--view-w` is the visible width (without the vertical scrollbar), so hunk headers can span exactly what you see
 * while long lines scroll sideways beneath them.
 */
export function useDiffPane() {
  const ref = useRef<HTMLDivElement | null>(null)
  const hadFocus = useRef(false)
  const [paneWidth, setPaneWidth] = useState(0)
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
  return { ref, hadFocus, paneWidth, setPane, setSideColumn }
}

interface PaneElementOptions {
  setPane: (el: HTMLDivElement | null) => void
  hadFocus: RefObject<boolean>
  pane: ReturnType<typeof usePane>
  onKeyDown: (e: KeyboardEvent) => void
  /** Called on focus, so copy commands act on this diff. */
  onFocus: () => void
  /** The right-click menu; null when there are no lines to act on. */
  showMenu: (() => void) | null
}

/** Props for the focusable diff element, the same whether it shows code, a message or a preview. */
export function diffPaneElementProps({ setPane, hadFocus, pane, onKeyDown, onFocus, showMenu }: PaneElementOptions) {
  return {
    ref: setPane,
    tabIndex: 0,
    ...pane.targetProps,
    ...pane.resetProps,
    onKeyDown,
    onKeyDownCapture: (e: KeyboardEvent) => pane.navigate(e),
    onFocus: () => {
      hadFocus.current = true
      onFocus()
    },
    onContextMenu: (e: MouseEvent) => {
      if (!showMenu) return
      e.preventDefault()
      showMenu()
    },
    onBlur: (e: FocusEvent<HTMLDivElement>) => {
      // Removal can blur too; only a real move elsewhere (element still in the page) counts.
      const el = e.currentTarget
      setTimeout(() => el.isConnected && (hadFocus.current = false))
    }
  }
}
