import type { ReactNode } from 'react'
import { PreviewSide } from './PreviewSide'
import type { PreviewViewProps } from './types'

interface Props extends Omit<PreviewViewProps, 'path'> {
  render: (bytes: Uint8Array, fail: () => void) => ReactNode
}

/** Before and after next to each other; an added or deleted file gets one side, labelled as such. Formats only supply `render`. */
export function SideBySidePreview({ before, after, onShowDiff, render }: Props) {
  const hasBefore = before.state !== 'missing'
  const hasAfter = after.state !== 'missing'
  if (!hasBefore && !hasAfter) return <div className="preview-notice">Nothing to preview.</div>
  const side = (label: string, version: Props['before']) => (
    <PreviewSide label={label} version={version} onShowDiff={onShowDiff} render={render} />
  )
  return (
    <div className="preview-sides">
      {hasBefore && side(hasAfter ? 'Before' : 'Deleted', before)}
      {hasAfter && side(hasBefore ? 'After' : 'Added', after)}
    </div>
  )
}
