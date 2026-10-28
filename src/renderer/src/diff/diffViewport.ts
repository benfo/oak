/** Preserve visible source text and its pixel offset while a review setting rebuilds rows. */
export function preserveDiffViewport(change: () => void) {
  const snapshots = [...document.querySelectorAll<HTMLElement>('[data-pane="diff"]')]
    .filter((pane) => pane.offsetParent !== null)
    .map((pane) => {
      const side = pane.querySelector<HTMLElement>('.dl.cursor')?.dataset.side ?? 'new'
      const scroller = pane.querySelector<HTMLElement>(`.side-column[data-side="${side}"]`) ?? pane
      const top = scroller.getBoundingClientRect().top
      const row = [...scroller.querySelectorAll<HTMLElement>('.dl[data-idx]')].find((row) => row.getBoundingClientRect().bottom > top)
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
  change()
  requestAnimationFrame(() => {
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
    }
  })
}
