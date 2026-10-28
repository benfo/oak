import { useEffect, useRef } from 'react'
import { Toolbar } from 'react-aria-components'
import { toolbarHomeEnd } from '../lib/navigation'
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
  /** Right arrow: move into the main area. */
  onEnterMain: () => void
}

/** The collapsed sidebar: its views as icons, with the toggle that brings the full sidebar back. */
export function SidebarRail({ view, setView, changeCount, blameFile, onExpand, onEnterMain }: Props) {
  const items: { view: View; label: string; icon: IconName; count?: number }[] = [
    { view: 'changes', label: 'Changes', icon: 'changes', count: changeCount },
    { view: 'history', label: 'History', icon: 'history' },
    ...(blameFile ? [{ view: 'blame' as const, label: `Blame: ${blameFile}`, icon: 'blame' as const }] : [])
  ]
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => toolbarHomeEnd(ref.current), [])
  useEffect(() => {
    const rail = ref.current
    if (!rail) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowRight' || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || e.defaultPrevented) return
      e.preventDefault()
      onEnterMain()
    }
    rail.addEventListener('keydown', onKey)
    return () => rail.removeEventListener('keydown', onKey)
  }, [onEnterMain])
  return (
    // One Tab stop and a pane for F6, like the top toolbar; arrows move between the buttons.
    <Toolbar ref={ref} className="sidebar-rail" aria-label="Views" orientation="vertical" data-pane="rail">
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
    </Toolbar>
  )
}
