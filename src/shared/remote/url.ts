/** Where a repository lives on a host, from a Git remote URL: `host` is lower case, `path` has no `.git` suffix or trailing slash. */
export interface RemoteRepo {
  host: string
  path: string
}

/** The host and path of a Git remote URL (https, ssh:// or scp-like); null when it isn't one. */
export function parseRemoteUrl(url: string): RemoteRepo | null {
  const text = url.trim()
  const scp = /^(?:[^@/\s]+@)?([^:/\s]{2,}):(?!\/\/)(.+)$/.exec(text)
  const web = /^(?:https?|ssh|git):\/\/(?:[^@/\s]+@)?([^/:\s]+)(?::\d+)?\/(.+)$/.exec(text)
  const match = web ?? scp
  if (!match) return null
  const path = match[2].replace(/\/+$/, '').replace(/\.git$/, '')
  return path ? { host: match[1].toLowerCase(), path } : null
}

/** Encodes each segment of a path or branch name, keeping the slashes. */
export const encodeSegments = (path: string) => path.split('/').map(encodeURIComponent).join('/')
