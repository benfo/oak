/** What a changed path inside the repository means for the screen. */
export type RepoChange = 'ignore' | 'refs' | 'files'

/**
 * Sorts a changed path (relative to the repository, forward slashes). Only files that can change a branch, tag,
 * stash, remote or HEAD justify re-reading the ref lists and the commit list; the index and other `.git`
 * bookkeeping change on every stage and every status call, and only affect the file status.
 * A worktree appearing, going or switching branch changes which branches are held, so it counts as refs; the rest
 * of a worktree's bookkeeping (its index, changed by every status call there) does not.
 */
export function classifyRepoChange(file: string): RepoChange {
  if (file === '.git' || file.startsWith('.git/')) {
    if (/^\.git\/(objects|logs)\//.test(file) || file.endsWith('.lock')) return 'ignore'
    if (/^\.git\/worktrees(\/[^/]+(\/(HEAD|locked))?)?$/.test(file)) return 'refs'
    return /^\.git\/(HEAD|packed-refs|config|shallow|refs\/|reftable\/)/.test(file) ? 'refs' : 'files'
  }
  return /(^|\/)node_modules\//.test(file) ? 'ignore' : 'files'
}

/** How long a window focus may rely on the file watcher before it re-reads refs and history anyway, in case the watcher missed a change. */
export const FOCUS_REFRESH_AFTER_MS = 30_000
