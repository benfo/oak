import { registerListCopy } from '../lib/listCopy'
import { copyText } from '../lib/copy'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, ProgressBar } from 'react-aria-components'
import { buildGraph } from './graph'
import { singleLane } from '../../../shared/fileLog'
import type { RepoCtx } from '../useRepo'
import { toast } from '../ui'
import { CommitList } from './CommitList'
import { CommitDetails } from './CommitDetails'
import type { BranchComparison } from './commitPreview'
import { showComparisonBranchPicker } from '../pickers'
import { openPalette } from '../components/Palette'
import { compareMenuItems, runCompareItem, type CompareBranch } from '../lib/branchMenu'
import { rememberCompareTarget, resolveCompareTarget } from '../lib/compareTarget'
import { Icon } from '../components/Icon'
import { Split } from '../components/Split'
import { api, showMenu } from '../api'
import { hiddenBranchRefs } from '../sidebar/sidebarBranches'
import * as act from '../actions'
import { focusPane, handleNavigation, handleToolNavigation } from '../lib/navigation'
import type { Branch, Commit, MenuItem } from '../../../shared/types'
import { useSettings, updateSettings } from '../settings'
import { useSearchMatches } from '../lib/useSearchMatches'
import { SearchFeedback } from '../components/SearchFeedback'
import { PaneSearch } from '../components/Pane'
import { Tip } from '../components/Tip'
import type { WorkspaceLayout } from '../components/LayoutMenu'
import type { CommitTarget } from '../blame/BlameView'
import { WORKING_HASH, hasWorkingChanges, workingFileCount } from '../../../shared/working.ts'

export interface ComparisonRequest {
  source: Branch
  target: Branch | null
  n: number
}

function graphDisplayItem(emphasize: boolean): MenuItem {
  return { id: 'emphasis', label: 'Emphasize current branch', checked: emphasize }
}

async function commitMenu(r: RepoCtx, c: Commit, onCompare: CompareBranch, onCompareCommit: (c: Commit) => void) {
  const cur = r.status?.branch ?? 'HEAD'
  const isHead = c.hash === r.status?.head
  const locals = c.refs.filter((x) => x.type === 'local' && !x.current)
  const hasLocal = (name: string) => r.branches.some((b) => b.type === 'local' && b.name === name)
  const remotes = c.refs.filter((x) => x.type === 'remote' && !hasLocal(x.name.slice(x.name.indexOf('/') + 1)))
  const checkouts: MenuItem[] = [
    ...locals.map((x) => ({ id: `co:${x.name}`, label: x.name })),
    ...remotes.map((x) => ({ id: `cor:${x.name}`, label: `${x.name} as local branch` }))
  ]
  const allTips = c.refs.flatMap((x) =>
    x.type === 'local' || x.type === 'remote' ? r.branches.filter((b) => b.type === x.type && b.name === x.name) : []
  )
  // A remote branch beside its same-named local one is the same line; offer only the local.
  const tips = allTips.filter(
    (t) => t.type === 'local' || !allTips.some((o) => o.type === 'local' && o.name === t.name.slice(t.name.indexOf('/') + 1))
  )
  const compares: MenuItem[] = []
  const compareItems = await Promise.all(tips.map((tip) => compareMenuItems(r, tip, tips.length > 1)))
  tips.forEach((tip, i) => {
    compares.push(...compareItems[i].map((item) => ({ ...item, id: `${tip.fullName}|${item.id}` })))
  })
  // Only commits that are a local branch tip get it, like the sidebar's branch menu.
  const prBranches = c.refs.filter((x) => x.type === 'local')
  const pullRequests: MenuItem[] = prBranches.map((x) => ({
    id: `pr:${x.name}`,
    label: prBranches.length > 1 ? `Open pull request for ${x.name}` : 'Open pull request'
  }))
  const items: MenuItem[] = [
    ...(checkouts.length > 1
      ? [{ label: 'Checkout branch', submenu: checkouts }]
      : checkouts.map((item) => ({ ...item, label: `Checkout ${item.label}` }))),
    { id: 'branch', label: 'New branch from here…' },
    { id: 'pick', label: `Cherry-pick onto ${cur}`, enabled: !isHead },
    { type: 'separator' },
    { label: 'Compare', submenu: [...compares, { id: 'compare-commit', label: 'Compare commit with…' }] },
    {
      label: 'Merge / Rebase',
      enabled: !isHead,
      submenu: [
        { id: 'merge', label: `Merge into ${cur}` },
        { id: 'rebase', label: `Rebase ${cur} onto this` }
      ]
    },
    {
      label: 'Undo',
      submenu: [
        { id: 'revert', label: 'Revert commit…' },
        { type: 'separator' },
        ...(isHead
          ? [{ label: 'Reset: already at this commit', enabled: false }]
          : [
              { id: 'reset:soft', label: 'Reset to here, keep changes staged' },
              { id: 'reset:mixed', label: 'Reset to here, keep changes unstaged' },
              { type: 'separator' as const },
              { id: 'reset:hard', label: 'Reset to here, discard changes…' }
            ])
      ]
    },
    {
      label: 'More',
      submenu: [{ id: 'detach', label: 'Checkout this commit (detached)' }, { id: 'tag', label: 'New tag from here…' }, ...pullRequests]
    },
    { type: 'separator' },
    {
      label: 'Copy',
      submenu: [
        { id: 'copy', label: 'Commit hash' },
        { id: 'copymsg', label: 'Commit message' }
      ]
    }
  ]
  const id = await showMenu(items)
  if (!id) return
  if (id === 'compare-commit') return onCompareCommit(c)
  const [tipRef, tipItem] = id.split('|')
  const tip = tipItem ? r.branches.find((b) => b.fullName === tipRef) : undefined
  if (tip && (await runCompareItem(tipItem, r, tip, onCompare))) return
  const label = c.refs.find((x) => x.type !== 'head')?.name ?? c.hash.slice(0, 8)
  if (id.startsWith('co:')) act.checkout(r, id.slice(3), 'local')
  else if (id.startsWith('cor:')) act.checkout(r, id.slice(4), 'remote')
  else if (id.startsWith('pr:')) act.openPullRequest(r, id.slice(3))
  else if (id === 'detach') act.checkout(r, c.hash, 'detached')
  else if (id === 'branch') act.newBranch(r, c.hash)
  else if (id === 'tag') act.createTag(r, c.hash)
  else if (id === 'merge') act.merge(r, c.hash, label)
  else if (id === 'rebase') act.rebase(r, c.hash, label)
  else if (id === 'pick') act.cherryPick(r, c)
  else if (id === 'revert') act.revert(r, c)
  else if (id.startsWith('reset:')) act.reset(r, c, id.slice(6) as 'soft' | 'mixed' | 'hard')
  else if (id === 'copy') copyText(c.hash, 'commit hash')
  else if (id === 'copymsg') copyText(c.subject, 'commit message')
}

const SCOPES = [
  { kind: 'all', label: () => 'All branches' },
  { kind: 'head', label: (detached: boolean) => (detached ? 'Current commit' : 'Current branch only') },
  { kind: 'lineage', label: (detached: boolean) => (detached ? 'Current commit + ancestry' : 'Current branch + full history') },
  { kind: 'target', label: (detached: boolean) => `${detached ? 'Current commit' : 'Current branch'} + target` }
] as const

/** Narrows the graph to the checked-out line; paused (with the reason shown) while a comparison owns the list. */
function HistoryScopeButton({ r, comparing }: { r: RepoCtx; comparing: boolean }) {
  const detached = !!r.status && !r.status.branch
  const current = SCOPES.find((s) => s.kind === r.historyScope)!
  const text = comparing
    ? 'Scope paused: comparing'
    : `${current.label(detached)}${r.historyScope === 'target' && r.scopeTarget ? ` (${r.scopeTarget})` : ''}`
  return (
    <button
      className="btn history-scope"
      disabled={comparing}
      aria-label={`History scope: ${text}`}
      aria-haspopup="menu"
      onClick={async (e) => {
        const anchor = e.currentTarget
        const id = await showMenu(
          SCOPES.map((s) => ({ id: s.kind, label: s.label(detached), checked: s.kind === r.historyScope })),
          anchor
        )
        const next = SCOPES.find((s) => s.kind === id)
        if (next) r.setHistoryScope(next.kind)
      }}
    >
      <span>{text}</span>
      <Icon name="chevronDown" size={12} />
    </button>
  )
}

/** Tells the graph is missing hidden branches, at the end of the toolbar so nothing moves when it appears. */
function HiddenBranchesToggle({ r }: { r: RepoCtx }) {
  const { showHidden } = r.branchOptions
  const count = hiddenBranchRefs(r.branches, r.status?.branch, r.branchOptions, r.remoteHead).size
  if (!count || r.historyScope !== 'all') return null
  return (
    <button
      className="link small"
      aria-pressed={showHidden}
      title={showHidden ? 'Hide these branches again' : 'Show hidden branches in the graph'}
      onClick={() => r.setBranchOptions({ ...r.branchOptions, showHidden: !showHidden })}
    >
      {showHidden ? `Showing ${count} hidden` : `${count} hidden`}
    </button>
  )
}

export function HistoryView({
  r,
  focus,
  comparisonRequest,
  layout,
  onSelectedChange,
  onCompareBranch,
  onOpenChanges,
  onBlame
}: {
  r: RepoCtx
  focus: { hash: string; n: number; target?: CommitTarget } | null
  comparisonRequest: ComparisonRequest | null
  layout: WorkspaceLayout
  onSelectedChange?: (c: Commit | null) => void
  onCompareBranch: CompareBranch
  onOpenChanges: () => void
  onBlame: (path: string, rev: string | null) => void
}) {
  const { emphasizeCurrentBranch } = useSettings()
  const graph = useMemo(() => {
    return buildGraph(r.commitsFile ? singleLane(r.commits) : r.commits, emphasizeCurrentBranch && r.status?.branch ? r.status.head : null)
  }, [r.commits, r.commitsFile, emphasizeCurrentBranch, r.status?.branch, r.status?.head])
  const hasEmphasis = graph.rows.some((row) => row.current)
  const showWorking = hasWorkingChanges(r.status) && !r.historyFile
  const [selected, setSelected] = useState<string | null>(null)
  /** Where Blame asked to land: a commit's file and line, used once for that commit. */
  const [jump, setJump] = useState<({ hash: string; n: number } & CommitTarget) | null>(null)
  const [compareBase, setCompareBase] = useState<string | null>(null)
  // `source` null means the checked-out branch; otherwise another branch compared without checking it out.
  const [pinned, setPinned] = useState<{
    fullName: string
    name: string
    source: { fullName: string; name: string } | null
    owner: string | null
    followHead: boolean
  } | null>(null)
  const [revealKey, setRevealKey] = useState(0)
  const [search, setSearch] = useState('')
  const [slowNavigation, setSlowNavigation] = useState<string | null>(null)
  const sourceBranch = pinned?.source ? r.branches.find((b) => b.fullName === pinned.source!.fullName) : undefined
  const activeHash = pinned?.followHead ? (pinned.source ? (sourceBranch?.hash ?? null) : (r.status?.head ?? selected)) : selected
  const liveHash = useRef(activeHash)
  // The filtered file's path in the viewed commit (it differs across renames).
  const historyPath =
    r.historyFile && !pinned && !compareBase ? (r.commits.find((c) => c.hash === activeHash)?.path ?? r.historyFile) : undefined
  const jumpHere = jump?.hash === activeHash ? jump : undefined
  liveHash.current = activeHash
  useEffect(
    () =>
      registerListCopy({
        element: () => document.querySelector<HTMLElement>('.commit-list'),
        primary: () => (liveHash.current && liveHash.current !== WORKING_HASH ? { text: liveHash.current, what: 'commit hash' } : null)
      }),
    []
  )
  const target = pinned ? r.branches.find((b) => b.fullName === pinned.fullName) : undefined
  const branchComparison = useMemo<BranchComparison | undefined>(
    () =>
      pinned
        ? {
            targetName: pinned.name,
            targetHash: target?.hash ?? null
          }
        : undefined,
    [pinned?.fullName, pinned?.name, target?.hash]
  )

  const endComparison = (focus = true) => {
    // Another branch's commits may not belong to the restored scope, so return to the checked-out commit.
    setSelected(pinned?.source ? (r.status?.head ?? null) : activeHash)
    setCompareBase(null)
    setPinned(null)
    if (focus) focusPane('.commit-list')
  }
  const pin = (targetBranch: Branch, source: Branch | null = null) => {
    const other = source && !source.current ? { fullName: source.fullName, name: source.name } : null
    setPinned({
      fullName: targetBranch.fullName,
      name: targetBranch.name,
      source: other,
      owner: other ? null : (r.status?.branch ?? null),
      followHead: true
    })
    rememberCompareTarget(r.path, targetBranch.name)
    setCompareBase(null)
    setSelected(source && other ? source.hash : (r.status?.head ?? null))
    setRevealKey((k) => k + 1)
    focusPane('.commit-list')
  }

  // Compares the chosen commit (the "before" side) with any other commit, branch tip or tag.
  const pickCommitTarget = (from: Commit) => {
    const compareTo = async (hash: string) => {
      if (!r.commits.some((x) => x.hash === hash)) await r.ensureCommit(hash)
      setPinned(null)
      setSelected(hash)
      setCompareBase(from.hash)
      setRevealKey((k) => k + 1)
      focusPane('.commit-list')
    }
    const refs = r.branches.filter((b) => b.hash !== from.hash)
    openPalette({
      placeholder: `Compare ${from.hash.slice(0, 8)} with…`,
      items: [
        ...r.commits
          .filter((x) => x.hash !== from.hash)
          .map((x) => ({
            id: `c:${x.hash}`,
            label: x.subject,
            group: 'Commits',
            detail: `${x.hash.slice(0, 8)} · ${x.author}`,
            run: () => void compareTo(x.hash)
          })),
        ...refs.map((b) => ({
          id: b.fullName,
          label: b.name,
          group: b.type === 'tag' ? 'Tags' : b.type === 'local' ? 'Local branches' : 'Remote branches',
          detail: `${b.hash.slice(0, 8)} · ${b.subject}`,
          run: () => void compareTo(b.hash)
        }))
      ]
    })
  }

  const startFileHistory = (file: string) => {
    r.setHistoryFile(file)
    focusPane('.commit-list')
  }
  const clearFileHistory = () => {
    r.setHistoryFile(null, selected && selected !== WORKING_HASH ? selected : undefined)
    focusPane('.commit-list')
  }
  // Starting a file's history (menus, palette) always replaces any comparison; this is the one place that happens.
  useEffect(() => {
    if (r.historyFile && pinned) endComparison(false)
  }, [r.historyFile])
  // Keep the selection inside the file's commits; the first one is the file's latest change.
  useEffect(() => {
    if (!r.historyFile || pinned) return
    if (!r.commits.length) {
      setSelected(null)
      setCompareBase(null)
      return
    }
    if (!selected || !r.commits.some((c) => c.hash === selected)) {
      setSelected(r.commits[0].hash)
      setCompareBase(null)
      setRevealKey((k) => k + 1)
    }
  }, [r.commits, r.historyFile])

  useEffect(() => {
    if (!comparisonRequest) return
    const { source, target: requested } = comparisonRequest
    void (async () => {
      const resolved = requested ?? (await resolveCompareTarget(r.path, r.branches, source))
      if (resolved) pin(resolved, source)
      else toast.info('No other branch to compare with.')
    })()
  }, [comparisonRequest])

  // While comparing, the graph lists just the commits the source adds to the target.
  useEffect(() => {
    r.setHistoryRange(pinned ? { from: pinned.fullName, to: pinned.source?.fullName ?? 'HEAD' } : null)
  }, [pinned?.fullName, pinned?.source?.fullName])
  useEffect(() => () => r.setHistoryRange(null), [])
  useEffect(() => {
    if (pinned?.followHead) setRevealKey((k) => k + 1)
  }, [r.commits])

  useEffect(() => {
    if (pinned?.source && !sourceBranch && r.branches.length) {
      endComparison()
      toast.info('Branch no longer exists; comparison ended.')
    }
  }, [r.branches, pinned?.source?.fullName])
  const select = (hash: string, reveal = true) => {
    setPinned((p) => (p ? { ...p, followHead: false } : p))
    setCompareBase(null)
    setSelected(hash)
    if (hash !== WORKING_HASH) void r.ensureCommit(hash)
    if (reveal) setRevealKey((k) => k + 1)
  }

  const toggle = (hash: string) => {
    // The working row is not a comparison endpoint (yet); Ctrl+click just selects it.
    if (hash === WORKING_HASH) return select(hash, false)
    if (pinned) return select(hash, false)
    if (compareBase) {
      if (hash === compareBase) setCompareBase(null)
      else if (hash === selected) {
        setSelected(compareBase)
        setCompareBase(null)
      } else setSelected(hash)
    } else if (selected && selected !== hash) {
      // Selection order defines direction, regardless of graph position or ancestry.
      setCompareBase(selected)
      setSelected(hash)
    } else select(hash, false)
  }

  // Default to HEAD once history arrives; preserve explicit selections across refreshes.
  useEffect(() => {
    if (compareBase && !r.commits.some((c) => c.hash === compareBase)) setCompareBase(null)
    // An explicitly selected commit remains valid even before its graph row is loaded.
    if (activeHash) return
    const head = r.commits.find((c) => c.refs.some((x) => x.current || x.type === 'head')) ?? r.commits[0]
    if (head) {
      setSelected(head.hash)
      setCompareBase(null)
      setRevealKey((k) => k + 1)
    } else setSelected(null)
  }, [r.commits])

  useEffect(() => {
    if (pinned && !pinned.source && r.status && pinned.owner !== r.status.branch) {
      setPinned(null)
      setSelected(r.status.head)
      setCompareBase(null)
      toast.info('Branch changed; comparison ended.')
    }
  }, [r.status?.branch, pinned?.owner])

  useEffect(() => {
    if (!focus) return
    if (focus.hash === WORKING_HASH && pinned) setPinned(null)
    // The requested commit may not touch the filtered file.
    if (r.historyFile) r.setHistoryFile(null, focus.hash === WORKING_HASH ? undefined : focus.hash)
    setJump(focus.target ? { hash: focus.hash, n: focus.n, ...focus.target } : null)
    select(focus.hash)
  }, [focus])

  // The working row vanishes once everything is committed or discarded; fall back to HEAD.
  useEffect(() => {
    if (selected === WORKING_HASH && !showWorking && !pinned) {
      setSelected(r.status?.head ?? null)
      setRevealKey((k) => k + 1)
    }
  }, [selected, showWorking, pinned])

  const navigation =
    r.historyNavigation && (r.historyNavigation.hash === activeHash || r.historyNavigation.hash === compareBase)
      ? r.historyNavigation
      : null
  const cancelNavigation = () => {
    r.cancelHistoryNavigation()
    focusPane('.commit-list')
  }
  useEffect(() => {
    setSlowNavigation(null)
    if (!navigation || navigation.error) return
    const timer = setTimeout(() => setSlowNavigation(navigation.hash), 300)
    return () => clearTimeout(timer)
  }, [navigation?.hash, navigation?.error])

  // The list lags the file filter while Git follows the file; show that instead of the previous list as if it were current.
  const fileLoading = !pinned && r.historyFile !== r.commitsFile
  // With no commits there is no list to hold focus, so the empty message takes it and Escape still backs out.
  const emptyList = r.commits.length === 0
  useEffect(() => {
    if (!emptyList || !(pinned || r.historyFile)) return
    const active = document.activeElement
    if (!active || active === document.body || active.closest('.history-top')) focusPane('.history-empty')
  }, [emptyList, !!pinned, r.historyFile])
  const [slowFile, setSlowFile] = useState(false)
  useEffect(() => {
    setSlowFile(false)
    if (!fileLoading) return
    const timer = setTimeout(() => setSlowFile(true), 300)
    return () => clearTimeout(timer)
  }, [fileLoading])

  useEffect(() => {
    onSelectedChange?.(compareBase || pinned ? null : (r.commits.find((c) => c.hash === activeHash) ?? null))
  }, [activeHash, compareBase, pinned, r.commits])

  const query = search.trim().toLowerCase()
  const matches = useMemo(
    () =>
      query
        ? r.commits.flatMap((c, index) =>
            c.subject.toLowerCase().includes(query) ||
            c.author.toLowerCase().includes(query) ||
            c.hash.startsWith(query) ||
            c.refs.some((x) => x.name.toLowerCase().includes(query))
              ? [index]
              : []
          )
        : [],
    [r.commits, query]
  )
  const current = r.commits.findIndex((c) => c.hash === activeHash)
  const searchMatches = useSearchMatches(search, matches, current)
  const find = (backwards: boolean) => {
    if (!query) return
    const index = searchMatches.next(backwards)
    if (index !== null) select(r.commits[index].hash)
  }

  return (
    <Split id="history" label="Commit graph height" dir="column" initial={380} min={120} max={2000} collapsed={layout === 'code'}>
      <div className="history-top">
        <div className="pane-toolbar" data-pane-owner="graph" onKeyDown={handleToolNavigation}>
          <div className="search">
            <Icon name="search" size={14} />
            <PaneSearch
              className="history-search"
              paneId="graph"
              aria-label="Find commits"
              aria-describedby="history-search-feedback"
              placeholder="Find commit by message, author, hash or ref (Enter / Shift+Enter)"
              value={search}
              spellCheck={false}
              onChange={(e) => setSearch(e.target.value)}
              onFind={find}
              onLeave={() => {
                focusPane('.commit-list')
              }}
            />
            <SearchFeedback
              id="history-search-feedback"
              query={search}
              count={matches.length}
              position={matches.indexOf(current)}
              boundary={searchMatches.boundary}
              loaded={r.hasMore}
            />
          </div>
          <HistoryScopeButton r={r} comparing={!!pinned} />
          <span className="muted small">
            {r.commits.length.toLocaleString()} commits{r.hasMore ? ' loaded' : ''}
          </span>
          <HiddenBranchesToggle r={r} />
        </div>
        {pinned && (
          <div className="comparison-banner" role="status" data-pane-owner="graph" onKeyDown={handleToolNavigation}>
            <span className="comparison-banner-text">
              Comparing <strong>{pinned.source?.name ?? r.status?.branch ?? 'HEAD'}</strong> against <strong>{pinned.name}</strong>
              <span className="muted"> · showing only commits {pinned.name} lacks</span>
            </span>
            <Tip label="Exit comparison" keys="Esc">
              <button className="btn" onClick={() => endComparison()}>
                <Icon name="x" size={12} />
                Exit comparison
              </button>
            </Tip>
          </div>
        )}
        {r.historyFile && !pinned && (
          <div className="comparison-banner" role="status" data-pane-owner="graph" onKeyDown={handleToolNavigation}>
            <span className="comparison-banner-text">
              History of <strong>{r.historyFile}</strong>
              <span className="muted">
                {' '}
                · following renames · {SCOPES.find((s) => s.kind === r.historyScope)!.label(!!r.status && !r.status.branch)}
              </span>
            </span>
            <Tip label="Show all commits" keys="Esc">
              <button className="btn" onClick={clearFileHistory}>
                <Icon name="x" size={12} />
                Show all commits
              </button>
            </Tip>
          </div>
        )}
        {r.commits.length === 0 ? (
          <div
            className="pane-empty history-empty"
            tabIndex={0}
            onKeyDown={(e) =>
              handleNavigation(e, { dismiss: pinned ? () => endComparison() : r.historyFile ? clearFileHistory : undefined })
            }
          >
            {pinned
              ? `Nothing on ${pinned.source?.name ?? r.status?.branch ?? 'HEAD'} that ${pinned.name} lacks`
              : r.historyFile
                ? 'No commits touch this file'
                : 'No commits yet'}
          </div>
        ) : (
          <CommitList
            commits={r.commits}
            loading={slowFile}
            graph={graph}
            emphasizeCurrentBranch={hasEmphasis}
            working={
              showWorking && !pinned
                ? { files: workingFileCount(r.status), onLabel: r.status?.branch ?? r.status?.head?.slice(0, 8) ?? 'HEAD' }
                : null
            }
            onDisplayMenu={async (e) => {
              e.preventDefault()
              if ((await showMenu([graphDisplayItem(emphasizeCurrentBranch)])) === 'emphasis')
                updateSettings({ emphasizeCurrentBranch: !emphasizeCurrentBranch })
            }}
            selected={activeHash}
            compareBase={compareBase}
            comparing={!!pinned || !!compareBase}
            onToggle={toggle}
            onClearComparison={() => endComparison()}
            onDismiss={r.historyFile ? clearFileHistory : undefined}
            revealKey={revealKey}
            onSelect={(h) => select(h, false)}
            onNearEnd={r.hasMore ? r.loadMore : undefined}
            onOpen={() => {
              focusPane('.details-files')
            }}
            onSearch={() => {
              focusPane('.history-search')
              document.querySelector<HTMLInputElement>('.history-search')?.select()
            }}
            onContextMenu={(c, e) => {
              e.preventDefault()
              // A context click targets one commit, never adds a comparison endpoint.
              // Keep an explicitly selected pair intact when opening either endpoint's menu.
              if (c.hash !== activeHash && c.hash !== compareBase) select(c.hash, false)
              commitMenu(r, c, onCompareBranch, pickCommitTarget)
            }}
          />
        )}
        {slowFile && !navigation && (
          <div className="history-navigation-status" role="status">
            <ProgressBar className="commit-loading-progress" isIndeterminate aria-label="Loading file history">
              <span className="spinner" aria-hidden="true" />
              {r.historyFile ? 'Loading file history…' : 'Loading history…'}
            </ProgressBar>
          </div>
        )}
        {navigation && (navigation.error || slowNavigation === navigation.hash) && (
          <div className="history-navigation-status" role={navigation.error ? 'alert' : 'status'}>
            {navigation.error ? (
              <>
                <span>Could not reveal the selected commit: {navigation.error}</span>
                <Button className="btn" onPress={() => void r.ensureCommit(navigation.hash)}>
                  Retry
                </Button>
                <Button className="btn" onPress={cancelNavigation}>
                  Dismiss
                </Button>
              </>
            ) : (
              <>
                <ProgressBar className="commit-loading-progress" isIndeterminate aria-label="Loading history to selected commit">
                  <span className="spinner" aria-hidden="true" />
                  Loading history to selected commit…
                </ProgressBar>
                <Button className="btn" onPress={cancelNavigation}>
                  Cancel
                </Button>
              </>
            )}
          </div>
        )}
      </div>
      <CommitDetails
        repo={r.path}
        hash={activeHash}
        compareBase={compareBase ?? undefined}
        branchComparison={branchComparison}
        focusCode={layout === 'code'}
        contentRevision={r.contentRevision}
        onOpenChanges={onOpenChanges}
        onFileHistory={startFileHistory}
        onBlame={onBlame}
        filePath={jumpHere?.file ?? historyPath}
        jump={jumpHere}
        comparisonSource={`${pinned?.followHead ? `${pinned.source?.name ?? r.status?.branch ?? 'HEAD'} ` : ''}${activeHash?.slice(0, 8) ?? ''}`}
        onPickTarget={(anchor) => showComparisonBranchPicker(r, anchor, sourceBranch ?? null, (t) => pin(t, sourceBranch ?? null))}
        commits={r.commits}
        onSwap={() => {
          setSelected(compareBase)
          setCompareBase(selected)
        }}
        onClearComparison={() => endComparison()}
        onSelectCommit={(h) => select(h)}
      />
    </Split>
  )
}
