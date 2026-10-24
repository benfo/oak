import { useEffect, useState } from 'react'
import { api, errorMessage } from '../api'

const MAX_CACHED = 6
const cache = new Map<string, Promise<string[]>>()

/** Snapshot file lists are immutable per commit, so a few recent ones are kept for quick revisits. */
function loadTree(repo: string, hash: string): Promise<string[]> {
  const key = JSON.stringify([repo, hash])
  const found = cache.get(key)
  if (found) {
    cache.delete(key)
    cache.set(key, found)
    return found
  }
  const promise = api.commitTree(repo, hash).catch((error) => {
    if (cache.get(key) === promise) cache.delete(key)
    throw error
  })
  cache.set(key, promise)
  if (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value!)
  return promise
}

/** The files of a commit's snapshot. Keeps the previous list while the next one loads. */
export function useCommitTree(repo: string, hash: string | null, enabled: boolean) {
  const [state, setState] = useState<{ key: string; paths?: string[]; error?: string; previous?: string[] } | null>(null)
  const key = JSON.stringify([repo, hash])
  useEffect(() => {
    if (!enabled || !hash) return
    let cancelled = false
    loadTree(repo, hash)
      .then((paths) => !cancelled && setState({ key, paths }))
      .catch((e) => !cancelled && setState({ key, error: errorMessage(e) }))
    return () => {
      cancelled = true
    }
  }, [key, enabled])
  const current = state?.key === key ? state : null
  return {
    paths: current?.paths ?? null,
    stale: !current && !!state?.paths ? state.paths : null,
    error: current?.error ?? null,
    loading: enabled && !!hash && !current
  }
}
