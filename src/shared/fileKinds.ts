/** Whether a path's extension (case-insensitive, after the last dot of the file name) is one of `extensions`. */
export function hasExtension(path: string, extensions: ReadonlySet<string>): boolean {
  const name = path.split('/').pop() ?? path
  const dot = name.lastIndexOf('.')
  return dot > 0 && extensions.has(name.slice(dot + 1).toLowerCase())
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
