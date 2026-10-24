import type { RepoStatus } from './types.ts'

/** Id of the virtual History row that stands for the uncommitted changes. Never a valid commit hash. */
export const WORKING_HASH = 'working-changes'

/** Distinct files with uncommitted changes (a file both staged and modified counts once). */
export function workingFileCount(status: RepoStatus | null): number {
  if (!status) return 0
  return new Set([...status.staged, ...status.unstaged, ...status.conflicted].map((f) => f.path)).size
}

/** The working row needs a HEAD to compare against and something to show. */
export function hasWorkingChanges(status: RepoStatus | null): boolean {
  return !!status?.head && workingFileCount(status) > 0
}
