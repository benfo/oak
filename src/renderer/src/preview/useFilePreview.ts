import type { PreviewTarget } from '../../../shared/filePreview'
import { previewRegistry } from './previewers'
import { setPreviewMode, usePreviewMode } from './previewMode'
import { useFileVersions } from './useFileVersions'

/** Everything the diff pane needs to offer, and show, a preview of the file it is on. `reloadKey` reloads the same file after a change. */
export function useFilePreview(target: PreviewTarget | undefined, reloadKey: unknown) {
  const previewer = target ? previewRegistry.previewerFor(target.source.file) : null
  const mode = usePreviewMode(previewer)
  const previewing = !!previewer && mode === 'preview'
  const { versions, error } = useFileVersions(target?.repo ?? '', target?.source, previewing, reloadKey)
  return {
    previewer,
    mode,
    previewing,
    versions,
    error,
    setMode: (next: typeof mode) => previewer && setPreviewMode(previewer.id, next)
  }
}
