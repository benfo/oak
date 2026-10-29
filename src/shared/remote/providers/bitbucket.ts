import { encodeSegments } from '../url.ts'
import type { RemoteProvider } from './types.ts'

const base = (path: string) => `https://bitbucket.org/${path}`

export const bitbucket: RemoteProvider = {
  id: 'bitbucket',
  label: 'Bitbucket',
  hosts: (host) => host === 'bitbucket.org',
  repoUrl: ({ path }) => base(path),
  pageUrl: ({ path }, target) => {
    if (target.kind === 'branch') return `${base(path)}/branch/${encodeSegments(target.name)}`
    if (target.kind === 'commit') return `${base(path)}/commits/${target.hash}`
    return `${base(path)}/src/${target.hash}/${encodeSegments(target.path)}${target.line ? `#lines-${target.line}` : ''}`
  },
  pullRequestUrl: ({ path }, branch) => `${base(path)}/pull-requests/new?source=${encodeURIComponent(branch)}`
}
