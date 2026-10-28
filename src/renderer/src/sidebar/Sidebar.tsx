import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Button, Tree, TreeItem, TreeItemContent, Virtualizer, type Key } from 'react-aria-components'
import type { RepoCtx } from '../useRepo'
import type { Branch, Stash } from '../../../shared/types'
import { changedFileCount } from '../lib/changeCount'
import type { View } from '../components/RepoView'
import { Icon, type IconName } from '../components/Icon'
import { Tip } from '../components/Tip'
import { showMenu } from '../api'
import * as act from '../actions'
import { showTagPicker, tagsNewestFirst } from '../pickers'
import { showBranchMenu, type CompareBranch } from '../lib/branchMenu'
import { showTagMenu } from '../lib/tagMenu'
import { handleDismissNavigation, handleNavigation } from '../lib/navigation'
import { usePane } from '../lib/usePane'
import { registerListCopy, type CopyItem } from '../lib/listCopy'
import { PaneFrame, PaneSearch } from '../components/Pane'
import { useSearchMatches } from '../lib/useSearchMatches'
import { SearchFeedback } from '../components/SearchFeedback'
import { hiddenBranchRefs, sidebarBranches } from './sidebarBranches'
import { openPreferences } from '../components/Preferences'

async function stashMenu(r: RepoCtx, s: Stash) {
  const id = await showMenu([
    { id: 'apply', label: 'Apply' },
    { id: 'pop', label: 'Pop (apply and drop)' },
    { type: 'separator' },
    { id: 'drop', label: 'Drop…' }
  ])
  if (id === 'apply') act.stashApply(r, s.ref)
  else if (id === 'pop') act.stashPop(r, s.ref)
  else if (id === 'drop') act.stashDrop(r, s.ref, s.message)
}

// ---------- tree model ----------

/** One row of the sidebar tree. Sections have children; leaves are views, refs or stashes. */
interface TreeNode {
  key: string
  kind: 'nav' | 'section' | 'item'
  label: string
  icon?: IconName
  title?: string
  count?: number
  navActive?: boolean
  current?: boolean
  badges?: { text: string; warn?: boolean }[]
  /** Enter / click. */
  activate?: () => void
  /** Double-click, e.g. checkout. */
  secondary?: () => void
  menu?: (anchor?: Element) => void
  /** A small close button at the row's end, for rows that stand for something that can be closed. */
  close?: { label: string; run: () => void }
  /** Ctrl+C copies `primary` (name); Ctrl+Shift+C the `alternate` (commit hash). */
  copy?: { primary: CopyItem; alternate?: CopyItem }
  optionsLabel?: string
  countLabel?: string
  children?: TreeNode[]
}

/** Name first, commit hash as the alternate. */
const branchCopy = (b: Branch, what: string): TreeNode['copy'] => ({
  primary: { text: b.name, what },
  alternate: { text: b.hash, what: 'commit hash' }
})

/** Matches --row-md (tokens.css). */
const ROW_H = 28
const INDENT_STEP = 20
/** Tags listed in the sidebar; "Show all N tags…" opens the picker for the rest. */
const TAG_LIMIT = 100
const RECENT_LIMIT = 5
const DEFAULT_OPEN: Record<string, boolean> = { local: true, remotes: true, tags: false, stashes: false }

function useOpenSections() {
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    try {
      return { ...DEFAULT_OPEN, ...JSON.parse(localStorage.getItem('sidebarOpen') ?? '{}') }
    } catch {
      return DEFAULT_OPEN
    }
  })
  const save = (next: Record<string, boolean>) => {
    localStorage.setItem('sidebarOpen', JSON.stringify(next))
    setOpen(next)
  }
  return { isOpen: (key: string) => open[key] ?? true, open, save }
}

interface Props {
  r: RepoCtx
  view: View
  setView: (v: View) => void
  onFocusCommit: (hash: string) => void
  onCompareBranch: CompareBranch
  /** The file in the open Blame view, or null while none is open; the nav row shows only then. */
  blameFile: string | null
  /** Closes the open Blame view without leaving the view that is showing. */
  onCloseBlame: () => void
  /** Control shown at the end of the header row, e.g. the button that hides the sidebar. */
  headerAction?: ReactNode
}

/**
 * Views, branches, remotes, tags and stashes as one React Aria Tree: arrow keys move and
 * expand/collapse, Enter or click activates, double-click checks out, Shift+F10 / right-click
 * opens the item's menu, and typing a letter starts filtering.
 */
export function Sidebar({ r, view, setView, onFocusCommit, onCompareBranch, blameFile, onCloseBlame, headerAction }: Props) {
  const [filter, setFilter] = useState('')
  const branchOptions = r.branchOptions
  const branchOptionsRef = useRef(branchOptions)
  branchOptionsRef.current = branchOptions
  const saveBranchOptions = r.setBranchOptions
  const hidePattern = (pattern: string) => {
    const options = branchOptionsRef.current
    const patterns = options.hiddenPatterns
    if (!patterns.includes(pattern)) saveBranchOptions({ ...options, hiddenPatterns: [...patterns, pattern], showHidden: false })
  }
  const branchMenu = async (anchor?: Element) => {
    const options = branchOptionsRef.current
    const hidden = hiddenBranchRefs(live.current.r.branches, live.current.r.status?.branch, options, live.current.r.remoteHead).size
    const id = await showMenu(
      [
        { id: 'name', label: 'Sort by name', checked: options.sort === 'name' },
        { id: 'latest', label: 'Sort by latest commit', checked: options.sort === 'latest' },
        { type: 'separator' },
        { id: 'hide-gone', label: 'Hide branches with a gone upstream', checked: options.hideGone },
        { id: 'hide-remote-only', label: 'Hide remote branches without a local copy', checked: options.hideRemoteOnly },
        { id: 'hidden-branches', label: hidden ? `More branch options… (${hidden} hidden)` : 'More branch options…' },
        ...(options.hiddenPatterns.length || options.hideRemoteOnly
          ? [{ id: 'show-hidden', label: 'Show hidden branches', checked: options.showHidden }]
          : [])
      ],
      anchor
    )
    if (!id) return
    if (id === 'hidden-branches') return openPreferences('repository')
    saveBranchOptions(
      id === 'hide-gone'
        ? { ...options, hideGone: !options.hideGone }
        : id === 'hide-remote-only'
          ? { ...options, hideRemoteOnly: !options.hideRemoteOnly, showHidden: false }
          : id === 'show-hidden'
            ? { ...options, showHidden: !options.showHidden }
            : { ...options, sort: id === 'latest' ? 'latest' : 'name' }
    )
  }
  const sections = useOpenSections()
  const filterRef = useRef<HTMLInputElement>(null)
  const [searchMatch, setSearchMatch] = useState<string | null>(null)
  const [searchFocused, setSearchFocused] = useState(false)
  const treeRef = useRef<HTMLDivElement>(null)
  const visited = useRef(false)

  const st = r.status
  const changeCount = changedFileCount(st)

  // Rows are built once and reused (see renderNode), so their actions read the latest props here.
  const live = useRef({
    r,
    onFocusCommit,
    onCompareBranch,
    setView,
    onCloseBlame,
    branchMenu,
    hidePattern,
    toggle: (_key: string) => {},
    setExpanded: (_keys: Set<Key>) => {}
  })
  live.current.r = r
  live.current.onFocusCommit = onFocusCommit
  live.current.onCompareBranch = onCompareBranch
  live.current.setView = setView
  live.current.onCloseBlame = onCloseBlame
  live.current.branchMenu = branchMenu
  live.current.hidePattern = hidePattern

  // Refs only change on fetch/commit/checkout etc., not on every status refresh, so this list (and
  // with it every row) stays the same object most of the time.
  const refSections = useMemo((): TreeNode[] => {
    const f = filter.toLowerCase()
    const match = (s: string) => !f || s.toLowerCase().includes(f)
    const section = (key: string, label: string, children: TreeNode[], icon?: IconName, count?: number): TreeNode => ({
      key,
      kind: 'section',
      label,
      icon,
      count: count ?? children.reduce((n, c) => n + (c.kind === 'item' ? 1 : (c.children?.length ?? 0)), 0),
      children
    })

    const locals = r.branches.filter((b) => b.type === 'local')
    const hiddenRefs = hiddenBranchRefs(r.branches, st?.branch, branchOptions, r.remoteHead)
    const visible = sidebarBranches(r.branches, st?.branch, branchOptions, r.remoteHead)
    const localNode = (b: Branch, key = b.fullName): TreeNode => ({
      key,
      kind: 'item',
      label: b.name,
      icon: 'branch',
      title: b.subject,
      current: b.name === st?.branch,
      badges: [
        ...(b.gone ? [{ text: 'gone', warn: true }] : []),
        ...(b.ahead ? [{ text: `↑${b.ahead}` }] : []),
        ...(b.behind ? [{ text: `↓${b.behind}` }] : [])
      ],
      activate: () => live.current.onFocusCommit(b.hash),
      secondary: () => b.name !== live.current.r.status?.branch && act.checkout(live.current.r, b.name, 'local'),
      copy: branchCopy(b, 'branch name'),
      menu: () => showBranchMenu(live.current.r, b, live.current.onCompareBranch, live.current.hidePattern)
    })
    const local = visible.filter((b) => b.type === 'local' && match(b.name)).map((b) => localNode(b))
    const total = locals.filter((b) => match(b.name)).length
    const hidden = total - local.length
    const remoteMatches = (list: Branch[]) => list.filter((b) => b.type === 'remote' && match(b.name)).length
    const hiddenAll = hidden + remoteMatches(r.branches) - remoteMatches(visible)
    const currentBranch = locals.find((b) => b.name === st?.branch)
    const current: TreeNode[] = currentBranch
      ? [localNode(currentBranch, 'quick:current')]
      : st
        ? [
            {
              key: 'quick:current',
              kind: 'item',
              current: true,
              label: st.branch ?? (st.head ? `Detached HEAD · ${st.head.slice(0, 8)}` : 'No commits yet'),
              title: st.head ? 'Current checkout: Enter to view commit' : 'No commits yet: Enter to view changes',
              activate: () => {
                const status = live.current.r.status
                if (status?.head) live.current.onFocusCommit(status.head)
                else live.current.setView('changes')
              }
            }
          ]
        : []
    const byName = new Map(locals.map((b) => [b.name, b]))
    const recent = r.recentBranches
      .flatMap((name) => {
        const b = byName.get(name)
        return b &&
          b.name !== st?.branch &&
          (!branchOptions.hideGone || !b.gone) &&
          (branchOptions.showHidden || !hiddenRefs.has(b.fullName))
          ? [b]
          : []
      })
      .slice(0, RECENT_LIMIT)
      .filter((b) => match(b.name))
      .map((b) => ({
        ...localNode(b, `recent:${b.fullName}`),
        title: `${b.subject}: Enter to view, double-click to check out`
      }))
    const quick: TreeNode[] = []
    const matchingCurrent = current.filter((n) => match(n.label))
    if (matchingCurrent.length)
      quick.push({ ...section('current', st?.branch ? 'Current branch' : 'Current checkout', matchingCurrent), count: undefined })
    if (recent.length) quick.push(section('recent', 'Recently used', recent))

    const groups = new Map<string, Branch[]>()
    for (const b of visible) {
      if (b.type !== 'remote' || !match(b.name)) continue
      const remote = b.name.split('/')[0]
      groups.set(remote, [...(groups.get(remote) ?? []), b])
    }
    const remotes = [...groups]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([remote, list]) =>
        section(
          `remote:${remote}`,
          remote,
          list.map((b): TreeNode => ({
            key: b.fullName,
            kind: 'item',
            label: b.name.slice(remote.length + 1),
            icon: 'branch',
            title: b.subject,
            activate: () => live.current.onFocusCommit(b.hash),
            secondary: () => act.checkout(live.current.r, b.name, 'remote'),
            copy: branchCopy(b, 'branch name'),
            menu: () => showBranchMenu(live.current.r, b, live.current.onCompareBranch, live.current.hidePattern)
          })),
          'globe'
        )
      )

    // Repos can have thousands of tags, and React Aria's tree gets slower with every row (expanding,
    // even moving the cursor), so the sidebar lists the newest few; the rest are in the tag picker.
    const allTags = tagsNewestFirst(r.branches).filter((b) => match(b.name))
    const tags = allTags.slice(0, TAG_LIMIT).map((b): TreeNode => ({
      key: b.fullName,
      kind: 'item',
      label: b.name,
      icon: 'tag',
      title: b.subject,
      activate: () => live.current.onFocusCommit(b.hash),
      copy: branchCopy(b, 'tag name'),
      menu: () => showTagMenu(live.current.r, b)
    }))
    if (allTags.length > TAG_LIMIT)
      tags.push({
        key: 'tags:all',
        kind: 'item',
        label: `Show all ${allTags.length.toLocaleString()} ${f ? 'matching ' : ''}tags…`,
        icon: 'search',
        activate: () => showTagPicker(live.current.r, live.current.onFocusCommit, filter)
      })

    const stashes = r.stashes
      .filter((s) => match(s.message))
      .map((s): TreeNode => ({
        key: s.ref,
        kind: 'item',
        label: s.message,
        icon: 'stash',
        title: `${s.ref}: Enter for actions, double-click to apply`,
        activate: () => stashMenu(live.current.r, s),
        secondary: () => act.stashApply(live.current.r, s.ref),
        menu: () => stashMenu(live.current.r, s)
      }))

    const branches: TreeNode = {
      ...section('local', 'Branches', local),
      countLabel: hidden ? `${local.length} / ${total}` : undefined,
      title: hiddenAll
        ? `${hiddenAll} ${hiddenAll === 1 ? 'branch hidden' : 'branches hidden'}. Use Branch options to show them.`
        : undefined,
      optionsLabel: hiddenAll ? `Branch options (${hiddenAll} hidden)` : 'Branch options',
      menu: (anchor) => {
        void live.current.branchMenu(anchor)
      }
    }
    return [
      ...quick,
      branches,
      section('remotes', 'Remotes', remotes),
      section('tags', 'Tags', tags, undefined, allTags.length),
      section('stashes', 'Stashes', stashes)
    ]
  }, [r.branches, r.stashes, r.recentBranches, r.remoteHead, st?.branch, st?.head, filter, branchOptions])

  const navNodes: TreeNode[] = [
    {
      key: 'nav:changes',
      kind: 'nav',
      label: 'Changes',
      icon: 'changes',
      count: changeCount,
      navActive: view === 'changes',
      activate: () => live.current.setView('changes')
    },
    {
      key: 'nav:history',
      kind: 'nav',
      label: 'History',
      icon: 'history',
      navActive: view === 'history',
      activate: () => live.current.setView('history')
    },
    ...(blameFile
      ? [
          {
            key: 'nav:blame',
            kind: 'nav' as const,
            label: 'Blame',
            icon: 'blame' as const,
            title: blameFile,
            navActive: view === 'blame',
            activate: () => live.current.setView('blame'),
            close: { label: 'Close blame', run: () => live.current.onCloseBlame() },
            // The same action from the keyboard (Shift+F10 or the Menu key on the row).
            menu: async (anchor?: Element) => {
              if ((await showMenu([{ id: 'close', label: 'Close blame' }], anchor)) === 'close') live.current.onCloseBlame()
            }
          }
        ]
      : [])
  ]

  const { refsByKey, parentKeys } = useMemo(() => {
    const map = new Map<string, TreeNode>()
    const parents = new Map<string, string>()
    const walk = (list: TreeNode[], parent?: string) =>
      list.forEach((n) => {
        map.set(n.key, n)
        if (parent) parents.set(n.key, parent)
        if (n.children) walk(n.children, n.key)
      })
    walk(refSections)
    return { refsByKey: map, parentKeys: parents }
  }, [refSections])
  const byKey = { get: (key: string) => navNodes.find((n) => n.key === key) ?? refsByKey.get(key) }

  // While filtering, every section is expanded so all matches are visible.
  const sectionKeys = useMemo(() => [...refsByKey.values()].filter((n) => n.kind === 'section').map((n) => n.key), [refsByKey])
  const expandedKeys = new Set(filter ? sectionKeys : sectionKeys.filter(sections.isOpen))
  const setExpanded = (keys: Set<Key>) => {
    if (filter) return
    sections.save({ ...sections.open, ...Object.fromEntries(sectionKeys.map((k) => [k, keys.has(k)])) })
  }
  const toggle = (key: string) => {
    const next = new Set<Key>(expandedKeys)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setExpanded(next)
  }
  live.current.toggle = toggle

  const focusedNode = () => {
    const key = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('[role=row]')?.dataset.key
    return key ? byKey.get(key) : undefined
  }

  const pane = usePane('sidebar', { virtualized: true })
  const focusedNodeRef = useRef(focusedNode)
  focusedNodeRef.current = focusedNode
  useEffect(
    () =>
      registerListCopy({
        element: () => treeRef.current,
        primary: () => focusedNodeRef.current()?.copy?.primary ?? null,
        alternate: () => focusedNodeRef.current()?.copy?.alternate ?? null
      }),
    []
  )
  /** Our additions to the tree's keys, run before React Aria's own handling. */
  const onKeyDownCapture = (e: React.KeyboardEvent) => {
    if (
      pane.navigate(e, () => {
        filterRef.current?.focus()
        filterRef.current?.select()
      })
    )
      return
    if (handleDismissNavigation(e, [filter ? () => setFilter('') : undefined])) return
    if (handleNavigation(e, { menu: focusedNode()?.menu })) return
    if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      // → / ← open and close sections here: their rows aren't in React Aria's collection while
      // collapsed, so it doesn't know they can expand. Enter expanded sections explicitly as well.
      const n = focusedNode()
      // Tree convention: ← on a leaf, or on a collapsed section, moves to its parent row first.
      const parent = n && e.key === 'ArrowLeft' && (n.kind !== 'section' || !expandedKeys.has(n.key)) ? parentKeys.get(n.key) : undefined
      if (parent) {
        const row = treeRef.current?.querySelector<HTMLElement>(`[role=row][data-key="${CSS.escape(parent)}"]`)
        if (row) {
          e.preventDefault()
          e.stopPropagation()
          row.focus()
        }
        return
      }
      if (n?.kind !== 'section') return
      if (expandedKeys.has(n.key) && e.key === 'ArrowRight') {
        const child = n.children?.[0]
        const row = child ? treeRef.current?.querySelector<HTMLElement>(`[role=row][data-key="${CSS.escape(child.key)}"]`) : null
        if (row) {
          e.preventDefault()
          e.stopPropagation()
          row.focus()
        }
        return
      }
      if (!expandedKeys.has(n.key) && e.key === 'ArrowLeft') return
      e.preventDefault()
      e.stopPropagation()
      toggle(n.key)
    }
  }

  // One indentation step (chevron + gap) per nesting level; added on top of the row's base padding.
  const indent = (level: number) => (level - 1) * INDENT_STEP

  /**
   * Building rows into React Aria's collection is the expensive part with thousands of refs, so:
   * collapsed sections get no child rows at all (hasChildItems keeps their chevron), and each ref
   * row's element is built once per node and reused, which lets React skip it on every re-render.
   */
  const rowCache = useRef(new WeakMap<TreeNode, React.ReactElement>())
  // Expanding a section with thousands of rows takes a moment (React Aria builds its collection
  // synchronously), so the chevron follows our state at once and the rows follow a frame later,
  // once the chevron has painted. Collapsing is cheap but goes the same way.
  const expandedId = [...expandedKeys].join('\n')
  const [rowsId, setRowsId] = useState(expandedId)
  useEffect(() => {
    if (rowsId === expandedId) return
    let timer = 0
    const frame = requestAnimationFrame(() => (timer = window.setTimeout(() => setRowsId(expandedId))))
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(timer)
    }
  }, [expandedId])
  const rowsShownFor = new Set(rowsId.split('\n'))
  const renderNode = (n: TreeNode): React.ReactElement => {
    if (n.kind === 'item') {
      let row = rowCache.current.get(n)
      if (!row) rowCache.current.set(n, (row = buildRow(n)))
      return row
    }
    return buildRow(n, n.kind === 'section' && rowsShownFor.has(n.key) ? n.children?.map(renderNode) : undefined)
  }

  const buildRow = (n: TreeNode, children?: React.ReactElement[]): React.ReactElement => (
    <TreeItem
      key={n.key}
      id={n.key}
      textValue={n.label}
      className={({ level }) => `tree-row ${n.kind} level-${level} ${n.navActive ? 'nav-active' : ''} ${n.current ? 'current' : ''}`}
      hasChildItems={n.kind === 'section'}
      onAction={() => (n.kind === 'section' ? live.current.toggle(n.key) : n.activate?.())}
      onDoubleClick={() => n.secondary?.()}
      onContextMenu={(e) => {
        e.preventDefault()
        n.menu?.()
      }}
    >
      <TreeItemContent>
        {({ level }) => (
          <SearchableRow nodeKey={n.key} className="tree-row-content" style={{ '--indent': `${indent(level)}px` } as React.CSSProperties}>
            {n.kind === 'section' && <Chevron id={n.key} />}
            {n.current ? <span className="current-dot" /> : n.icon && <Icon name={n.icon} size={n.kind === 'nav' ? 16 : 14} />}
            <Tip label={n.title} focusable={false}>
              <span className="tree-label">{n.label}</span>
            </Tip>
            {n.badges?.map((b) => (
              <span key={b.text} className={`pill ${b.warn ? 'warn' : ''}`}>
                {b.text}
              </span>
            ))}
            {n.kind === 'nav' && !!n.count && <span className="badge">{n.count}</span>}
            {n.close && (
              <Button
                className="icon-btn tree-close"
                excludeFromTabOrder
                aria-label={n.close.label}
                onPress={(e) => {
                  // The row keeps the tree's single tab stop, as the branch options button does.
                  visited.current = true
                  e.target.closest<HTMLElement>('[role=row]')?.focus()
                  n.close?.run()
                }}
              >
                <Icon name="x" size={14} />
              </Button>
            )}
            {n.optionsLabel && (
              <Button
                className="icon-btn branch-options"
                excludeFromTabOrder
                aria-label={n.optionsLabel}
                aria-haspopup="menu"
                onPress={(e) => {
                  // Keep the tree's single tab stop and restore this heading after the menu closes.
                  visited.current = true
                  e.target.closest<HTMLElement>('[role=row]')?.focus()
                  n.menu?.(e.target)
                }}
              >
                <Icon name="more" size={14} />
              </Button>
            )}
            {n.kind === 'section' && n.count !== undefined && <span className="section-count">{n.countLabel ?? n.count}</span>}
          </SearchableRow>
        )}
      </TreeItemContent>
      {children}
    </TreeItem>
  )

  // The tree only re-renders when its rows change; flipping a chevron (OpenSections) doesn't touch it,
  // which matters because React Aria walks every row of a big expanded section on each render.
  live.current.setExpanded = setExpanded
  const tree = useMemo(
    () => (
      <Virtualizer layout={pane.layout!} layoutOptions={{ rowHeight: ROW_H }}>
        <Tree
          ref={treeRef}
          aria-label="Repository navigation"
          className="tree"
          {...pane.targetProps}
          selectionMode="none"
          expandedKeys={rowsShownFor}
          onExpandedChange={(keys) => live.current.setExpanded(keys)}
        >
          {[...navNodes, ...refSections].map(renderNode)}
        </Tree>
      </Virtualizer>
    ),
    [rowsId, refSections, view, changeCount, blameFile, pane.targetProps]
  )

  const matches = useMemo(() => [...refsByKey.values()].filter((n) => n.kind === 'item'), [refsByKey])
  const matchIndex = matches.findIndex((n) => n.key === searchMatch)
  const matchPositions = useMemo(() => matches.map((_, index) => index), [matches])
  const searchMatches = useSearchMatches(filter, matchPositions, matchIndex)
  const revealMatch = (key: string) => {
    const tree = treeRef.current
    if (!tree) return
    const visible: TreeNode[] = []
    const walk = (nodes: TreeNode[]) =>
      nodes.forEach((n) => {
        visible.push(n)
        if (n.children && expandedKeys.has(n.key)) walk(n.children)
      })
    walk(refSections)
    const index = visible.findIndex((n) => n.key === key)
    const row = tree.querySelector<HTMLElement>(`[role=row][data-key="${CSS.escape(key)}"]`)
    if (row) row.scrollIntoView({ block: 'nearest' })
    else if (index >= 0) tree.scrollTop = (index + navNodes.length) * ROW_H
  }
  const findBranch = (backwards: boolean) => {
    if (!filter.trim() || !matches.length) return
    const next = searchMatches.next(backwards)
    if (next === null) return
    setSearchMatch(matches[next].key)
    revealMatch(matches[next].key)
  }
  const leaveSearch = () => {
    const row = searchMatch ? treeRef.current?.querySelector<HTMLElement>(`[role=row][data-key="${CSS.escape(searchMatch)}"]`) : null
    if (row) {
      visited.current = true
      row.focus()
    } else treeRef.current?.focus()
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <div className="sidebar-filter">
          <Icon name="search" size={14} />
          <PaneSearch
            ref={filterRef}
            paneId="sidebar"
            placeholder="Filter branches…  (Ctrl+L)"
            aria-label="Filter branches"
            aria-describedby="branch-search-feedback"
            value={filter}
            spellCheck={false}
            onChange={(e) => {
              setFilter(e.target.value)
              setSearchMatch(null)
            }}
            onFocus={(e) => {
              setSearchFocused(true)
              const key = (e.relatedTarget as HTMLElement | null)?.closest<HTMLElement>('[role=row]')?.dataset.key
              if (key && matches.some((n) => n.key === key)) setSearchMatch(key)
            }}
            onBlur={() => setSearchFocused(false)}
            onFind={findBranch}
            onLeave={leaveSearch}
          />
          <SearchFeedback
            id="branch-search-feedback"
            query={filter}
            count={matches.length}
            position={matchIndex}
            boundary={searchMatches.boundary}
            label={searchFocused && matchIndex >= 0 ? matches[matchIndex].label : undefined}
          />
          {filter && (
            <Tip label="Clear filter">
              <button
                className="icon-btn"
                tabIndex={-1}
                onClick={() => {
                  setFilter('')
                  setSearchMatch(null)
                }}
              >
                <Icon name="x" size={12} />
              </button>
            </Tip>
          )}
        </div>
        {headerAction}
      </div>
      <PaneFrame
        className="tree-wrap"
        {...pane.resetProps}
        onKeyDownCapture={onKeyDownCapture}
        onFocus={(e) => {
          // A recent row disappears when it becomes current. React Aria may restore focus to
          // A recent row disappears when it becomes current. React Aria may restore focus to when it becomes current. React Aria may restore focus to          // the tree after rebuilding its collection; recover the current row cursor then.
          if (e.target === treeRef.current)
            requestAnimationFrame(() => {
              if (document.activeElement === treeRef.current)
                treeRef.current?.querySelector<HTMLElement>('[data-key="quick:current"]')?.focus()
            })
          // First time focus enters the tree, land on the current branch rather than wherever React Aria
          // would pick (the last row when tabbing backwards). Afterwards it remembers the last row.
          if (visited.current || e.currentTarget.contains(e.relatedTarget as Node | null)) return
          visited.current = true
          treeRef.current?.querySelector<HTMLElement>('.tree-row.current')?.focus()
        }}
      >
        <OpenSections.Provider value={expandedKeys}>
          <SearchMatch.Provider value={searchFocused ? searchMatch : null}>{tree}</SearchMatch.Provider>
        </OpenSections.Provider>
      </PaneFrame>
    </aside>
  )
}

/** Which sections are open right now; chevrons read it so flipping one doesn't re-render the tree. */
const OpenSections = createContext<Set<Key>>(new Set())

/** Only visible row contents consume the match, so finding never rebuilds RAC's tree collection. */
const SearchMatch = createContext<string | null>(null)
function SearchableRow({ nodeKey, ...props }: React.HTMLAttributes<HTMLDivElement> & { nodeKey: string }) {
  const match = useContext(SearchMatch) === nodeKey
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (match) ref.current?.scrollIntoView({ block: 'nearest' })
  }, [match])
  return <div {...props} ref={ref} data-search-match={match || undefined} />
}

function Chevron({ id }: { id: string }) {
  const open = useContext(OpenSections).has(id)
  return (
    <Button slot="chevron" className="tree-chevron" excludeFromTabOrder aria-label={open ? 'Collapse' : 'Expand'}>
      <Icon name={open ? 'chevronDown' : 'chevronRight'} size={14} />
    </Button>
  )
}
