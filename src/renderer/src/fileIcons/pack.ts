/**
 * File-type icon packs. A pack is plain data: it names an icon id for a file name, extension or
 * folder, and says which icons have a variant for light themes. Turning an id into an image is
 * left to the caller (see FileIcon), so matching stays pure and testable.
 */
export interface FileIconPack {
  /** Icon for a file nothing else matches. */
  file: string
  folder: string
  folderOpen: string
  /** Whole file names, lowercase: `package.json`, `dockerfile`. Checked first. */
  filenames: Record<string, string>
  /** File name prefixes, lowercase, for families of names: `.env.` covers `.env.production`. Checked after exact names. */
  prefixes?: Record<string, string>
  /** Extensions without the dot, lowercase; compound ones like `test.ts` and `d.ts` win over `ts`. */
  extensions: Record<string, string>
  /** Icon id -> id of its variant for light themes, for icons that read poorly on a light background. */
  light?: Record<string, string>
}

export type FileIconKind = 'file' | 'folder'

const baseName = (path: string) => path.slice(path.lastIndexOf('/') + 1).toLowerCase()

/** The icon id for a path: exact name, then the longest matching extension, then the pack's fallback. */
export function resolveFileIcon(pack: FileIconPack, path: string, kind: FileIconKind, open = false): string {
  if (kind === 'folder') return open ? pack.folderOpen : pack.folder
  const name = baseName(path)
  const byName = pack.filenames[name]
  if (byName) return byName
  for (const [prefix, id] of Object.entries(pack.prefixes ?? {})) if (name.startsWith(prefix)) return id
  for (let dot = name.indexOf('.'); dot !== -1; dot = name.indexOf('.', dot + 1)) {
    const byExtension = pack.extensions[name.slice(dot + 1)]
    if (byExtension) return byExtension
  }
  return pack.file
}

/** The light-theme variant of an icon, or the icon itself when it has none. */
export const lightVariant = (pack: FileIconPack, id: string) => pack.light?.[id] ?? id
