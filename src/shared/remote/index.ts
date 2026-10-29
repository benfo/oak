/** Everything about a repository's website on its remote: URLs per provider (`providers/`), and when a page may be opened or copied (`rules.ts`). */
export { parseRemoteUrl, type RemoteRepo } from './url.ts'
export type { RemotePageTarget } from './targets.ts'
export { remotePageUrl, pullRequestUrl, pullRequestUrlFromOutput } from './pages.ts'
export { decideRemotePage, isBranchNotOnRemote, isNewFileNotOnRemote, type RemoteFacts, type RemotePageDecision } from './rules.ts'
export { PROVIDERS, knownProviderLabels, providerFor, type RemoteProvider } from './providers/index.ts'
