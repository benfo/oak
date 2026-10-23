import { updateSettings } from '../settings'
import type { DiffLayout } from './diffLayout'

/** Keep the same visible code at the same height when the two layouts use different row counts. */
export function changeDiffLayout(layout: DiffLayout) {
  const snapshots = [...document.querySelectorAll<HTMLElement>('[data-pane="diff"]')]
    .filter((pane) => pane.offsetParent !== null)
    .map((pane) => {
      const side = pane.querySelector<HTMLElement>('.dl.cursor')?.dataset.side ?? 'new'
      const scroller = pane.querySelector<HTMLElement>(`.side-column[data-side="${side}"]`) ?? pane
      const top = scroller.getBoundingClientRect().top
      const row = [...scroller.querySelectorAll<HTMLElement>('.dl[data-idx]')].find((row) => row.getBoundingClientRect().bottom > top)
      return { pane, side, index: row?.dataset.idx, offset: row ? row.getBoundingClientRect().top - top : 0, left: scroller.scrollLeft }
    })
  updateSettings({ diffLayout: layout })
  // External-store subscribers commit the new layout before this frame's paint.
  requestAnimationFrame(() => {
    for (const { pane, side, index, offset, left } of snapshots) {
      if (!pane.isConnected || index === undefined) continue
      const row = pane.querySelector<HTMLElement>(`.dl[data-idx="${index}"][data-side="${side}"]`)
        ?? pane.querySelector<HTMLElement>(`.dl[data-idx="${index}"]`)
      if (!row) continue
      const scroller = row.closest<HTMLElement>('.side-column') ?? pane
      const top = scroller.scrollTop + row.getBoundingClientRect().top - scroller.getBoundingClientRect().top - offset
      scroller.scrollTop = top
      scroller.scrollLeft = left
      // Both sides share vertical position; horizontal scrolling remains independent.
      for (const other of pane.querySelectorAll<HTMLElement>('.side-column')) other.scrollTop = scroller.scrollTop
    }
  })
}
