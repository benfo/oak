/** Which view a previewable file opens in. */
export type PreviewMode = 'preview' | 'diff'

/**
 * Something that can show a file instead of its diff. `View` is whatever renders it (a React component in the app);
 * the registry never looks inside it, so formats can be added without touching the diff pane.
 */
export interface Previewer<View> {
  id: string
  /** Name on the Diff | Preview toggle. */
  label: string
  matches(path: string): boolean
  defaultMode: PreviewMode
  view: View
}

export interface PreviewRegistry<View> {
  /** The first previewer that handles `path`, or null when the file can only be shown as a diff. */
  previewerFor(path: string): Previewer<View> | null
}

export function createPreviewRegistry<View>(previewers: Previewer<View>[]): PreviewRegistry<View> {
  return { previewerFor: (path) => previewers.find((p) => p.matches(path)) ?? null }
}
