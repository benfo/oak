/** Something on a remote's website: the repository, a branch, a commit, or a file (at a line) as of a commit. */
export type RemotePageTarget =
  | { kind: 'repo' }
  | { kind: 'branch'; name: string }
  | { kind: 'commit'; hash: string }
  | { kind: 'file'; hash: string; path: string; line?: number }

/** A target inside the repository (everything but the repository's home page). */
export type RemoteInnerTarget = Exclude<RemotePageTarget, { kind: 'repo' }>
