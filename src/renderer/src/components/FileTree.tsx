import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Tree, TreeItem, TreeItemContent, Virtualizer, type Key, type Selection } from 'react-aria-components'
import { Icon } from './Icon'
import { Tip } from './Tip'
import { PaneFrame, PaneSearch } from './Pane'
import { SearchFeedback } from './SearchFeedback'
import { usePane } from '../lib/usePane'
import { handleNavigation } from '../lib/navigation'
import { useSearchMatches } from '../lib/useSearchMatches'
import { ancestors, buildFileTree, filesInOrder, prepareSearch, searchPrepared, type TreeEntry } from '../lib/fileTree'
import { fileListCopy, registerListCopy } from '../lib/listCopy'

/** Matches --row-md (tokens.css). */
const ROW_H = 28
const INDENT_STEP = 20
const MAX_MATCHES = 200

export function FileTree({ repo, paths, selected, expanded, changed, onExpandedChange, onSelect, onOpen, onBack, onMenu, onSwitch, focusRequest, onFocusHandled }: {
  repo: string
  paths: string[]
  /** A file, or a folder when the previously selected file is not in this snapshot. */
  selected: string | null
  expanded: Set<string>
  changed: ReadonlyMap<string, string>
  onExpandedChange: (expanded: Set<string>) => void
  onSelect: (path: string) => void
  onOpen: () => void
  /** Escape with nothing to clear; arrows never call it. */
  onBack?: () => void
  onMenu: (path: string) => void
  onSwitch: () => void
  /** Focus the selected row (or the first) and scroll it into view, then report it handled. */
  focusRequest: boolean
  onFocusHandled: () => void
}) {
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [searchFocused, setSearchFocused] = useState(false)
  const filterRef = useRef<HTMLInputElement>(null)
  const treeRef = useRef<HTMLDivElement>(null)
  const pane = usePane('commit-files', { virtualized: true })
  const filtering = !!deferredQuery.trim()

  // Targets are prepared once per snapshot; results are capped because React Aria builds every row it is given.
  const prepared = useMemo(() => prepareSearch(paths), [paths])
  const result = useMemo(() => filtering ? searchPrepared(deferredQuery, prepared, MAX_MATCHES) : null, [deferredQuery, prepared, filtering])
  const shown = result?.paths ?? paths
  const tree = useMemo(() => buildFileTree(shown), [shown])
  const matches = useMemo(() => filtering ? filesInOrder(tree) : [], [tree, filtering])
  const matchPositions = useMemo(() => matches.map((_, i) => i), [matches])
  const position = selected ? matches.indexOf(selected) : -1
  const search = useSearchMatches(deferredQuery, matchPositions, position)

  // While searching, every folder holding a match is open so all matches are visible.
  const open = useMemo(() => filtering ? new Set(matches.flatMap(ancestors)) : expanded, [filtering, matches, expanded])
  const folderPaths = useMemo(() => new Set(paths.flatMap(ancestors)), [paths])

  /** Scroll a row into the virtualized window (centred when it was not rendered). */
  const reveal = (path: string) => {
    const el = treeRef.current
    const row = el?.querySelector<HTMLElement>(`[role=row][data-key="${CSS.escape(path)}"]`)
    if (row) return row.scrollIntoView({ block: 'nearest' })
    const index = visibleKeys().indexOf(path)
    if (el && index >= 0) el.scrollTop = Math.max(0, index * ROW_H - el.clientHeight / 2)
  }
  useEffect(() => {
    if (!selected) return
    const frame = requestAnimationFrame(() => reveal(selected))
    return () => cancelAnimationFrame(frame)
  }, [selected])

  const live = useRef({ repo, selected, files: new Set(paths) })
  live.current = { repo, selected, files: new Set(paths) }
  useEffect(() => registerListCopy(fileListCopy(() => treeRef.current, () => ({
    repo: live.current.repo,
    paths: live.current.selected && live.current.files.has(live.current.selected) ? [live.current.selected] : []
  }))), [])

  const focusedKey = () => (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('[role=row]')?.dataset.key
  const toggle = (path: string) => {
    if (filtering) return
    const next = new Set(expanded)
    if (next.has(path)) next.delete(path)
    else next.add(path)
    onExpandedChange(next)
  }

  const visibleKeys = () => {
    const keys: string[] = []
    const walk = (entries: TreeEntry[]) => entries.forEach((e) => {
      keys.push(e.path)
      if (e.folder && open.has(e.path)) walk(e.children)
    })
    walk(tree)
    return keys
  }
  /** Focus a row, scrolling it into the virtualized window first when it is not rendered. */
  const focusRow = (key: string) => {
    const find = () => treeRef.current?.querySelector<HTMLElement>(`[role=row][data-key="${CSS.escape(key)}"]`)
    const row = find()
    if (row) return row.focus()
    reveal(key)
    let tries = 0
    const retry = () => {
      const found = find()
      if (found) found.focus()
      else if (++tries < 20) requestAnimationFrame(retry)
    }
    requestAnimationFrame(retry)
  }
  useEffect(() => {
    if (!focusRequest) return
    const key = selected && visibleKeys().includes(selected) ? selected : visibleKeys()[0]
    if (key) {
      reveal(key)
      focusRow(key)
    }
    onFocusHandled()
  }, [focusRequest])

  /**
   * Arrows never leave the tree: → opens a folder, then enters it; ← closes a folder, then climbs to its parent.
   * At a root row or on a file they do nothing. Enter opens a file; Escape clears the filter, then goes back.
   */
  const onTreeArrow = (e: React.KeyboardEvent, key: string, isFile: boolean) => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.nativeEvent.isComposing) return false
    const handled = (run: () => void) => { e.preventDefault(); e.stopPropagation(); run(); return true }
    if (e.key === 'ArrowRight') {
      if (isFile) return handled(() => {})
      if (!open.has(key)) return handled(() => toggle(key))
      const child = visibleKeys()[visibleKeys().indexOf(key) + 1]
      return handled(() => child?.startsWith(key + '/') && focusRow(child))
    }
    if (e.key === 'ArrowLeft') {
      if (!isFile && open.has(key) && !filtering) return handled(() => toggle(key))
      const parent = key.includes('/') ? key.slice(0, key.lastIndexOf('/')) : null
      return handled(() => parent && focusRow(parent))
    }
    return false
  }

  const onKeyDownCapture = (e: React.KeyboardEvent) => {
    if (pane.navigate(e, () => { filterRef.current?.focus(); filterRef.current?.select() })) return
    const key = focusedKey()
    const isFile = !!key && !folderPaths.has(key)
    if (key && !e.defaultPrevented && onTreeArrow(e, key, isFile)) return
    handleNavigation(e, {
      switchList: onSwitch,
      dismiss: query ? () => setQuery('') : onBack,
      menu: key && isFile ? () => onMenu(key) : undefined,
      activate: key ? (isFile ? onOpen : () => toggle(key)) : undefined
    })
  }

  const findFile = (backwards: boolean) => {
    if (!filtering || !matches.length) return
    const next = search.next(backwards)
    if (next === null) return
    onSelect(matches[next])
  }
  const leaveSearch = () => {
    const row = selected ? treeRef.current?.querySelector<HTMLElement>(`[role=row][data-key="${CSS.escape(selected)}"]`) : null
    if (row) row.focus()
    else treeRef.current?.focus()
  }

  const renderEntry = (entry: TreeEntry): React.ReactElement => {
    const status = entry.folder ? undefined : changed.get(entry.path)
    return (
      <TreeItem
        key={entry.path}
        id={entry.path}
        textValue={entry.name}
        className={({ level }) => `tree-row ${entry.folder ? 'section' : 'file'} level-${level}`}
        hasChildItems={entry.folder}
        onAction={() => (entry.folder ? undefined : onOpen())}
        onContextMenu={(e) => {
          e.preventDefault()
          if (!entry.folder) {
            onSelect(entry.path)
            onMenu(entry.path)
          }
        }}
      >
        <TreeItemContent>
          {({ level }) => (
            <div className="tree-row-content" style={{ '--indent': `${(level - 1) * INDENT_STEP}px` } as React.CSSProperties} title={entry.path}
              onClick={entry.folder ? () => toggle(entry.path) : undefined}>
              {entry.folder ? <>
                <span className="tree-chevron" aria-hidden="true"><Icon name={open.has(entry.path) ? 'chevronDown' : 'chevronRight'} size={14} /></span>
                <Icon name="folder" size={14} />
              </> : <span className="tree-chevron" aria-hidden="true" />}
              <span className="tree-label">{entry.name}</span>
              {status && <span className={`status status-${status === '?' ? 'U' : status}`} title="Changed in this commit">{status}</span>}
            </div>
          )}
        </TreeItemContent>
        {entry.folder && open.has(entry.path) ? entry.children.map(renderEntry) : undefined}
      </TreeItem>
    )
  }

  const onSelectionChange = (keys: Selection) => {
    if (keys === 'all') return
    const [key] = keys
    if (typeof key === 'string' && !folderPaths.has(key)) onSelect(key)
  }

  return (
    <>
      <div className="sidebar-filter file-tree-filter" data-pane-owner="commit-files">
        <Icon name="search" size={14} />
        <PaneSearch
          ref={filterRef}
          paneId="commit-files"
          placeholder="Find file…  (/)"
          aria-label="Find file in this commit"
          aria-describedby="file-tree-feedback"
          value={query}
          spellCheck={false}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          onFind={findFile}
          onLeave={leaveSearch}
        />
        <SearchFeedback id="file-tree-feedback" query={deferredQuery} count={matches.length} position={position} boundary={search.boundary} loaded={result?.truncated}
          label={searchFocused && position >= 0 ? matches[position] : undefined} />
        {query && (
          <Tip label="Clear search">
            <button className="icon-btn" tabIndex={-1} onClick={() => setQuery('')}>
              <Icon name="x" size={12} />
            </button>
          </Tip>
        )}
      </div>
      <PaneFrame {...pane.resetProps} onKeyDownCapture={onKeyDownCapture}>
        <Virtualizer layout={pane.layout!} layoutOptions={{ rowHeight: ROW_H }}>
          <Tree
            ref={treeRef}
            aria-label="Files in this commit"
            className="tree details-files"
            {...pane.targetProps}
            selectionMode="single"
            selectionBehavior="replace"
            disallowEmptySelection
            selectedKeys={selected ? new Set<Key>([selected]) : new Set<Key>()}
            onSelectionChange={onSelectionChange}
            expandedKeys={open}
            onExpandedChange={(keys) => !filtering && onExpandedChange(new Set([...keys].map(String)))}
            renderEmptyState={() => <div className="muted small tree-empty">{filtering ? 'No matching files' : 'No files in this commit'}</div>}
          >
            {tree.map(renderEntry)}
          </Tree>
        </Virtualizer>
      </PaneFrame>
    </>
  )
}
