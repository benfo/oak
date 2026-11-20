import { useEffect, useState } from 'react'
import type { Identity } from '../../../shared/identity'
import type { TipCommit } from '../../../shared/status'
import type { RepoCtx } from '../useRepo'
import { useHeadCommit } from './useHeadCommit'
import { useIdentity } from './useIdentity'
import { useLastFetched } from './useLastFetched'

/** A read that never answers must not hide the facts for good. */
const SETTLE_LIMIT_MS = 10_000

export interface BarFacts {
  identity: Identity | null
  fetched: ReturnType<typeof useLastFetched>
  commit: TipCommit | null | undefined
  /** Every fact has its first answer, so the items can appear together instead of pushing each other aside. */
  ready: boolean
}

/** The repository facts the status bar shows, read once here (several items share them). */
export function useBarFacts(r: RepoCtx): BarFacts {
  const identity = useIdentity(r.path)
  const fetched = useLastFetched(r.path, r.busy)
  const commit = useHeadCommit(r.path, r.status?.head)
  const known = !!r.status && r.remotes !== null && identity !== null && fetched !== null && commit !== undefined
  // Latched: later re-reads keep their old values meanwhile, so the bar never hides again.
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (known) setReady(true)
  }, [known])
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), SETTLE_LIMIT_MS)
    return () => clearTimeout(timer)
  }, [])
  return { identity, fetched, commit, ready: ready || known }
}
