import { createPreviewRegistry, hasExtension } from '../../../shared/previewRegistry'
import { SvgPreview } from './SvgPreview'
import type { ReactPreviewer } from './types'

const SVG_EXTENSIONS = new Set(['svg'])

const svgPreviewer: ReactPreviewer = {
  id: 'svg',
  label: 'Preview',
  matches: (path) => hasExtension(path, SVG_EXTENSIONS),
  defaultMode: 'preview',
  view: SvgPreview
}

/** Every format that can be previewed. Add a previewer here; the diff pane only asks this registry. */
export const previewRegistry = createPreviewRegistry([svgPreviewer])
