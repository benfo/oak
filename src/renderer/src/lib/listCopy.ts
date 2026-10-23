/** What a copy command puts on the clipboard, and how the toast names it. */
export interface CopyItem { text: string; what: string }

/**
 * A list whose focused selection Ctrl+C (primary) and Ctrl+Shift+C (alternate) copy: files copy
 * relative / full paths, commits their hash, branches their name / commit hash.
 */
export interface ListCopySource {
  element: () => HTMLElement | null
  primary: () => CopyItem | null
  alternate?: () => CopyItem | null
}

const sources = new Set<ListCopySource>()

/** Lists register while mounted; the one containing focus wins. */
export function registerListCopy(source: ListCopySource) {
  sources.add(source)
  return () => void sources.delete(source)
}

export function activeListCopy(): ListCopySource | null {
  const active = typeof document === 'undefined' ? null : document.activeElement
  if (!active) return null
  for (const source of sources) if (source.element()?.contains(active) && source.primary()) return source
  return null
}

export const fullPaths = (repoPath: string, paths: string[]) => {
  const sep = repoPath.includes('\\') ? '\\' : '/'
  const root = repoPath.replace(/[\\/]+$/, '')
  return paths.map((p) => root + sep + p.split('/').join(sep))
}

const plural = (n: number, what: string) => (n === 1 ? what : `${n} ${what}s`)

/** A copy source for a file list; `live` reads the current repo and selected repo-relative paths. */
export function fileListCopy(element: () => HTMLElement | null, live: () => { repo: string; paths: string[] }): ListCopySource {
  const item = (full: boolean): CopyItem | null => {
    const { repo, paths } = live()
    if (!paths.length) return null
    return { text: (full ? fullPaths(repo, paths) : paths).join('\n'), what: plural(paths.length, full ? 'full path' : 'relative path') }
  }
  return { element, primary: () => item(false), alternate: () => item(true) }
}
