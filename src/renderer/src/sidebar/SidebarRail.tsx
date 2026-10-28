import { useEffect, useMemo, useRef } from 'react'
import { Toolbar } from 'react-aria-components'
import { createVimMotions, toolbarHomeEnd, vimArrow } from '../lib/navigation'
import { useSettings } from '../settings'
import type { View } from '../components/RepoView'
import { VIEW_KEYS } from '../lib/viewShortcuts'
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
  const { vimNavigation } = useSettings()
  const motions = useMemo(createVimMotions, [])
  useEffect(() => toolbarHomeEnd(ref.current), [])
  // The listener below outlives renders, so it reads the latest props through a ref.
  const latest = useRef({ vimNavigation, onEnterMain })
  latest.current = { vimNavigation, onEnterMain }
  useEffect(() => {
    const rail = ref.current
    if (!rail) return
    const redispatch = (e: KeyboardEvent, key: string) => {
      e.preventDefault()
      e.stopPropagation()
      e.target?.dispatchEvent(new KeyboardEvent('keydown', { key, code: key, bubbles: true, cancelable: true, repeat: e.repeat }))
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return
      const { vimNavigation, onEnterMain } = latest.current
      // Vim keys become the key they stand for (j/k/h/l are arrows, gg and G are Home and End), so the
      // toolbar and the handling below see one key.
      const vimKey = vimNavigation ? (motions.read(e, e.target as Element) ?? vimArrow(e)) : undefined
      if (vimKey === 'prefix') {
        e.preventDefault()
        e.stopPropagation()
        return
      }
      if (vimKey) return redispatch(e, vimKey)
      if (e.key !== 'ArrowRight' || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return
      e.preventDefault()
      onEnterMain()
    }
    rail.addEventListener('keydown', onKey)
    rail.addEventListener('focusout', motions.reset)
    return () => {
      rail.removeEventListener('keydown', onKey)
      rail.removeEventListener('focusout', motions.reset)
    }
  }, [motions])
  return (
    // One Tab stop and a pane for F6, like the top toolbar; arrows move between the buttons.
    <Toolbar ref={ref} className="sidebar-rail" aria-label="Views" orientation="vertical" data-pane="rail">
      <PaneToggle pane="sidebar" collapsed keys="Ctrl+[" onToggle={onExpand} />
      {items.map((item) => (
        <Tip key={item.view} label={item.label} keys={VIEW_KEYS[item.view]}>
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
