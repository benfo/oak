import type { ChangedFile, Commit, CommitDetails } from '../../../shared/types'
import { WORKING_HASH } from '../../../shared/working.ts'

interface Source {
  mergeBase?(repo: string, before: string, after: string): Promise<string | null>
  commitDetails(repo: string, hash: string, compareBase?: string): Promise<CommitDetails>
  commitFileDiff(repo: string, hash: string, parent: string | null, path: string, oldPath?: string, context?: number): Promise<string>
  workingChanges?(repo: string): Promise<ChangedFile[]>
  workingFileDiff?(repo: string, path: string, status: string, oldPath?: string, context?: number): Promise<string>
}

export interface BranchComparison {
  targetName: string
  targetHash: string | null
}

export interface CommitPreview {
  repo: string
  compareBase?: string
  branchComparison?: BranchComparison
  /** The mode actually shown: "changes" falls back to "snapshots" when there is no single common ancestor. */
  comparisonMode?: 'changes' | 'snapshots'
  details: CommitDetails
  file: ChangedFile | null
  diff: string | null
}

/** Bounded, session-local caches. Failed requests can be retried; rapid revisits share in-flight work. */
function cached<T>(cache: Map<string, Promise<T>>, key: string, load: () => Promise<T>): Promise<T> {
  const found = cache.get(key)
  if (found) {
    cache.delete(key)
    cache.set(key, found)
    return found
  }
  const promise = load().catch((error) => {
    if (cache.get(key) === promise) cache.delete(key)
    throw error
  })
  cache.set(key, promise)
  if (cache.size > 30) cache.delete(cache.keys().next().value!)
  return promise
}

/** A preview is ready only when its metadata, selected file and diff describe the same commit. */
export function createCommitPreviewLoader(source: Source) {
  const details = new Map<string, Promise<CommitDetails>>()
  const diffs = new Map<string, Promise<string>>()
  const bases = new Map<string, Promise<string>>()
  let workingFiles: { key: string; promise: Promise<ChangedFile[]> } | null = null
  return async (repo: string, hash: string, path: string | null, context: number, compareBase?: string, branchComparison?: BranchComparison, revision?: number, fileCommit?: Commit): Promise<CommitPreview> => {
    let comparisonMode: CommitPreview['comparisonMode']
    if (hash === WORKING_HASH) {
      // The working tree changes under the user's hands, so the diff is never cached. The file list is
      // shared only within one refresh `revision`, so picking another file runs just its diff.
      if (!source.workingChanges || !source.workingFileDiff) throw new Error('Working changes are unavailable.')
      let listing = revision === undefined ? null : workingFiles
      const key = JSON.stringify([repo, revision])
      if (!listing || listing.key !== key) {
        const promise = source.workingChanges(repo)
        listing = { key, promise }
        if (revision !== undefined) {
          workingFiles = listing
          promise.catch(() => { if (workingFiles === listing) workingFiles = null })
        }
      }
      const files = await listing.promise
      const file = files.find((f) => f.path === path) ?? files[0] ?? null
      const diff = file ? await source.workingFileDiff(repo, file.path, file.status, file.oldPath, context) : null
      const details: CommitDetails = { hash, parents: [], author: '', email: '', authorDate: 0, committer: '', committerEmail: '', commitDate: 0, message: '', files }
      return { repo, details, file, diff }
    }
    if (branchComparison) {
      const { targetHash } = branchComparison
      if (!targetHash) throw new Error(`Pinned branch ${branchComparison.targetName} no longer exists. Choose another target or end comparison.`)
      if (!source.mergeBase) throw new Error('Common-ancestor comparison is unavailable.')
      const base = await cached(bases, JSON.stringify([repo, targetHash, hash]), () => source.mergeBase!(repo, targetHash, hash))
      // Without a single common ancestor only the difference between the tips is meaningful.
      compareBase = base ?? targetHash
      comparisonMode = base ? 'changes' : 'snapshots'
    }
    if (fileCommit) {
      // File history shows one file, so the commit's own file list and counts are never requested.
      const file: ChangedFile = { path: fileCommit.path ?? path ?? '', oldPath: fileCommit.oldPath, status: fileCommit.status ?? 'M', additions: null, deletions: null }
      const info: CommitDetails = {
        hash, parents: fileCommit.parents, author: fileCommit.author, email: fileCommit.email, authorDate: fileCommit.date,
        committer: fileCommit.author, committerEmail: fileCommit.email, commitDate: fileCommit.date, message: fileCommit.subject, files: [file]
      }
      const parent = fileCommit.parents[0] ?? null
      const diff = await cached(diffs, JSON.stringify([repo, hash, parent, file.path, file.oldPath, context]), () =>
        source.commitFileDiff(repo, hash, parent, file.path, file.oldPath, context)
      )
      return { repo, details: info, file, diff }
    }
    const info = await cached(details, JSON.stringify([repo, hash, compareBase]), () => source.commitDetails(repo, hash, compareBase))
    const file = info.files.find((f) => f.path === path) ?? info.files[0] ?? null
    const parent = compareBase ?? info.parents[0] ?? null
    const diff = file ? await cached(diffs, JSON.stringify([repo, info.hash, parent, file.path, file.oldPath, context]), () =>
      source.commitFileDiff(repo, info.hash, parent, file.path, file.oldPath, context)
    ) : null
    return { repo, compareBase, branchComparison, comparisonMode, details: info, file, diff }
  }
}
