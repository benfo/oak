import { materialIconUrl } from './materialAssets'
import { MATERIAL_PACK } from './materialPack'
import type { FileIconPack } from './pack'

/** 'none' keeps the plain look: no file icons, and the generic folder glyph. */
export type FileIconPackId = 'none' | 'material'

/** A pack's matching rules plus how to turn one of its icon ids into an image. */
export interface FileIconSource {
  pack: FileIconPack
  iconUrl: (id: string) => string | undefined
}

export const FILE_ICON_PACKS: { id: FileIconPackId; name: string; source?: FileIconSource }[] = [
  { id: 'none', name: 'None' },
  { id: 'material', name: 'Colour', source: { pack: MATERIAL_PACK, iconUrl: materialIconUrl } }
]

export const fileIconSource = (id: FileIconPackId) => FILE_ICON_PACKS.find((p) => p.id === id)?.source
