import { lightVariant, resolveFileIcon, type FileIconKind } from '../fileIcons/pack'
import { fileIconSource } from '../fileIcons/packs'
import { useSettings } from '../settings'
import { Icon } from './Icon'

/**
 * The icon for a file or folder in the chosen pack (Preferences > Appearance). With no pack, files
 * get nothing and folders keep the plain folder glyph. Icons that read poorly on a light background
 * render both variants and CSS shows the one for the theme, so a theme change needs no re-render.
 */
export function FileIcon({ path, kind, open = false, size = 14 }: { path: string; kind: FileIconKind; open?: boolean; size?: number }) {
  const source = fileIconSource(useSettings().fileIcons)
  if (!source) return kind === 'folder' ? <Icon name="folder" size={size} /> : null
  const { pack, iconUrl } = source
  const id = resolveFileIcon(pack, path, kind, open)
  const light = lightVariant(pack, id)
  const image = (iconId: string, variant?: string) => {
    const src = iconUrl(iconId)
    return src ? (
      <img className={`file-icon ${variant ?? ''}`} src={src} width={size} height={size} alt="" aria-hidden draggable={false} />
    ) : null
  }
  if (light === id) return image(id)
  return (
    <>
      {image(id, 'for-dark')}
      {image(light, 'for-light')}
    </>
  )
}
