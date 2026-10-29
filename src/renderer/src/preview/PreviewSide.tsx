import { useState, type ReactNode } from 'react'
import type { FileVersion } from '../../../shared/filePreview'

const mb = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`

interface Props {
  label: string
  version: FileVersion
  onShowDiff: () => void
  /** Draws the file's bytes. Call `fail` when the format turns out not to be renderable. */
  render: (bytes: Uint8Array, fail: () => void) => ReactNode
}

/** One labelled side of a preview. A file that is too large or can't be drawn says so here, so the other side still shows. */
export function PreviewSide({ label, version, onShowDiff, render }: Props) {
  const [failedBytes, setFailedBytes] = useState<Uint8Array | null>(null)
  let body: ReactNode
  if (version.state === 'tooLarge') body = <PreviewNotice message={`Too large to preview (${mb(version.size)})`} onShowDiff={onShowDiff} />
  else if (version.state === 'ok' && failedBytes === version.bytes)
    body = <PreviewNotice message="Can't draw this file" onShowDiff={onShowDiff} />
  else if (version.state === 'ok') body = render(version.bytes, () => setFailedBytes(version.bytes))
  return (
    <section className="preview-side" aria-label={label}>
      <div className="preview-label">{label}</div>
      <div className="preview-canvas">{body}</div>
    </section>
  )
}

function PreviewNotice({ message, onShowDiff }: { message: string; onShowDiff: () => void }) {
  return (
    <div className="preview-notice">
      {message}.{' '}
      <button className="link" onClick={onShowDiff}>
        Show diff
      </button>
    </div>
  )
}
