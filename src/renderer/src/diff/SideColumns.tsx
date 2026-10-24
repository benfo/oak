import type { ReactNode } from 'react'
import type { DiffSide } from './diffTypes'

interface Props {
  setColumn: (el: HTMLDivElement | null) => void
  focusPane: () => void
  renderColumn: (side: DiffSide) => ReactNode
}

/** Before and After columns that scroll together. */
export function SideColumns({ setColumn, focusPane, renderColumn }: Props) {
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
            const other = e.currentTarget.parentElement?.querySelector<HTMLElement>(
              `.side-column[data-side="${side === 'old' ? 'new' : 'old'}"]`
            )
            if (other && other.scrollTop !== e.currentTarget.scrollTop) other.scrollTop = e.currentTarget.scrollTop
          }}
        >
          {renderColumn(side)}
        </div>
      ))}
    </div>
  )
}
