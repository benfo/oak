import { prepareFuzzy, rankFuzzy, type FuzzyTarget } from './fuzzy.ts'

export interface TreeEntry {
  /** Full path; folders have no trailing slash. */
  path: string
  name: string
  folder: boolean
  children: TreeEntry[]
}

/** Folders first, then files, each alphabetical. */
function sortEntries(entries: TreeEntry[]) {
  entries.sort(
    (a, b) => Number(b.folder) - Number(a.folder) || a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true })
  )
  for (const e of entries) if (e.folder) sortEntries(e.children)
}

export function buildFileTree(paths: readonly string[]): TreeEntry[] {
  const roots: TreeEntry[] = []
  const folders = new Map<string, TreeEntry>()
  for (const path of paths) {
    const parts = path.split('/')
    let siblings = roots
    for (let i = 0; i < parts.length - 1; i++) {
      const folderPath = parts.slice(0, i + 1).join('/')
      let folder = folders.get(folderPath)
      if (!folder) {
        folder = { path: folderPath, name: parts[i], folder: true, children: [] }
        folders.set(folderPath, folder)
        siblings.push(folder)
      }
      siblings = folder.children
    }
    siblings.push({ path, name: parts[parts.length - 1], folder: false, children: [] })
  }
  sortEntries(roots)
  return roots
}

/** Every file in tree display order. */
export function filesInOrder(tree: readonly TreeEntry[]): string[] {
  return tree.flatMap((e) => (e.folder ? filesInOrder(e.children) : [e.path]))
}

/** Parents of a path, outermost first. */
export function ancestors(path: string): string[] {
  const parts = path.split('/')
  return parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join('/'))
}

export interface SearchableTree {
  path: string
  target: FuzzyTarget | null
}

/** Prepare once per snapshot so each keystroke only scores. */
export const prepareSearch = (paths: readonly string[]): SearchableTree[] => paths.map((path) => ({ path, target: prepareFuzzy(path) }))

/** Best matches first, at most `limit`; `total` is false-free: truncated says whether more existed. */
export function searchPrepared(query: string, prepared: readonly SearchableTree[], limit: number): { paths: string[]; truncated: boolean } {
  if (!query.trim()) return { paths: prepared.slice(0, limit).map((p) => p.path), truncated: prepared.length > limit }
  const found = rankFuzzy(query, prepared, (p) => p.target, limit + 1)
  return { paths: found.slice(0, limit).map((r) => r.entry.path), truncated: found.length > limit }
}

/** Paths matching the query (several space-separated terms must all match), best match first. */
export function searchPaths(query: string, paths: readonly string[], limit = 5000): string[] {
  if (!query.trim()) return [...paths]
  return rankFuzzy(query, paths, (p) => prepareFuzzy(p), limit).map((r) => r.entry)
}

/** The path itself when it exists in the snapshot, else its nearest existing folder ('' = none). */
export function nearestExisting(path: string, files: ReadonlySet<string>): string {
  if (files.has(path)) return path
  const prefix = (p: string) => p + '/'
  const folderExists = (p: string) => {
    for (const f of files) if (f.startsWith(prefix(p))) return true
    return false
  }
  for (const parent of ancestors(path).reverse()) if (folderExists(parent)) return parent
  return ''
}
