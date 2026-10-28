import { Icon } from './Icon'
import { Tip } from './Tip'

export type WorkspaceLayout = 'standard' | 'code'

export interface LayoutControls {
  layout: WorkspaceLayout
  onToggleFocus: () => void
}

/** The focus toggle; pane sizes are dragged or resized with Shift+Alt+arrows. */
export function LayoutMenu({ layout, onToggleFocus }: LayoutControls) {
  const focusLabel = layout === 'standard' ? 'Expand focused area' : 'Restore previous layout'
  return (
    <Tip label={focusLabel} keys="F11">
      <button className="tb-btn" aria-label={focusLabel} data-active={layout !== 'standard' || undefined} onClick={onToggleFocus}>
        <Icon name={layout === 'standard' ? 'expand' : 'restore'} />
      </button>
    </Tip>
  )
}
