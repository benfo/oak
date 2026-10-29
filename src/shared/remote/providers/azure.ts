import type { RemoteRepo } from '../url.ts'
import type { RemoteProvider } from './types.ts'

/** The organization, project and repository of an Azure DevOps remote path (https or ssh form); null when it has fewer parts. */
function azureRepo(path: string): [org: string, project: string, repo: string] | null {
  const parts = path
    .replace(/^v3\//, '')
    .split('/')
    .filter((part) => part !== '_git')
  return parts.length < 3 ? null : [parts[0], parts[1], parts[2]]
}

function home({ path }: RemoteRepo): string | null {
  const parts = azureRepo(path)
  if (!parts) return null
  const [org, project, repo] = parts.map(encodeURIComponent)
  return `https://dev.azure.com/${org}/${project}/_git/${repo}`
}

export const azure: RemoteProvider = {
  id: 'azure',
  label: 'Azure DevOps',
  hosts: (host) => host === 'dev.azure.com' || host === 'ssh.dev.azure.com',
  repoUrl: home,
  pageUrl: (repo, target) => {
    const base = home(repo)
    if (!base) return null
    if (target.kind === 'branch') return `${base}?version=GB${encodeURIComponent(target.name)}`
    if (target.kind === 'commit') return `${base}/commit/${target.hash}`
    const line = target.line ? `&line=${target.line}&lineEnd=${target.line + 1}&lineStartColumn=1&lineEndColumn=1` : ''
    return `${base}?path=${encodeURIComponent(`/${target.path}`)}&version=GC${target.hash}${line}`
  },
  pullRequestUrl: (repo, branch) => {
    const base = home(repo)
    return base ? `${base}/pullrequestcreate?sourceRef=${encodeURIComponent(branch)}` : null
  }
}
