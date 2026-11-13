import type { ReactNode } from 'react'
import { Icon } from '../components/Icon'
import { Tip } from '../components/Tip'
import { EXPAND_STEP, type Gap } from '../../../shared/diffExpand'

export type GapEdge = 'up' | 'down' | 'all'

/**
 * Buttons that reveal the unchanged lines hidden at one gap, named like GitHub Desktop by the way a hunk grows:
 * down extends the hunk above the gap, up extends the hunk below it, and plus reveals all of it.
 */
export function GapControls({ gap, hunkCount, onExpand }: { gap: Gap; hunkCount: number; onExpand: (key: number, edge: GapEdge) => void }) {
  const { hidden } = gap
  const known = hidden !== null
  const step = known ? Math.min(EXPAND_STEP, hidden) : EXPAND_STEP
  const closing = known && hidden <= EXPAND_STEP
  const canUp = gap.before < hunkCount
  const canDown = gap.before > 0
  const button = (edge: GapEdge, label: string, content: ReactNode) => (
    <Tip label={label} placement="top">
      <button className="btn" tabIndex={-1} aria-label={label} onClick={() => onExpand(gap.key, edge)}>
        {content}
      </button>
    </Tip>
  )
  return (
    <span className="gap-controls">
      {closing ? (
        button(canUp ? 'up' : 'down', `Expand ${hidden} hidden ${hidden === 1 ? 'line' : 'lines'}`, <Icon name="plus" size={14} />)
      ) : (
        <>
          {canDown && button('down', `Expand down ${step} lines`, <Icon name="arrowDown" size={14} />)}
          {canUp && button('up', `Expand up ${step} lines`, <Icon name="arrowUp" size={14} />)}
          {known && canUp && canDown && button('all', `Expand all ${hidden} hidden lines`, <Icon name="plus" size={14} />)}
        </>
      )}
      <span className="gap-count">{known ? `${hidden} hidden` : 'more'}</span>
    </span>
  )
}
