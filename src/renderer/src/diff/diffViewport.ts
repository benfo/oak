/**
 * Remembers which source line sits where in each visible diff pane (the cursor line when it is on screen and
 * `preferCursor` is set, else the first visible line) and returns a function that scrolls it back there.
 */
export function captureDiffViewport(preferCursor = false): () => boolean {
  const snapshots = [...document.querySelectorAll<HTMLElement>('[data-pane="diff"]')]
    .filter((pane) => pane.offsetParent !== null)
    .map((pane) => {
      const side = pane.querySelector<HTMLElement>('.dl.cursor')?.dataset.side ?? 'new'
      const scroller = pane.querySelector<HTMLElement>(`.side-column[data-side="${side}"]`) ?? pane
      const top = scroller.getBoundingClientRect().top
      const bottom = scroller.getBoundingClientRect().bottom
      const cursor = preferCursor
        ? [...scroller.querySelectorAll<HTMLElement>('.dl.cursor[data-idx]')].find((r) => {
            const box = r.getBoundingClientRect()
            return box.bottom > top && box.top < bottom
          })
        : undefined
      const row = cursor ?? [...scroller.querySelectorAll<HTMLElement>('.dl[data-idx]')].find((r) => r.getBoundingClientRect().bottom > top)
      return {
        pane,
        side,
        index: row?.dataset.idx,
        oldLine: row?.dataset.oldLine,
        newLine: row?.dataset.newLine,
        offset: row ? row.getBoundingClientRect().top - top : 0,
        left: scroller.scrollLeft
      }
    })
  return () => {
    let restored = false
    for (const { pane, side, index, oldLine, newLine, offset, left } of snapshots) {
      if (!pane.isConnected || index === undefined) continue
      const candidates = [...pane.querySelectorAll<HTMLElement>('.dl[data-idx]')].filter(
        (row) => !row.dataset.side || row.dataset.side === side
      )
      const row = candidates.find((r) =>
        newLine ? r.dataset.newLine === newLine : oldLine ? r.dataset.oldLine === oldLine : r.dataset.idx === index
      )
      if (!row) continue
      const scroller = row.closest<HTMLElement>('.side-column') ?? pane
      scroller.scrollTop += row.getBoundingClientRect().top - scroller.getBoundingClientRect().top - offset
      scroller.scrollLeft = left
      for (const other of pane.querySelectorAll<HTMLElement>('.side-column')) other.scrollTop = scroller.scrollTop
      restored = true
    }
    return restored
  }
}

/** Preserve visible source text and its pixel offset while a review setting rebuilds rows. */
export function preserveDiffViewport(change: () => void) {
  const restore = captureDiffViewport()
  change()
  requestAnimationFrame(restore)
}
