import { useEffect, useState } from 'react'
import { api } from '../api'
import type { TipCommit } from '../../../shared/status'

/** The commit HEAD points at, read again whenever HEAD moves (a commit, a checkout, a pull). Null until known, or with no commits. */
export function useHeadCommit(path: string, head: string | null | undefined): TipCommit | null {
  const [commit, setCommit] = useState<TipCommit | null>(null)
  useEffect(() => {
    let live = true
    api
      .headCommit(path)
      .then((c) => live && setCommit(c))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [path, head])
  return commit
}
