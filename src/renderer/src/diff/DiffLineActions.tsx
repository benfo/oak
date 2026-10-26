import { Tip } from '../components/Tip'
import { Icon } from '../components/Icon'
import type { DiffActions } from './diffTypes'
import type { useDiffSelection } from './useDiffSelection'

interface Props {
  acts: DiffActions
  selection: ReturnType<typeof useDiffSelection>
  focusPane: () => void
}

/** Floats in reserved space, so selecting lines never moves the diff. */
export function DiffLineActions({ acts, selection, focusPane }: Props) {
  const n = selection.selected.size
  const fromBar = (run: () => void) => {
    focusPane()
    run()
  }
  return (
    <div className={`line-actions ${n > 0 ? 'visible' : ''}`} role="status" inert={n === 0}>
      <span>
        {n} {n === 1 ? 'line' : 'lines'} selected
      </span>
      {acts.discard && (
        <Tip label="Discard selected lines" keys="Delete" placement="top">
          <button className="btn" onClick={() => fromBar(() => selection.runOn('discard'))}>
            {acts.discard.label}
          </button>
        </Tip>
      )}
      <Tip label={`${acts.primary.label} selected lines`} keys="Enter" placement="top">
        <button className="btn primary" onClick={() => fromBar(() => selection.runOn('primary'))}>
          {acts.primary.label} lines
        </button>
      </Tip>
      <Tip label="Clear selection" keys="Esc" placement="top">
        <button className="icon-btn" aria-label="Clear selection" onClick={() => fromBar(selection.clear)}>
          <Icon name="x" size={14} />
        </button>
      </Tip>
    </div>
  )
}
