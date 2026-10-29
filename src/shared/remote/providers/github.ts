import { encodeSegments } from '../url.ts'
import type { RemoteProvider } from './types.ts'

const base = (path: string) => `https://github.com/${path}`

export const github: RemoteProvider = {
  id: 'github',
  label: 'GitHub',
  hosts: (host) => host === 'github.com',
  repoUrl: ({ path }) => base(path),
  pageUrl: ({ path }, target) => {
    if (target.kind === 'branch') return `${base(path)}/tree/${encodeSegments(target.name)}`
    if (target.kind === 'commit') return `${base(path)}/commit/${target.hash}`
    return `${base(path)}/blob/${target.hash}/${encodeSegments(target.path)}${target.line ? `#L${target.line}` : ''}`
  },
  pullRequestUrl: ({ path }, branch) => `${base(path)}/pull/new/${encodeSegments(branch)}`
}
