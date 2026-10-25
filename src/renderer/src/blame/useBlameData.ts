import { useEffect, useState } from 'react'
import { api, errorMessage } from '../api'
import type { BlameResult } from '../../../shared/blame'

const SLOW_MS = 300

/** `version` is the file and revision alone, so a setting change can keep showing the same file while it reloads. */
type Loaded = { base: string; version: string; result: BlameResult } | { base: string; version: string; error: string }

interface Options {
  repo: string
  file: string
  /** A commit to blame at, or null for the working tree. */
  rev: string | null
  ignoreWhitespace: boolean
  useIgnoreRevs: boolean
  /** Working-tree blame reloads when these change; a commit's blame never does. */
  status: unknown
  contentRevision: number
}

/** Loads the blame for a file and revision, and reloads it when a setting changes. */
export function useBlameData({ repo, file, rev, ignoreWhitespace, useIgnoreRevs, status, contentRevision }: Options) {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  // The toggle only shows once a blame has found an ignore-revs list, and stays while the next one loads.
  const [hasIgnoreRevs, setHasIgnoreRevs] = useState(false)
  const [slow, setSlow] = useState(false)
  const version = JSON.stringify([repo, file, rev])
  const base = JSON.stringify([version, ignoreWhitespace, useIgnoreRevs])

  useEffect(() => {
    let cancelled = false
    api
      .blame(repo, file, rev, ignoreWhitespace, useIgnoreRevs)
      .then((result) => {
        if (cancelled) return
        if (result.hasIgnoreRevs) setHasIgnoreRevs(true)
        setLoaded({ base, version, result })
      })
      .catch((e) => !cancelled && setLoaded({ base, version, error: errorMessage(e) }))
    return () => {
      cancelled = true
    }
  }, [base, rev === null ? status : null, rev === null ? contentRevision : 0])

  // The previous lines stay up while a working-tree reload or a setting change reloads the same file; only a different file or revision shows the loading state.
  const current = loaded?.version === version ? loaded : null
  const loading = !current

  useEffect(() => {
    if (!loading) return setSlow(false)
    const timer = setTimeout(() => setSlow(true), SLOW_MS)
    return () => clearTimeout(timer)
  }, [loading])

  return {
    result: current && 'result' in current ? current.result : null,
    error: current && 'error' in current ? current.error : null,
    loading,
    /** Loading has taken long enough to show a spinner. */
    slow,
    hasIgnoreRevs
  }
}
