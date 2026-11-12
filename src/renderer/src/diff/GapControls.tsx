import { Icon } from '../components/Icon'
import { Tip } from '../components/Tip'
import { EXPAND_STEP, type Gap } from '../../../shared/diffExpand'

export type GapEdge = 'up' | 'down' | 'all'

/** Buttons that reveal the unchanged lines hidden at one gap: more above the next hunk, more below the previous one, or all of them. */
export function GapControls({ gap, hunkCount, onExpand }: { gap: Gap; hunkCount: number; onExpand: (key: number, edge: GapEdge) => void }) {
  const { hidden } = gap
  const known = hidden !== null
  const step = known ? Math.min(EXPAND_STEP, hidden) : EXPAND_STEP
  const closing = known && hidden <= EXPAND_STEP
  const canUp = gap.before < hunkCount
  const canDown = gap.before > 0
  const button = (edge: GapEdge, label: string, content: React.ReactNode) => (
    <Tip label={label} placement="top">
      <button className="btn" tabIndex={-1} aria-label={label} onClick={() => onExpand(gap.key, edge)}>
        {content}
      </button>
    </Tip>
  )
  return (
    <span className="gap-controls">
      {closing ? (
        button(
          canUp ? 'up' : 'down',
          `Show the ${gap.hidden} hidden ${gap.hidden === 1 ? 'line' : 'lines'}`,
          <Icon name="plus" size={14} />
        )
      ) : (
        <>
          {canUp && button('up', `Show ${step} more lines above`, <Icon name="arrowUp" size={14} />)}
          {canDown && button('down', `Show ${step} more lines below`, <Icon name="arrowDown" size={14} />)}
          {known && canUp && canDown && button('all', `Show all ${gap.hidden} hidden lines`, <Icon name="plus" size={14} />)}
        </>
      )}
      <span className="gap-count">{known ? `${gap.hidden} hidden` : 'more'}</span>
    </span>
  )
}
