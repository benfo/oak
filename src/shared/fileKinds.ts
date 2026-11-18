/** A path's extension, lowercased (after the last dot of the file name), or null when it has none. */
function extensionOf(path: string): string | null {
  const name = path.split('/').pop() ?? path
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : null
}

/** Whether a path's extension (case-insensitive) is one of `extensions`. */
export function hasExtension(path: string, extensions: ReadonlySet<string>): boolean {
  const ext = extensionOf(path)
  return ext !== null && extensions.has(ext)
}

/** Extensions of files a code editor can't usefully edit: images, documents, media, archives, binaries. */
const NOT_EDITABLE = new Set([
  ...['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'icns', 'tif', 'tiff', 'heic', 'avif', 'psd'],
  ...['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'key', 'pages', 'numbers'],
  ...['mp3', 'wav', 'flac', 'ogg', 'm4a', 'mp4', 'mov', 'avi', 'mkv', 'webm'],
  ...['zip', 'gz', 'tgz', 'tar', '7z', 'rar', 'bz2', 'xz'],
  ...['exe', 'dll', 'so', 'dylib', 'bin', 'msi', 'dmg', 'pkg', 'iso', 'class', 'jar', 'wasm'],
  ...['ttf', 'otf', 'woff', 'woff2', 'eot', 'sketch', 'fig']
])

/** Whether the system's default app is a better way to open this file than a code editor (decided by extension alone). */
export function opensBetterInDefaultApp(path: string): boolean {
  return hasExtension(path, NOT_EDITABLE)
}

/** Image formats Chromium draws in an `<img>` by itself, by extension. */
const IMAGE_TYPES: Record<string, string> = {
  svg: 'image/svg+xml',
  png: 'image/png',
  apng: 'image/apng',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jfif: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  cur: 'image/x-icon'
}

/** Raster image extensions the app can draw without a decoder of its own (SVG is listed separately). */
export const RASTER_IMAGE_EXTENSIONS: ReadonlySet<string> = new Set(Object.keys(IMAGE_TYPES).filter((ext) => ext !== 'svg'))

/** The media type to draw a file as an image, or null when Chromium can't draw it. */
export function imageMimeType(path: string): string | null {
  const ext = extensionOf(path)
  return (ext !== null && IMAGE_TYPES[ext]) || null
}
