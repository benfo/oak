import type { Commit, HistoryScope } from '../../../shared/types'

interface Source {
  log(repo: string, limit: number, include?: string, scope?: HistoryScope): Promise<Commit[]>
}

/** Keep the existing ordering for the active scope, expanding in batches without publishing partial graphs. */
export async function loadHistoryToCommit(
  source: Source,
  repo: string,
  hash: string,
  loadedLimit: number,
  isCurrent: () => boolean,
  scope?: HistoryScope
) {
  let limit = Math.max(2000, loadedLimit * 2)
  while (isCurrent()) {
    const commits = await source.log(repo, limit, hash, scope)
    if (!isCurrent()) return null
    if (commits.some((c) => c.hash === hash)) return { commits, limit }
    if (commits.length < limit) throw new Error('The selected commit could not be found in this repository’s history.')
    limit *= 2
  }
  return null
}
