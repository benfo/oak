import { useCallback, useEffect, useRef, useState } from 'react'
import { api, errorMessage, repoName } from './api'
import { notify } from './notices'
import type { Branch, BranchDetail, Commit, HistoryScope, RepoStatus, Stash } from '../../shared/types'
import { logNeedsBranches, withDetails } from '../../shared/refList'
import { FOCUS_REFRESH_AFTER_MS } from '../../shared/watchPaths'
import { loadHistoryToCommit } from './lib/historyNavigation'
import { refreshUnpushed } from './lib/remoteMenu'
import {
  cachedRemoteHead,
  defaultCompareName,
  loadHistoryScope,
  prefetchRemoteHead,
  resolveCompareTarget,
  saveHistoryScope,
  type HistoryScopeKind
} from './lib/compareTarget'
import {
  hiddenRefGlobs,
  loadBranchOptions,
  saveBranchOptions,
  visibleRemoteRefs,
  type SidebarBranchOptions
} from './sidebar/sidebarBranches'

const PAGE = 2000
const MAX_OUTPUT = 200_000
const NOTIFY_AFTER_MS = 8000

export interface HistoryRange {
  from: string
  to: string
}

export interface OpState {
  label: string
  started: number
  output: string
  finished?: number
  ok?: boolean
}

/** A desktop notification when a slow operation finishes while the user is in another window. */
function notifyIfSlow(label: string, ok: boolean, ms: number) {
  if (ms < NOTIFY_AFTER_MS || document.hasFocus()) return
  try {
    new Notification(`Oak: ${label} ${ok ? 'finished' : 'failed'}`, {
      body: ok ? 'Done.' : 'Open Oak to see what went wrong.',
      silent: ok
    })
  } catch {
    // notifications unavailable
  }
}

export interface BusyOptions<T> {
  done?: string | null | ((result: T) => string | null)
}

export interface RepoCtx {
  path: string
  name: string
  status: RepoStatus | null
  /** Invalidates content previews even when Git's file-status labels are unchanged. */
  contentRevision: number
  branches: Branch[]
  recentBranches: string[]
  stashes: Stash[]
  commits: Commit[]
  /** The file `commits` is the history of, or null for the scope's ordinary list. Lags `historyFile` while the new list loads. */
  commitsFile: string | null
  hasMore: boolean
  /** The branch, tag and stash lists have loaded for the first time. Until then they are empty because nothing has arrived, not because there are none. */
  refsLoaded: boolean
  /** The commit list has loaded for the first time. */
  historyLoaded: boolean
  /** Ahead/behind counts, dates and subjects of branches and tags (loaded after the lists themselves). */
  detailsLoaded: boolean
  /** Which refs the graph walks. `scopeTarget` names the comparison branch included by the 'target' scope. */
  historyScope: HistoryScopeKind
  scopeTarget: string | null
  setHistoryScope(kind: HistoryScopeKind): void
  /** While a comparison is shown, the graph lists only the commits `from..to` adds; null restores the scope. */
  setHistoryRange(range: HistoryRange | null): void
  /** Repository-relative path whose history the graph lists (following renames); null shows every commit in scope. In memory only. */
  historyFile: string | null
  setHistoryFile(file: string | null, keep?: string): void
  historyNavigation: { hash: string; error?: string } | null
  ensureCommit(hash: string): Promise<void>
  cancelHistoryNavigation(): void
  busy: string | null
  /** The current or most recent long-running operation, with its streamed output. */
  op: OpState | null
  refresh(): Promise<void>
  refreshStatus(): Promise<void>
  loadMore(): void
  /** Sidebar branch display options for this repository; hidden branches also drop out of the graph. */
  branchOptions: SidebarBranchOptions
  /** The remote's default branch (for example origin/main), which remote-only hiding keeps. */
  remoteHead: string | null
  setBranchOptions(options: SidebarBranchOptions): void
  /**
   * Runs an operation with a busy indicator, refreshes afterwards, and rethrows errors. `done` is what the
   * status bar says once it succeeds (null for nothing), either fixed text or built from the result.
   */
  withBusy<T>(label: string, fn: () => Promise<T>, options?: BusyOptions<T>): Promise<T>
  /** Like withBusy, but reports errors as a toast instead of throwing. */
  run<T>(label: string, fn: () => Promise<T>, options?: BusyOptions<T>): Promise<T | undefined>
}

export function useRepo(path: string): RepoCtx {
  const [status, setStatus] = useState<RepoStatus | null>(null)
  const [contentRevision, setContentRevision] = useState(0)
  const [branches, setBranches] = useState<Branch[]>([])
  const [recentBranches, setRecentBranches] = useState<string[]>([])
  const [stashes, setStashes] = useState<Stash[]>([])
  const [commits, setCommits] = useState<Commit[]>([])
  // The file `commits` was listed for. It lags `historyFile` until the filtered log arrives.
  const [commitsFile, setCommitsFile] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  // Set once the first listing of each kind has arrived, so a screen can say "loading" instead of showing a list that is not yet complete.
  const [refsLoaded, setRefsLoaded] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [detailsLoaded, setDetailsLoaded] = useState(false)
  const [historyNavigation, setHistoryNavigation] = useState<RepoCtx['historyNavigation']>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const busyRef = useRef(false)
  const [op, setOp] = useState<OpState | null>(null)
  const [historyScope, setHistoryScopeState] = useState<HistoryScopeKind>(() => loadHistoryScope(path))
  const [scopeTarget, setScopeTarget] = useState<string | null>(null)
  const scopeKind = useRef<HistoryScopeKind>(historyScope)
  const scopeRef = useRef<HistoryScope>({ kind: 'all' })
  const rangeRef = useRef<HistoryRange | null>(null)
  const [historyFile, setHistoryFileState] = useState<string | null>(null)
  const [branchOptions, setBranchOptionsState] = useState(() => loadBranchOptions(path))
  const branchOptionsRef = useRef(branchOptions)
  const [remoteHead, setRemoteHead] = useState<string | null>(null)
  const fileRef = useRef<string | null>(null)
  // A comparison and a file's history never combine; the comparison wins.
  const fileFor = (range: HistoryRange | null) => (range ? null : fileRef.current)
  useEffect(
    () =>
      window.bridge.onGitOutput((text) => setOp((o) => (o && !o.finished ? { ...o, output: (o.output + text).slice(-MAX_OUTPUT) } : o))),
    []
  )
  const limit = useRef(PAGE)
  const loadingRefs = useRef(false)
  const refsReadAt = useRef(0)
  const loadingDetails = useRef(false)
  const detailsAgain = useRef(false)
  const rawBranches = useRef<Branch[]>([])
  const detailsRef = useRef<Record<string, BranchDetail>>({})
  const historyRequest = useRef(0)
  const historyAnchor = useRef<string | undefined>(undefined)
  const loadingHistory = useRef(false)
  const commitsRef = useRef(commits)
  commitsRef.current = commits

  // Refreshes run often (focus, file watcher). Keep unchanged collection objects stable so
  // selections survive. Content previews invalidate separately from file-status labels.
  const lastJson = useRef<Record<string, string>>({})
  const changed = (key: string, value: unknown) => {
    const json = JSON.stringify(value)
    if (lastJson.current[key] === json) return false
    lastJson.current[key] = json
    return true
  }

  const refreshStatus = useCallback(async () => {
    try {
      const s = await api.status(path)
      if (changed('status', s)) setStatus(s)
      // Porcelain status describes which files changed, not their current contents.
      // Another partial patch (or an external edit) can leave that description identical.
      setContentRevision((revision) => revision + 1)
    } catch (e) {
      notify.error(errorMessage(e))
    }
  }, [path])

  useEffect(() => {
    prefetchRemoteHead(path)
  }, [path])

  /** Fills in ahead/behind, dates and subjects once the lists are up. A refresh that lands meanwhile queues one more pass. */
  const loadBranchDetails = useCallback(async () => {
    if (loadingDetails.current) {
      detailsAgain.current = true
      return
    }
    loadingDetails.current = true
    try {
      do {
        detailsAgain.current = false
        detailsRef.current = await api.branchDetails(path)
        const merged = withDetails(rawBranches.current, detailsRef.current)
        if (changed('branches', merged)) setBranches(merged)
        setDetailsLoaded(true)
      } while (detailsAgain.current)
    } catch (e) {
      notify.error(errorMessage(e))
    } finally {
      loadingDetails.current = false
    }
  }, [path])

  const refreshRefs = useCallback(
    async (force = false) => {
      if (loadingRefs.current && !force) return
      loadingRefs.current = true
      const requestedLimit = limit.current
      const range = rangeRef.current
      const file = fileFor(range)
      const anchor = range || file ? undefined : historyAnchor.current
      const kind = scopeKind.current
      let failed = false
      const fail = (e: unknown) => {
        if (failed) return
        failed = true
        notify.error(errorMessage(e))
      }
      try {
        // Each piece is shown the moment it arrives; none waits for the others unless it depends on them.
        const branchesRequest = api.branches(path)
        const remoteHeadRequest = branchesRequest.then(() => Promise.resolve(cachedRemoteHead(path)).catch(() => null))
        const branchesShown = branchesRequest.then(async (loaded) => {
          rawBranches.current = loaded
          const merged = withDetails(loaded, detailsRef.current)
          if (changed('branches', merged)) setBranches(merged)
          void refreshUnpushed(path)
          void loadBranchDetails()
          const head = await remoteHeadRequest
          if (changed('remoteHead', head)) setRemoteHead(head)
        })
        const stashesShown = api.stashes(path).then((s) => {
          if (changed('stashes', s)) setStashes(s)
        })
        const recentShown = api.recentBranches(path).then((recent) => {
          if (changed('recentBranches', recent)) setRecentBranches(recent)
        })
        const historyShown = (async () => {
          const needsBranches = logNeedsBranches(branchOptionsRef.current, range ? 'all' : kind)
          const scope = await (async (): Promise<HistoryScope> => {
            if (range) return { kind: 'range', ...range }
            if (kind === 'lineage') return { kind: 'head' }
            if (kind === 'head') {
              // Nothing to exclude on the default branch itself, so it shows its whole line.
              const base = await defaultCompareName(path, await branchesRequest, null)
              return base ? { kind: 'head', base } : { kind: 'head' }
            }
            if (kind !== 'target') return { kind }
            const target = await resolveCompareTarget(path, await branchesRequest, null)
            // Without a distinct target (for example while on main) the scope is just the current line.
            return target ? { kind: 'target', target: target.fullName } : { kind: 'head' }
          })()
          let hiddenRefs: string[] = []
          let keepRemotes: string[] | null = null
          if (needsBranches) {
            const loaded = await branchesRequest
            const options = branchOptionsRef.current
            hiddenRefs = hiddenRefGlobs(loaded, options)
            keepRemotes = visibleRemoteRefs(loaded, options, await remoteHeadRequest)
          }
          const c = await api.log(path, requestedLimit, anchor, scope, file ?? undefined, hiddenRefs, keepRemotes)
          // Ordinary paging may finish after a click; keep it unless a larger navigation or a scope change has won.
          if (
            requestedLimit === limit.current &&
            kind === scopeKind.current &&
            range === rangeRef.current &&
            file === fileFor(rangeRef.current)
          ) {
            scopeRef.current = scope
            setScopeTarget(scope.kind === 'target' ? scope.target.replace(/^refs\/(heads|remotes)\//, '') : null)
            if (changed('commits', c)) setCommits(c)
            setCommitsFile(file)
            setHasMore(c.length >= requestedLimit)
            setHistoryLoaded(true)
          }
        })()
        await Promise.all(
          [Promise.all([branchesShown, stashesShown]).then(() => setRefsLoaded(true)), recentShown, historyShown].map((p) => p.catch(fail))
        )
      } finally {
        loadingRefs.current = false
        refsReadAt.current = Date.now()
      }
    },
    [path, loadBranchDetails]
  )

  const resetHistory = useCallback(() => {
    limit.current = PAGE
    historyRequest.current++
    historyAnchor.current = undefined
    loadingHistory.current = false
    setHistoryNavigation(null)
    void refreshRefs(true)
  }, [refreshRefs])

  const setHistoryScope = useCallback(
    (next: HistoryScopeKind) => {
      if (next === scopeKind.current) return
      scopeKind.current = next
      saveHistoryScope(path, next)
      setHistoryScopeState(next)
      if (!rangeRef.current) resetHistory()
    },
    [path, resetHistory]
  )

  const setHistoryRange = useCallback(
    (range: HistoryRange | null) => {
      const before = rangeRef.current
      if (before?.from === range?.from && before?.to === range?.to) return
      rangeRef.current = range
      // A comparison and a file's history never combine.
      if (range && fileRef.current) {
        fileRef.current = null
        setHistoryFileState(null)
      }
      resetHistory()
    },
    [resetHistory]
  )

  const cancelHistoryNavigation = useCallback(() => {
    historyRequest.current++
    loadingHistory.current = false
    setHistoryNavigation(null)
  }, [])

  const ensureCommit = useCallback(
    async (hash: string, reload = false) => {
      const request = ++historyRequest.current
      if (rangeRef.current || fileRef.current) return
      historyAnchor.current = hash
      if (!reload && commitsRef.current.some((c) => c.hash === hash)) {
        loadingHistory.current = false
        setHistoryNavigation(null)
        return
      }
      loadingHistory.current = true
      setHistoryNavigation({ hash })
      try {
        const result = await loadHistoryToCommit(api, path, hash, limit.current, () => request === historyRequest.current, scopeRef.current)
        if (!result || request !== historyRequest.current) return
        limit.current = result.limit
        commitsRef.current = result.commits
        if (changed('commits', result.commits)) setCommits(result.commits)
        setCommitsFile(null)
        setHasMore(result.commits.length >= result.limit)
        setHistoryNavigation(null)
      } catch (e) {
        if (request === historyRequest.current) setHistoryNavigation({ hash, error: errorMessage(e) })
      } finally {
        if (request === historyRequest.current) loadingHistory.current = false
      }
    },
    [path]
  )

  const setHistoryFile = useCallback(
    (file: string | null, keep?: string) => {
      if (file === fileRef.current) return
      fileRef.current = file
      setHistoryFileState(file)
      resetHistory()
      // The commit selected in the file's history may lie beyond the first page of the full list.
      if (!file && keep && !rangeRef.current) void ensureCommit(keep, true)
    },
    [resetHistory, ensureCommit]
  )

  const refresh = useCallback(async () => {
    await Promise.all([refreshStatus(), refreshRefs()])
  }, [refreshStatus, refreshRefs])

  useEffect(() => {
    const saved = loadHistoryScope(path)
    scopeKind.current = saved
    setHistoryScopeState(saved)
    fileRef.current = null
    setHistoryFileState(null)
    refresh()
    window.bridge.watch(path)
    // Operations in flight (such as the merge tool's temporary files) refresh once when they finish.
    const off = window.bridge.onRepoChanged((d) => {
      if (busyRef.current) return
      return d.git ? refresh() : refreshStatus()
    })
    // The watcher reports ref changes while Oak runs; focus re-reads refs only after a while, in case it missed one.
    const onFocus = () => {
      if (busyRef.current) return
      if (Date.now() - refsReadAt.current > FOCUS_REFRESH_AFTER_MS) refresh()
      else refreshStatus()
    }
    window.addEventListener('focus', onFocus)
    return () => {
      historyRequest.current++
      off()
      window.removeEventListener('focus', onFocus)
    }
  }, [path, refresh, refreshStatus])

  const withBusy = useCallback(
    async <T>(label: string, fn: () => Promise<T>, options?: BusyOptions<T>) => {
      const started = Date.now()
      busyRef.current = true
      setBusy(label)
      setOp({ label, started, output: '' })
      let ok = false
      let doneText: string | null = null
      try {
        const result = await fn()
        ok = true
        const done = options?.done
        doneText = typeof done === 'function' ? done(result) : (done ?? null)
        return result
      } finally {
        const finished = Date.now()
        busyRef.current = false
        setBusy(null)
        setOp((o) => (o && o.started === started ? { ...o, finished, ok } : o))
        notifyIfSlow(label, ok, finished - started)
        await refresh()
        if (ok && doneText) notify.success(doneText)
      }
    },
    [refresh]
  )

  const run = useCallback(
    async <T>(label: string, fn: () => Promise<T>, options?: BusyOptions<T>) => {
      try {
        return await withBusy(label, fn, options)
      } catch (e) {
        notify.error(errorMessage(e))
        return undefined
      }
    },
    [withBusy]
  )

  const loadMore = useCallback(() => {
    if (loadingRefs.current || loadingHistory.current) return
    limit.current += PAGE
    refreshRefs()
  }, [refreshRefs])

  const setBranchOptions = useCallback(
    (next: SidebarBranchOptions) => {
      const before = branchOptionsRef.current
      branchOptionsRef.current = next
      saveBranchOptions(path, next)
      setBranchOptionsState(next)
      const hiddenChanged =
        before.showHidden !== next.showHidden ||
        before.hideRemoteOnly !== next.hideRemoteOnly ||
        before.hiddenPatterns.join('\n') !== next.hiddenPatterns.join('\n')
      if (hiddenChanged) void refreshRefs(true)
    },
    [path, refreshRefs]
  )

  return {
    path,
    name: repoName(path),
    status,
    contentRevision,
    branches,
    recentBranches,
    stashes,
    commits,
    commitsFile,
    hasMore,
    refsLoaded,
    historyLoaded,
    detailsLoaded,
    historyScope,
    scopeTarget,
    setHistoryScope,
    setHistoryRange,
    historyFile,
    setHistoryFile,
    historyNavigation,
    ensureCommit,
    cancelHistoryNavigation,
    busy,
    op,
    refresh,
    refreshStatus,
    loadMore,
    branchOptions,
    remoteHead,
    setBranchOptions,
    withBusy,
    run
  }
}
