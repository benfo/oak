export const CHANGE_TREE_INDENT = 20

export interface ChangeRow<T> {
  /** A file's path, or a folder's path (the deepest folder of a compressed chain). */
  id: string
  folder: boolean
  depth: number
  /** Folders may be a chain such as "auth0/deploy". */
  name: string
  /** The enclosing folder row, null at the top level. */
  parent: string | null
  /** The file's entry; undefined for folders. */
  entry?: T
  /** Every file under a folder, collapsed or not; just the file itself for files. */
  files: T[]
}

interface Node<T> {
  id: string
  name: string
  folders: Map<string, Node<T>>
  files: T[]
}

const compare = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true })

/**
 * Rows to display for changed files as a tree: folders first, then files, each alphabetical.
 * Chains of folders holding a single folder are shown as one row. Rows under a collapsed folder are left out.
 */
export function buildChangeRows<T extends { path: string }>(entries: readonly T[], collapsed: ReadonlySet<string>): ChangeRow<T>[] {
  const root: Node<T> = { id: '', name: '', folders: new Map(), files: [] }
  for (const entry of entries) {
    const parts = entry.path.split('/')
    let node = root
    for (let i = 0; i < parts.length - 1; i++) {
      let next = node.folders.get(parts[i])
      if (!next) {
        next = { id: parts.slice(0, i + 1).join('/'), name: parts[i], folders: new Map(), files: [] }
        node.folders.set(parts[i], next)
      }
      node = next
    }
    node.files.push(entry)
  }

  const rows: ChangeRow<T>[] = []
  const filesUnder = (node: Node<T>): T[] => [
    ...[...node.folders.values()].sort((a, b) => compare(a.name, b.name)).flatMap(filesUnder),
    ...[...node.files].sort((a, b) => compare(a.path, b.path))
  ]
  const walk = (node: Node<T>, depth: number, parent: string | null) => {
    for (const child of [...node.folders.values()].sort((a, b) => compare(a.name, b.name))) {
      let folder = child
      let name = child.name
      while (folder.files.length === 0 && folder.folders.size === 1) {
        folder = [...folder.folders.values()][0]
        name += `/${folder.name}`
      }
      rows.push({ id: folder.id, folder: true, depth, name, parent, files: filesUnder(folder) })
      if (!collapsed.has(folder.id)) walk(folder, depth + 1, folder.id)
    }
    for (const entry of [...node.files].sort((a, b) => compare(a.path, b.path))) {
      rows.push({ id: entry.path, folder: false, depth, name: entry.path.slice(entry.path.lastIndexOf('/') + 1), parent, entry, files: [entry] })
    }
  }
  walk(root, 0, null)
  return rows
}

/** Every file in tree display order, whatever is collapsed. */
export const changeTreeOrder = <T extends { path: string }>(entries: readonly T[]): T[] =>
  buildChangeRows(entries, new Set()).flatMap((row) => row.entry ? [row.entry] : [])

/** Collapsed folders without the ones holding `path`, so that file is visible. Returns the same set when nothing changes. */
export function expandTo(collapsed: ReadonlySet<string>, path: string): ReadonlySet<string> {
  const hidden = [...collapsed].filter((id) => path.startsWith(`${id}/`))
  if (!hidden.length) return collapsed
  const next = new Set(collapsed)
  for (const id of hidden) next.delete(id)
  return next
}

export function toggled(collapsed: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(collapsed)
  if (!next.delete(id)) next.add(id)
  return next
}

/** Combined additions and deletions of a folder's files, or null when any is unknown (binary). */
export function folderStats(files: readonly { additions: number | null; deletions: number | null }[]) {
  let additions = 0
  let deletions = 0
  for (const f of files) {
    if (f.additions === null || f.deletions === null) continue
    additions += f.additions
    deletions += f.deletions
  }
  return { additions, deletions }
}
