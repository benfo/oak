import { resolveFileIcon, type FileIconKind } from '../fileIcons/pack'
import { fileIconSource } from '../fileIcons/packs'
import { useSettings } from '../settings'
import { Icon } from './Icon'

/**
 * The icon for a file or folder in the chosen pack (Preferences > Appearance). With no pack, files
 * get nothing and folders keep the plain folder glyph.
 */
export function FileIcon({ path, kind, open = false, size = 14 }: { path: string; kind: FileIconKind; open?: boolean; size?: number }) {
  const source = fileIconSource(useSettings().fileIcons)
  if (!source) return kind === 'folder' ? <Icon name="folder" size={size} /> : null
  return source.render(resolveFileIcon(source.pack, path, kind, open), size)
}
