import { hasExtension, RASTER_IMAGE_EXTENSIONS } from '../../../shared/fileKinds'
import { createPreviewRegistry } from '../../../shared/previewRegistry'
import { ImagePreview } from './ImagePreview'
import type { ReactPreviewer } from './types'

const SVG_EXTENSIONS = new Set(['svg'])

const svgPreviewer: ReactPreviewer = {
  id: 'svg',
  label: 'Preview',
  matches: (path) => hasExtension(path, SVG_EXTENSIONS),
  defaultMode: 'preview',
  view: ImagePreview
}

/** PNG, JPEG, GIF and the rest: binary, so their diff says nothing and the preview is the only useful view. */
const imagePreviewer: ReactPreviewer = {
  id: 'image',
  label: 'Preview',
  matches: (path) => hasExtension(path, RASTER_IMAGE_EXTENSIONS),
  defaultMode: 'preview',
  view: ImagePreview
}

/** Every format that can be previewed. Add a previewer here; the diff pane only asks this registry. */
export const previewRegistry = createPreviewRegistry([svgPreviewer, imagePreviewer])
