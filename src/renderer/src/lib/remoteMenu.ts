import { api } from '../api'
import type { MenuItem } from '../../../shared/types'

interface Unpushed {
  head: string | null
  hashes: ReadonlySet<string>
}

const cache = new Map<string, Unpushed>()

/** Reloads which commits no remote branch has yet. Menus read the result synchronously, so they never wait on git. */
export async function refreshUnpushed(repo: string) {
  try {
    const { head, unpushed } = await api.unpushedCommits(repo)
    cache.set(repo, { head, hashes: new Set(unpushed) })
  } catch {
    cache.delete(repo)
  }
}

/** Whether a commit (or 'HEAD') is known not to be on any remote branch; false when that isn't known yet. */
export function isUnpushed(repo: string, hash: string): boolean {
  const known = cache.get(repo)
  if (!known) return false
  return known.hashes.has(hash === 'HEAD' ? (known.head ?? hash) : hash)
}

/**
 * A menu item that opens or copies a page on the remote. When what it names isn't pushed it is greyed and says why;
 * `enabled: false` greys it for some other reason (for example several files selected) without that note.
 */
export const remoteItem = (id: string, label: string, notPushed: boolean, enabled = true): MenuItem => ({
  id,
  label: notPushed ? `${label} (not pushed)` : label,
  enabled: enabled && !notPushed
})
