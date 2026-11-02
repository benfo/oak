import type { Branch } from '../../../shared/types'
import type { RepoCtx } from '../useRepo'

/** The remote names behind the remote branches ("origin/main" is on "origin"). */
export const remoteNames = (branches: Branch[]) => [
  ...new Set(branches.filter((b) => b.type === 'remote').map((b) => b.name.split('/')[0]))
]

/**
 * Whether Fetch and Pull have anywhere to go. Until the lists arrive nobody knows there are none,
 * so they stay available (the toolbar, the palette and the status bar all follow this).
 */
export const hasRemotes = (r: RepoCtx) => !r.refsLoaded || r.branches.some((b) => b.type === 'remote')
