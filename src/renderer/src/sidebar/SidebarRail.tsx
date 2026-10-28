import type { View } from '../components/RepoView'
import { Icon, type IconName } from '../components/Icon'
import { PaneToggle } from '../components/PaneToggle'
import { Tip } from '../components/Tip'

interface Props {
  view: View
  setView: (view: View) => void
  changeCount: number
  /** The file in the open Blame view, or null while none is open. */
  blameFile: string | null
  onExpand: () => void
}

/** The collapsed sidebar: its views as icons, with the toggle that brings the full sidebar back. */
export function SidebarRail({ view, setView, changeCount, blameFile, onExpand }: Props) {
  const items: { view: View; label: string; icon: IconName; count?: number }[] = [
    { view: 'changes', label: 'Changes', icon: 'changes', count: changeCount },
    { view: 'history', label: 'History', icon: 'history' },
    ...(blameFile ? [{ view: 'blame' as const, label: `Blame: ${blameFile}`, icon: 'blame' as const }] : [])
  ]
  return (
    <nav className="sidebar-rail" aria-label="Views">
      <PaneToggle pane="sidebar" collapsed keys="Ctrl+[" onToggle={onExpand} />
      {items.map((item) => (
        <Tip key={item.view} label={item.label}>
          <button
            className="icon-btn rail-btn"
            aria-label={item.label}
            aria-current={view === item.view || undefined}
            onClick={() => setView(item.view)}
          >
            <Icon name={item.icon} />
            {!!item.count && <span className="pill rail-count">{item.count}</span>}
          </button>
        </Tip>
      ))}
    </nav>
  )
}
