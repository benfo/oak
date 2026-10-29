import type { ComponentType } from 'react'
import type { FileVersions } from '../../../shared/filePreview'
import type { PreviewViewProps } from './types'

interface Props {
  view: ComponentType<PreviewViewProps>
  path: string
  versions: FileVersions | null
  error: string | null
  onShowDiff: () => void
}

/** A previewer's view once both sides have loaded; a message while they load or if they could not. */
export function PreviewContent({ view: View, path, versions, error, onShowDiff }: Props) {
  if (error) return <div className="preview-notice">Could not load the file: {error}</div>
  if (!versions) return <div className="preview-notice">Loading…</div>
  return <View path={path} before={versions.before} after={versions.after} onShowDiff={onShowDiff} />
}
