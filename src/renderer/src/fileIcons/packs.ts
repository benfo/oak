import { MATERIAL_PACK } from './materialPack'
import type { FileIconPack } from './pack'

/** 'none' keeps the plain look: no file icons, and the generic folder glyph. */
export type FileIconPackId = 'none' | 'material'

export const FILE_ICON_PACKS: { id: FileIconPackId; name: string; pack?: FileIconPack }[] = [
  { id: 'none', name: 'None' },
  { id: 'material', name: 'Material', pack: MATERIAL_PACK }
]

export const fileIconPack = (id: FileIconPackId) => FILE_ICON_PACKS.find((p) => p.id === id)?.pack
