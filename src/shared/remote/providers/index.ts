import type { RemoteRepo } from '../url.ts'
import { azure } from './azure.ts'
import { bitbucket } from './bitbucket.ts'
import { generic } from './generic.ts'
import { github } from './github.ts'
import { gitlab } from './gitlab.ts'
import type { RemoteProvider } from './types.ts'

export type { RemoteProvider } from './types.ts'

/** Known providers, most specific first; `generic` matches everything else and must stay last. */
export const PROVIDERS: RemoteProvider[] = [github, gitlab, bitbucket, azure, generic]

/** The names of the providers Oak knows (not the generic fallback), for messages, in list order. */
export const knownProviderLabels = () => PROVIDERS.filter((p) => p !== generic).map((p) => p.label)

export const providerFor = ({ host }: RemoteRepo): RemoteProvider => PROVIDERS.find((p) => p.hosts(host)) ?? generic
