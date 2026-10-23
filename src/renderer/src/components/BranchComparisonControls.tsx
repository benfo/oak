import { useEffect, useRef } from 'react'
import { Toolbar } from 'react-aria-components'
import type { BranchComparison } from '../lib/commitPreview'
import { toolbarHomeEnd } from '../lib/navigation'
import { Icon } from './Icon'
import { Tip } from './Tip'

/** Contextual controls stay with the comparison results, including while a preview fails or loads. */
export function BranchComparisonControls({ comparison, source, onPickTarget, onEnd }: {
  comparison: BranchComparison
  source: string
  onPickTarget: (anchor: Element) => void
  onEnd: () => void
}) {
  const toolbar = useRef<HTMLDivElement>(null)
  useEffect(() => toolbarHomeEnd(toolbar.current), [])
  const target = `${comparison.targetName} ${comparison.targetHash?.slice(0, 8) ?? '(missing)'} → ${source}`
  return <Toolbar ref={toolbar} className="branch-comparison-controls" aria-label="Branch comparison" data-pane="comparison-tools">
    <button className="btn" onClick={onEnd}><Icon name="x" size={12} />Exit comparison</button>
    <Tip label={`Change target: ${target}`}>
      <button className="link comparison-target" aria-label={`Change comparison target: ${comparison.targetName}`}
        onClick={(e) => onPickTarget(e.currentTarget)}>{target}<Icon name="chevronDown" size={12} /></button>
    </Tip>
  </Toolbar>
}
