import type { RepoStatus } from '../../../shared/types'

/** Files with any change (conflicted, unstaged or staged), each counted once. */
export const changedFileCount = (status: RepoStatus | null | undefined) =>
  status ? new Set([...status.staged, ...status.unstaged, ...status.conflicted].map((x) => x.path)).size : 0
