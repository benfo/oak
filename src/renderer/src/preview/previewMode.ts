import { useSyncExternalStore } from 'react'
import { createStore } from '../ui'
import type { PreviewMode } from '../../../shared/previewRegistry'

/** The mode the user last chose per previewer, kept until Oak restarts; a previewer's own default applies until then. */
const store = createStore<Record<string, PreviewMode>>({})

export const setPreviewMode = (previewerId: string, mode: PreviewMode) => store.set({ ...store.get(), [previewerId]: mode })

export function usePreviewMode(previewer: { id: string; defaultMode: PreviewMode } | null): PreviewMode {
  const chosen = useSyncExternalStore(store.subscribe, store.get)
  return previewer ? (chosen[previewer.id] ?? previewer.defaultMode) : 'diff'
}
