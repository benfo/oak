import type { ComponentType } from 'react'
import type { FileVersion } from '../../../shared/filePreview'
import type { Previewer } from '../../../shared/previewRegistry'

/** What every previewer's view receives: both sides of the file and a way back to the diff. */
export interface PreviewViewProps {
  path: string
  before: FileVersion
  after: FileVersion
  onShowDiff: () => void
}

export type ReactPreviewer = Previewer<ComponentType<PreviewViewProps>>
