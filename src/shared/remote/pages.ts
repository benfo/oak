import { providerFor } from './providers/index.ts'
import type { RemotePageTarget } from './targets.ts'
import { parseRemoteUrl } from './url.ts'

/** The web page for `target` on the remote at `remoteUrl`; null when the URL isn't a Git remote or its provider has no such page. */
export function remotePageUrl(remoteUrl: string, target: RemotePageTarget): string | null {
  const repo = parseRemoteUrl(remoteUrl)
  if (!repo) return null
  const provider = providerFor(repo)
  return target.kind === 'repo' ? provider.repoUrl(repo) : provider.pageUrl(repo, target)
}

/** The "new pull request" page for a branch; null for a host that isn't a known provider. */
export function pullRequestUrl(remoteUrl: string, branch: string): string | null {
  const repo = parseRemoteUrl(remoteUrl)
  return repo ? providerFor(repo).pullRequestUrl(repo, branch) : null
}

/** The pull/merge request link a remote prints after a push ("remote: Create a pull request … visiting:"). */
export function pullRequestUrlFromOutput(output: string): string | null {
  const lines = output.split(/\r?\n/).map((line) => line.replace(/^remote:\s?/, '').trim())
  for (let i = 0; i < lines.length; i++) {
    if (!/(pull|merge) request/i.test(lines[i])) continue
    for (const line of lines.slice(i, i + 3)) {
      const url = /https:\/\/[^\s<>"']+/.exec(line)?.[0]
      if (url) return url
    }
  }
  return null
}
