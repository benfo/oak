import type { RemoteProvider } from './types.ts'

/** Any other host: just the repository's address (https://host/path), with no deep links or pull requests. */
export const generic: RemoteProvider = {
  id: 'generic',
  label: 'Other',
  hosts: () => true,
  repoUrl: ({ host, path }) => `https://${host}/${path}`,
  pageUrl: ({ host, path }) => `https://${host}/${path}`,
  pullRequestUrl: () => null
}
