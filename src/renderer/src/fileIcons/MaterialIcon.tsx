import { materialIconUrl } from './materialAssets'
import { MATERIAL_PACK } from './materialPack'
import { lightVariant } from './pack'

/**
 * A Material icon. One that reads poorly on a light background renders both variants and CSS shows
 * the one for the theme (see .file-icon in commit-details.css), so a theme change needs no re-render.
 */
export function MaterialIcon({ id, size }: { id: string; size: number }) {
  const light = lightVariant(MATERIAL_PACK, id)
  const image = (iconId: string, variant?: string) => {
    const src = materialIconUrl(iconId)
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
