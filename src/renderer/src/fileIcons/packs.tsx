import type { ReactNode } from 'react'
import { MaterialIcon } from './MaterialIcon'
import { MATERIAL_PACK } from './materialPack'
import type { FileIconPack } from './pack'

/** 'none' keeps the plain look: no file icons, and the generic folder glyph. */
export type FileIconPackId = 'none' | 'material'

/** A pack's matching rules plus how to draw one of its icon ids. */
export interface FileIconSource {
  pack: FileIconPack
  render: (id: string, size: number) => ReactNode
}

export const FILE_ICON_PACKS: { id: FileIconPackId; name: string; source?: FileIconSource }[] = [
  { id: 'none', name: 'None' },
  { id: 'material', name: 'Colour', source: { pack: MATERIAL_PACK, render: (id, size) => <MaterialIcon id={id} size={size} /> } }
]

export const fileIconSource = (id: FileIconPackId) => FILE_ICON_PACKS.find((p) => p.id === id)?.source
