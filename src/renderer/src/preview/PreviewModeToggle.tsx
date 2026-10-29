import { useRef } from 'react'
import { Button } from 'react-aria-components'
import { Tip } from '../components/Tip'
import type { PreviewMode } from '../../../shared/previewRegistry'
import { useRegisterPreviewSwitch } from './activePreview'

export const TOGGLE_PREVIEW_KEYS = 'Ctrl+Shift+V'

interface Props {
  /** Name of the preview side, e.g. "Preview". */
  previewLabel: string
  mode: PreviewMode
  onChange: (mode: PreviewMode) => void
}

/** Diff | Preview switch for a file that has a previewer. */
export function PreviewModeToggle({ previewLabel, mode, onChange }: Props) {
  const options: { mode: PreviewMode; label: string; tip: string }[] = [
    { mode: 'diff', label: 'Diff', tip: 'Show the changes as text' },
    { mode: 'preview', label: previewLabel, tip: 'Show the file as it looks' }
  ]
  const group = useRef<HTMLDivElement>(null)
  useRegisterPreviewSwitch(group, () => onChange(mode === 'preview' ? 'diff' : 'preview'))
  return (
    <div className="segmented" role="group" aria-label="View" ref={group}>
      {options.map((o) => (
        <Tip key={o.mode} label={mode === o.mode ? undefined : o.tip} keys={TOGGLE_PREVIEW_KEYS}>
          <Button className="segment" aria-pressed={mode === o.mode} onPress={() => onChange(o.mode)}>
            {o.label}
          </Button>
        </Tip>
      ))}
    </div>
  )
}
