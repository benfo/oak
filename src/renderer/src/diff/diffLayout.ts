export type DiffLayout = 'auto' | 'unified' | 'split'

/** Use the diff pane's width, independent of the window size and surrounding splitters. */
export const AUTO_SPLIT_WIDTH = 900

export function resolveDiffLayout(layout: DiffLayout, width: number): 'unified' | 'split' {
  return layout === 'auto' ? (width >= AUTO_SPLIT_WIDTH ? 'split' : 'unified') : layout
}

/** Toggle what is visible, exiting Automatic to a fixed layout. */
export function toggleDiffLayout(layout: DiffLayout, width: number): 'unified' | 'split' {
  return resolveDiffLayout(layout, width) === 'split' ? 'unified' : 'split'
}

export const DIFF_LAYOUTS: { id: DiffLayout; label: string }[] = [
  { id: 'auto', label: 'Automatic' },
  { id: 'unified', label: 'Inline' },
  { id: 'split', label: 'Side by side' }
]
