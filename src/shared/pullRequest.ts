/** Where a remote's web pages live, from a Git remote URL (https, ssh:// or scp-like). */
export function parseRemoteUrl(url: string): { host: string; path: string } | null {
  const text = url.trim()
  const scp = /^(?:[^@/\s]+@)?([^:/\s]{2,}):(?!\/\/)(.+)$/.exec(text)
  const web = /^(?:https?|ssh|git):\/\/(?:[^@/\s]+@)?([^/:\s]+)(?::\d+)?\/(.+)$/.exec(text)
  const match = web ?? scp
  if (!match) return null
  const path = match[2].replace(/\/+$/, '').replace(/\.git$/, '')
  return path ? { host: match[1].toLowerCase(), path } : null
}

const segments = (path: string) => path.split('/').map(encodeURIComponent).join('/')

/** The "new pull request" page for a branch on a well-known host; null for any other host. */
export function pullRequestUrl(remoteUrl: string, branch: string): string | null {
  const remote = parseRemoteUrl(remoteUrl)
  if (!remote) return null
  const { host, path } = remote
  if (host === 'github.com') return `https://github.com/${path}/pull/new/${segments(branch)}`
  if (host === 'gitlab.com') return `https://gitlab.com/${path}/-/merge_requests/new?merge_request[source_branch]=${encodeURIComponent(branch)}`
  if (host === 'bitbucket.org') return `https://bitbucket.org/${path}/pull-requests/new?source=${encodeURIComponent(branch)}`
  if (host === 'dev.azure.com' || host === 'ssh.dev.azure.com') {
    const parts = path.replace(/^v3\//, '').split('/').filter((part) => part !== '_git')
    if (parts.length < 3) return null
    const [org, project, repo] = parts
    return `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}/_git/${encodeURIComponent(repo)}/pullrequestcreate?sourceRef=${encodeURIComponent(branch)}`
  }
  return null
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
