import { api } from '../api'
import { copyText } from './copy'
import { opensBetterInDefaultApp } from '../../../shared/fileKinds'
import { openInEditor } from './openInEditor'
import { copyRemoteLink, openOnRemote } from './openOnRemote'
import { remoteItem } from './remoteMenu'
import { fullPaths } from './listCopy'
import type { MenuItem } from '../../../shared/types'

const fileName = (p: string) => p.split('/').pop() ?? p

/**
 * Shared file-list menu entries, in menu order: Show file history and blame, the local Open rows (editor, default app for non-text files, Explorer),
 * Open in browser, the Copy submenu, then the caller's destructive `manage` items.
 */
export function fileMenuItems(
  paths: string[],
  opts: {
    workingTree: boolean
    canOpen?: boolean
    history?: boolean
    blame?: boolean
    canBlame?: boolean
    canRemote?: boolean
    /** The file is new, so the remote has no page for it. */
    notOnRemote?: boolean
    manage?: MenuItem[]
  }
): MenuItem[] {
  const n = paths.length
  const s = n > 1
  const remote = n === 1 && (opts.canRemote ?? true)
  const copy: MenuItem = {
    label: 'Copy',
    submenu: [
      { id: 'copyname', label: s ? 'File names' : 'File name' },
      { id: 'copy', label: s ? 'Relative paths' : 'Relative path' },
      { id: 'copyfull', label: s ? 'Full paths' : 'Full path' },
      remoteItem('copylink', 'File link', !!opts.notOnRemote, remote)
    ]
  }
  const history: MenuItem[] = opts.history
    ? [
        { id: 'history', label: 'Show file history', enabled: n === 1 },
        ...(opts.blame ? [{ id: 'blame', label: 'Show blame', enabled: n === 1 && (opts.canBlame ?? true) }] : []),
        { type: 'separator' }
      ]
    : []
  const openLocal = n === 1 && (opts.canOpen ?? true)
  const open: MenuItem[] = [
    { id: 'editor', label: 'Open in editor', enabled: openLocal },
    // An editor already opens text; the default app is for images, documents and other files an editor can't edit.
    ...(opts.workingTree && n === 1 && opensBetterInDefaultApp(paths[0])
      ? [{ id: 'open', label: 'Open with default app', enabled: openLocal }]
      : []),
    ...(opts.workingTree ? [{ id: 'reveal', label: 'Show in Explorer', enabled: n === 1 }] : []),
    remoteItem('remote', 'Open in browser', !!opts.notOnRemote, remote)
  ]
  return [
    ...history,
    ...open,
    { type: 'separator' },
    copy,
    ...(opts.workingTree && opts.manage?.length ? [{ type: 'separator' as const }, ...opts.manage] : [])
  ]
}

/** Handles the ids from `fileMenuItems`; returns true when one matched. */
export function runFileMenu(
  id: string | null,
  repoPath: string,
  paths: string[],
  onHistory?: (path: string) => void,
  onBlame?: (path: string) => void,
  /** The commit the files are shown at; HEAD when omitted (working-tree files). */
  commit = 'HEAD'
): boolean {
  const n = paths.length
  const noun = (one: string) => (n === 1 ? one : `${n} ${one}s`)
  if (id === 'history' && n === 1 && onHistory) onHistory(paths[0])
  else if (id === 'blame' && n === 1 && onBlame) onBlame(paths[0])
  else if (id === 'editor' && n === 1) openInEditor(repoPath, paths[0])
  else if (id === 'remote' && n === 1) void openOnRemote(repoPath, { kind: 'file', hash: commit, path: paths[0] })
  else if (id === 'copylink' && n === 1) void copyRemoteLink(repoPath, { kind: 'file', hash: commit, path: paths[0] }, 'file link')
  else if (id === 'open' && n === 1) api.openPath(repoPath, paths[0])
  else if (id === 'reveal' && n === 1) api.revealFile(repoPath, paths[0])
  else if (id === 'copyname') copyText(paths.map(fileName).join('\n'), noun('file name'))
  else if (id === 'copy') copyText(paths.join('\n'), noun('relative path'))
  else if (id === 'copyfull') copyText(fullPaths(repoPath, paths).join('\n'), noun('full path'))
  else return false
  return true
}
