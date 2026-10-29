import type { RemoteRepo } from '../url.ts'
import type { RemoteInnerTarget } from '../targets.ts'

/**
 * A website that hosts Git repositories. To support another one, add a file here that implements this
 * and list it in `providers/index.ts`; nothing else needs to know about it.
 */
export interface RemoteProvider {
  id: string
  /** The name people know it by ("GitHub"), used in messages. */
  label: string
  /** Whether this provider is the one for a remote on `host`. */
  hosts(host: string): boolean
  /** The repository's home page; null when `repo.path` isn't a repository of this provider. */
  repoUrl(repo: RemoteRepo): string | null
  /** A page inside the repository; null when this provider has no such page. */
  pageUrl(repo: RemoteRepo, target: RemoteInnerTarget): string | null
  /** The page that starts a pull (merge) request from `branch`; null when this provider has none. */
  pullRequestUrl(repo: RemoteRepo, branch: string): string | null
}
