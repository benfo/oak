import { useCallback, useRef, useState } from 'react'

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
