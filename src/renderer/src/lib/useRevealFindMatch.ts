import { useEffect, useRef, type RefObject } from 'react'
import { findScrollDelta } from '../../../shared/findScroll'

/** Reveal the current occurrence without moving focus, vertical position or another code column. */
export function useRevealFindMatch(ref: RefObject<HTMLElement | null>, key: string | null) {
  const revealed = useRef<{ key: string; node: Element; width: number } | null>(null)
  // Run after each render: virtual rows, syntax spans and layout switches can replace a match's DOM
  // without changing its index. The identity guard leaves manual scrolling alone between searches.
  useEffect(() => {
    if (key === null) {
      revealed.current = null
      return
    }
    const root = ref.current
    if (!root) return
    let frame = 0
    const reveal = () => {
      const marks = [...root.querySelectorAll<HTMLElement>('.find-hit.current')]
      if (!marks.length) return
      let scroller: HTMLElement | null = marks[0].parentElement
      while (scroller && root.contains(scroller)) {
        if (/^(auto|scroll)$/.test(getComputedStyle(scroller).overflowX)) break
        scroller = scroller.parentElement
      }
      if (!scroller || !root.contains(scroller)) return
      observer.disconnect()
      const last = revealed.current
      if (last?.key === key && last.node === marks[0] && last.width === scroller.clientWidth) return
      const bounds = scroller.getBoundingClientRect()
      const gutter = marks[0].closest('.dl')?.querySelector('.gutter')?.getBoundingClientRect()
      const left = Math.max(bounds.left + scroller.clientLeft, gutter?.right ?? bounds.left)
      const right = bounds.left + scroller.clientLeft + scroller.clientWidth
      // Syntax and word-change boundaries may split a single occurrence across several spans.
      const boxes = marks.map((mark) => mark.getBoundingClientRect())
      const start = Math.min(...boxes.map((box) => box.left))
      const end = Math.max(...boxes.map((box) => box.right))
      scroller.scrollLeft += findScrollDelta(left, right, start, end)
      revealed.current = { key, node: marks[0], width: scroller.clientWidth }
    }
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(reveal)
    }
    // A distant row may not be mounted until the vertical virtualizer's next render.
    const observer = new MutationObserver(schedule)
    observer.observe(root, { childList: true, subtree: true })
    schedule()
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  })
}
