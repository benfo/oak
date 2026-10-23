import { api } from '../api'
import { copyText } from './copy'
import { fullPaths } from './listCopy'
import type { MenuItem } from '../../../shared/types'

const fileName = (p: string) => p.split('/').pop() ?? p

/** Shared file-list menu entries: Show file history, Open / Show in Explorer (working-tree files) and the Copy submenu. */
export function fileMenuItems(paths: string[], opts: { workingTree: boolean; canOpen?: boolean; history?: boolean }): MenuItem[] {
  const n = paths.length
  const s = n > 1
  const copy: MenuItem = { label: 'Copy', submenu: [
    { id: 'copyname', label: s ? 'File names' : 'File name' },
    { id: 'copy', label: s ? 'Relative paths' : 'Relative path' },
    { id: 'copyfull', label: s ? 'Full paths' : 'Full path' }
  ] }
  const history: MenuItem[] = opts.history ? [{ id: 'history', label: 'Show file history', enabled: n === 1 }, { type: 'separator' }] : []
  // Alone, the submenu is an extra step: list the copy commands directly.
  if (!opts.workingTree) return [...history, ...copy.submenu!.map((i) => ({ ...i, label: `Copy ${(i.label ?? '').toLowerCase()}` }))]
  return [
    ...history,
    { id: 'open', label: 'Open file', enabled: n === 1 && (opts.canOpen ?? true) },
    { id: 'reveal', label: 'Show in Explorer', enabled: n === 1 },
    copy
  ]
}

/** Handles the ids from `fileMenuItems`; returns true when one matched. */
export function runFileMenu(id: string | null, repoPath: string, paths: string[], onHistory?: (path: string) => void): boolean {
  const n = paths.length
  const noun = (one: string) => (n === 1 ? one : `${n} ${one}s`)
  if (id === 'history' && n === 1 && onHistory) onHistory(paths[0])
  else if (id === 'open' && n === 1) api.openPath(repoPath, paths[0])
  else if (id === 'reveal' && n === 1) api.revealFile(repoPath, paths[0])
  else if (id === 'copyname') copyText(paths.map(fileName).join('\n'), noun('file name'))
  else if (id === 'copy') copyText(paths.join('\n'), noun('relative path'))
  else if (id === 'copyfull') copyText(fullPaths(repoPath, paths).join('\n'), noun('full path'))
  else return false
  return true
}
