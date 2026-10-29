import { useRef, type ReactNode } from 'react'
import type { DiffSide } from './diffTypes'
import { followedPosition, samePosition } from './followScroll'

interface Props {
  setColumn: (el: HTMLDivElement | null) => void
  focusPane: () => void
  renderColumn: (side: DiffSide) => ReactNode
}

/** Before and After columns that scroll together, in both directions; a side that is shorter or narrower stops at its own end. */
export function SideColumns({ setColumn, focusPane, renderColumn }: Props) {
  // The column we just moved to follow the other: its scroll event must not bounce back, or a clamped side would drag the long one.
  const followed = useRef<HTMLElement | null>(null)
  return (
    <div
      className="side-columns"
      onMouseDownCapture={(e) => {
        // Text selection stays within the column where the drag began, so a copy never interleaves both sides.
        const column = (e.target as HTMLElement).closest<HTMLElement>('.side-column')
        if (column) e.currentTarget.dataset.selectSide = column.dataset.side
      }}
    >
      {(['old', 'new'] as const).map((side) => (
        <div
          className="side-column"
          key={side}
          data-side={side}
          tabIndex={-1}
          ref={setColumn}
          aria-label={side === 'old' ? 'Before' : 'After'}
          onFocus={(e) => {
            // Deferred: moving focus while the browser is still starting a mouse selection cancels the selection.
            const column = e.currentTarget
            if (e.target === column)
              setTimeout(() => {
                if (document.activeElement === column) focusPane()
              })
          }}
          onScroll={(e) => {
            const column = e.currentTarget
            if (followed.current === column) {
              followed.current = null
              return
            }
            const other = column.parentElement?.querySelector<HTMLElement>(`.side-column[data-side="${side === 'old' ? 'new' : 'old'}"]`)
            if (!other) return
            const { left, top } = followedPosition(column, other)
            if (samePosition(other.scrollLeft, left) && samePosition(other.scrollTop, top)) return
            followed.current = other
            other.scrollLeft = left
            other.scrollTop = top
            // The scroll event arrives a frame later. If nothing moved after all, none comes, so clear the mark after that.
            requestAnimationFrame(() =>
              requestAnimationFrame(() => {
                if (followed.current === other) followed.current = null
              })
            )
          }}
        >
          {renderColumn(side)}
        </div>
      ))}
    </div>
  )
}
