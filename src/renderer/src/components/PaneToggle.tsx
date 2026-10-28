import { Icon } from './Icon'
import { Tip } from './Tip'

interface Props {
  /** The pane this controls, e.g. "sidebar" or "file list"; the label reads "Hide ..." or "Show ...". */
  pane: string
  /** True while the pane is hidden, so pressing shows it. */
  collapsed: boolean
  /** Shortcut shown in the tooltip. */
  keys: string
  onToggle: () => void
}

/** Shows or hides a side pane. In the sidebar it travels between the pane's header and the rail. */
export function PaneToggle({ pane, collapsed, keys, onToggle }: Props) {
  const label = `${collapsed ? 'Show' : 'Hide'} ${pane}`
  return (
    <Tip label={label} keys={keys}>
      <button className="icon-btn pane-toggle" aria-label={label} aria-expanded={!collapsed} onClick={onToggle}>
        <Icon name={collapsed ? 'panelOpen' : 'panelClose'} size={14} />
      </button>
    </Tip>
  )
}
