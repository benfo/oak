import type { RepoCtx } from '../useRepo'

/**
 * Whether Fetch and Pull have anywhere to go: any configured remote, fetched or not. Until the list
 * arrives nobody knows there are none, so they stay available (the toolbar, the palette and the status bar all follow this).
 */
export const hasRemotes = (r: RepoCtx) => r.remotes === null || r.remotes.length > 0
