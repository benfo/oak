import { api } from '../api'
import { chooseCompareTarget } from '../../../shared/compareTarget'
import type { Branch } from '../../../shared/types'

const targetKey = (repo: string) => `compareTarget:${repo}`
const scopeKey = (repo: string) => `historyScope:${repo}`

export const rememberCompareTarget = (repo: string, name: string) => {
  try { localStorage.setItem(targetKey(repo), name) } catch { /* storage unavailable */ }
}

const remoteHeads = new Map<string, { value: string | null; at: number }>()
const remoteHeadLoads = new Map<string, Promise<string | null>>()
const REMOTE_HEAD_FRESH_MS = 30_000

function loadRemoteHead(repo: string) {
  let load = remoteHeadLoads.get(repo)
  if (!load) {
    load = api.remoteHead(repo).then((value) => { remoteHeads.set(repo, { value, at: Date.now() }); return value })
      .finally(() => remoteHeadLoads.delete(repo))
    remoteHeadLoads.set(repo, load)
  }
  return load
}

/**
 * The remote's default branch (origin/HEAD). It almost never changes, so the last answer is used
 * immediately (menus must not wait on git) and refreshed in the background once it is a little old.
 */
export function cachedRemoteHead(repo: string): string | null | Promise<string | null> {
  const known = remoteHeads.get(repo)
  if (!known) return loadRemoteHead(repo)
  if (Date.now() - known.at > REMOTE_HEAD_FRESH_MS) void loadRemoteHead(repo).catch(() => {})
  return known.value
}

/** Warms the cache when a repository opens, so the first menu is already instant. */
export function prefetchRemoteHead(repo: string) {
  void loadRemoteHead(repo).catch(() => {})
}

/** The default comparison base for `source` (null = checked-out branch), using the branch list already in memory. */
export async function defaultCompareName(repo: string, branches: Branch[], source: string | null): Promise<string | null> {
  const locals = branches.filter((b) => b.type === 'local').map((b) => b.name)
  const current = source ?? branches.find((b) => b.current)?.name ?? null
  return chooseCompareTarget(await cachedRemoteHead(repo), locals, current)
}

/** The branch a comparison starts against: the one chosen last time in this repository, else the detected default. */
export async function resolveCompareTarget(repo: string, branches: Branch[], source: Branch | null): Promise<Branch | null> {
  const sourceName = source?.name ?? branches.find((b) => b.current)?.name ?? null
  // origin/x is the same line as local x, so neither is a target for the other.
  const tail = (name: string) => name.slice(name.indexOf('/') + 1)
  const sameLine = (b: Branch) => b.name === sourceName
    || (!!sourceName && ((b.type === 'remote' && source?.type !== 'remote' && tail(b.name) === sourceName)
      || (b.type === 'local' && source?.type === 'remote' && tail(source.name) === b.name)))
  const usable = (name: string | null) => branches.find((b) => b.type !== 'tag' && b.name === name && !sameLine(b)) ?? null
  let remembered: string | null = null
  try { remembered = localStorage.getItem(targetKey(repo)) } catch { /* storage unavailable */ }
  return usable(remembered) ?? usable(await defaultCompareName(repo, branches, sourceName))
}

/** 'head' = only commits not in the default branch; 'lineage' = the checked-out line with all its ancestry. */
export type HistoryScopeKind = 'all' | 'head' | 'lineage' | 'target'

export function loadHistoryScope(repo: string): HistoryScopeKind {
  try {
    const stored = localStorage.getItem(scopeKey(repo))
    if (stored === 'head' || stored === 'lineage' || stored === 'target') return stored
  } catch { /* storage unavailable */ }
  return 'all'
}

export function saveHistoryScope(repo: string, kind: HistoryScopeKind) {
  try { localStorage.setItem(scopeKey(repo), kind) } catch { /* storage unavailable */ }
}
