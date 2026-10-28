import { Icon } from './Icon'
import { Tip } from './Tip'

interface Props {
  /** The pane this controls, e.g. "sidebar" or "file list"; the label reads "Hide ..." or "Show ...". */
  pane: string
  /** True while the pane is hidden, so pressing shows it. */
  collapsed: boolean
  onToggle: () => void
}

/**
 * Shows or hides the left-most pane. It sits in the pane's own header while the pane is open and in
 * the nearest always-visible bar once it is collapsed, so its place is always predictable (Ctrl+[).
 */
export function PaneToggle({ pane, collapsed, onToggle }: Props) {
  const label = `${collapsed ? 'Show' : 'Hide'} ${pane}`
  return (
    <Tip label={label} keys="Ctrl+[">
      <button className="icon-btn pane-toggle" aria-label={label} aria-expanded={!collapsed} onClick={onToggle}>
        <Icon name={collapsed ? 'panelOpen' : 'panelClose'} size={14} />
      </button>
    </Tip>
  )
}
