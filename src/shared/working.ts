import type { ChangedFile, RepoStatus } from './types.ts'

/** Id of the virtual History row that stands for the uncommitted changes. Never a valid commit hash. */
export const WORKING_HASH = 'working-changes'

/** Distinct files with uncommitted changes (a file both staged and modified counts once). */
export function workingFileCount(status: RepoStatus | null): number {
  if (!status) return 0
  return new Set([...status.staged, ...status.unstaged, ...status.conflicted].map((f) => f.path)).size
}

/**
 * The working changes as one comparison of HEAD with the working tree, built from the status already loaded so
 * History lists them without asking git again. A staged status wins over the working tree's, except that a file
 * deleted from the working tree is deleted (and one added, then deleted, is no change at all). Counts are unknown.
 */
export function workingFiles(status: RepoStatus | null): ChangedFile[] {
  if (!status) return []
  const files = new Map<string, ChangedFile>()
  const add = (path: string, change: string, oldPath?: string) => {
    if (!files.has(path)) files.set(path, { path, ...(oldPath ? { oldPath } : {}), status: change, additions: null, deletions: null })
  }
  const unstaged = new Map(status.unstaged.map((f) => [f.path, f.status]))
  for (const f of status.staged) {
    if (unstaged.get(f.path) !== 'D') add(f.path, f.status, f.oldPath)
    else if (f.status === 'R' && f.oldPath) add(f.oldPath, 'D')
    else if (f.status !== 'A') add(f.path, 'D')
  }
  for (const f of status.conflicted) add(f.path, 'M')
  const staged = new Set(status.staged.map((f) => f.path))
  for (const f of status.unstaged) if (!staged.has(f.path)) add(f.path, f.status)
  return [...files.values()].sort((a, b) => a.path.localeCompare(b.path))
}

/** The working row needs a HEAD to compare against and something to show. */
export function hasWorkingChanges(status: RepoStatus | null): boolean {
  return !!status?.head && workingFileCount(status) > 0
}
