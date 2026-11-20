import { useEffect, useState } from 'react'
import { api } from '../api'
import type { TipCommit } from '../../../shared/status'

/**
 * The commit HEAD points at, read again whenever HEAD moves (a commit, a checkout, a pull). Undefined until
 * the first read; null with no commits (or when it cannot be read). A later read keeps the old commit meanwhile.
 */
export function useHeadCommit(path: string, head: string | null | undefined): TipCommit | null | undefined {
  const [commit, setCommit] = useState<TipCommit | null | undefined>(undefined)
  useEffect(() => {
    let live = true
    api
      .headCommit(path)
      .then((c) => live && setCommit(c))
      .catch(() => live && setCommit((known) => known ?? null))
    return () => {
      live = false
    }
  }, [path, head])
  return commit
}
