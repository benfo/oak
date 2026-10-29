import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useVirtualRows } from '../lib/useVirtualRows'
import { Button, ProgressBar } from 'react-aria-components'
import { api, errorMessage } from '../api'
import { useContextLines } from '../diff/useDiffContext'
import { fullDate, splitPath, STATUS_LABEL } from '../lib/format'
import { Avatar } from '../components/Avatar'
import type { ChangedFile, Commit } from '../../../shared/types'
import { createCommitPreviewLoader, type BranchComparison, type CommitPreview } from './commitPreview'
import { DiffView } from '../diff/DiffView'
import { BranchComparisonControls } from './BranchComparisonControls'
import { Icon } from '../components/Icon'
import { Tip } from '../components/Tip'
import { Split } from '../components/Split'
import { focusPane, handleDismissNavigation, handleListNav, handleNavigation, handleToolNavigation } from '../lib/navigation'
import { usePane } from '../lib/usePane'
import { fileMenuItems, runFileMenu } from '../lib/fileMenu'
import { openInEditor } from '../lib/openInEditor'
import { copyRemoteLink, openOnRemote } from '../lib/openOnRemote'
import { isUnpushed } from '../lib/remoteMenu'
import { isNewFileNotOnRemote } from '../../../shared/remote'
import { toast } from '../ui'
import { useSettings } from '../settings'
import { buildChangeRows, changeTreeOrder, CHANGE_TREE_INDENT, expandTo, toggled, type ChangeRow } from '../lib/changeTree'
import { ChevronSpacer, FolderLabel } from '../components/ChangeTreeRow'
import { FileIcon } from '../components/FileIcon'
import { TreeToggle, toggleChangesTree } from '../components/TreeToggle'
import { useCommitFilesMode, getCommitFilesMode, setCommitFilesMode, toggleCommitFilesMode } from './commitFilesMode'
import { loadCommitFileContent } from './commitFileContent'
import { useCommitTree } from './useCommitTree'
import { ancestors, nearestExisting } from './fileTreeModel'
import { FileTree } from './FileTree'
import { copyText } from '../lib/copy'
import { fileListCopy, registerListCopy } from '../lib/listCopy'
import { showMenu } from '../api'
import { PaneFrame } from '../components/Pane'
import { openPalette } from '../components/Palette'
import { WORKING_HASH } from '../../../shared/working.ts'
import { comparisonSummary, type ComparisonRelation } from './comparisonModes'

/** Matches --row-md (tokens.css). */
const ROW_H = 28
const OVERSCAN = 8
const NONE_COLLAPSED: ReadonlySet<string> = new Set()

export function CommitDetails({
  repo,
  hash,
  compareBase,
  branchComparison,
  comparisonSource,
  onPickTarget,
  commits,
  onSwap,
  onClearComparison,
  onSelectCommit,
  focusCode,
  filesHidden,
  filesToggle,
  contentRevision,
  onOpenChanges,
  onFileHistory,
  onBlame,
  filePath,
  jump
}: {
  repo: string
  hash: string | null
  compareBase?: string
  branchComparison?: BranchComparison
  commits: Commit[]
  comparisonSource: string
  onPickTarget: (anchor: Element) => void
  onSwap: () => void
  onClearComparison: () => void
  onSelectCommit: (h: string) => void
  focusCode: boolean
  filesHidden: boolean
  filesToggle?: ReactNode
  contentRevision: number
  onOpenChanges: () => void
  onFileHistory: (path: string) => void
  onBlame: (path: string, rev: string | null) => void
  /** In a file's history: the filtered file's path in the selected commit, preselected when the commit's files load. */
  filePath?: string
  /** Blame's Enter: put the diff cursor on this line of `file` (the commit's version), once per `n`. */
  jump?: { file: string; line: number; n: number }
}) {
  const contextLines = useContextLines()
  const loadPreview = useMemo(() => createCommitPreviewLoader(api), [])
  const [view, setView] = useState<{ key: string; preview: CommitPreview } | null>(null)
  const [selectedFile, setSelectedFile] = useState<{ key: string; path: string } | null>(null)
  const [error, setError] = useState<{ key: string; message: string } | null>(null)
  const [retry, setRetry] = useState(0)
  const [relationState, setRelationState] = useState<{ key: string; relation: ComparisonRelation } | null>(null)
  const relationKey = branchComparison?.targetHash && hash ? JSON.stringify([repo, branchComparison.targetHash, hash]) : null
  const relation = relationState?.key === relationKey ? relationState.relation : null
  useEffect(() => {
    if (!relationKey || !branchComparison?.targetHash || !hash) return
    let cancelled = false
    api
      .commitsAhead(repo, branchComparison.targetHash, hash)
      .then((ahead) => !cancelled && setRelationState({ key: relationKey, relation: { ahead } }))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [relationKey])
  const [slowKey, setSlowKey] = useState<string | null>(null)
  const working = hash === WORKING_HASH
  /** The commit whose version of a file the remote shows: HEAD for working changes. */
  const remoteCommit = working || !hash ? 'HEAD' : hash
  const selectionKey = JSON.stringify([hash, compareBase, branchComparison])
  const path = selectedFile?.key === selectionKey ? selectedFile.path : (filePath ?? null)
  const fileCommit = filePath && hash && !compareBase && !branchComparison ? commits.find((c) => c.hash === hash) : undefined
  // Working changes reload whenever the repository content may have changed, even if file statuses did not.
  const key = JSON.stringify([
    repo,
    hash,
    compareBase,
    branchComparison,
    path,
    contextLines,
    working ? contentRevision : 0,
    !!fileCommit,
    fileCommit?.status,
    fileCommit?.oldPath
  ])
  const preview = hash && view?.preview.repo === repo ? view.preview : null
  const details = preview?.details ?? null
  const file = preview?.file ?? null
  const activePath = selectedFile?.key === selectionKey ? selectedFile.path : file?.path
  const diff = preview?.diff ?? null
  const currentError = error?.key === key ? error.message : null
  const pending = !!hash && view?.key !== key && !currentError
  const detailsCurrent =
    details?.hash === hash &&
    JSON.stringify(preview?.branchComparison) === JSON.stringify(branchComparison) &&
    (!!branchComparison || preview?.compareBase === compareBase)
  const setFile = (f: ChangedFile) => {
    if (detailsCurrent && hash) {
      setSelectedFile({ key: selectionKey, path: f.path })
      setFolderCursor(null)
    }
  }
  const fileIndex = detailsCurrent ? details.files.findIndex((f) => f.path === activePath) : -1

  useEffect(() => {
    setError(null)
    if (!hash) {
      setView(null)
      return
    }
    let cancelled = false
    loadPreview(repo, hash, path, contextLines, compareBase, branchComparison, working ? contentRevision : undefined, fileCommit)
      .then((preview) => !cancelled && setView({ key, preview }))
      .catch((e) => !cancelled && setError({ key, message: errorMessage(e) }))
    return () => {
      cancelled = true
    }
  }, [key, retry])

  useEffect(() => {
    setSlowKey(null)
    if (!pending) return
    const timer = setTimeout(() => setSlowKey(key), 300)
    return () => clearTimeout(timer)
  }, [key, pending])

  const listRef = useRef<HTMLDivElement>(null)

  const commitFilesMode = useCommitFilesMode()
  const allMode = commitFilesMode === 'all' && !working && !!hash
  const { changesTree } = useSettings()
  const treeMode = changesTree && !allMode
  // Folder state belongs to the selected commit or comparison; another one starts fully expanded.
  const [collapsedState, setCollapsedState] = useState<{ key: string; set: ReadonlySet<string> }>({ key: '', set: new Set() })
  const collapsed = collapsedState.key === selectionKey ? collapsedState.set : NONE_COLLAPSED
  const setCollapsed = (set: ReadonlySet<string>) => setCollapsedState({ key: selectionKey, set })
  // A folder row can hold the cursor without changing the file whose diff is shown.
  const [folderCursor, setFolderCursor] = useState<{ key: string; id: string } | null>(null)
  const cursorId = folderCursor?.key === selectionKey ? folderCursor.id : null
  const rows = useMemo(
    () => (treeMode && detailsCurrent ? buildChangeRows(details.files, collapsed) : null),
    [treeMode, detailsCurrent, details, collapsed]
  )
  // While the next commit loads the previous files stay on screen; they must stay a tree rather than flash as a flat list.
  const shownRows = useMemo(
    () => rows ?? (treeMode && details ? buildChangeRows(details.files, collapsed) : null),
    [rows, treeMode, details, collapsed]
  )
  const navFiles = useMemo(
    () => (treeMode && detailsCurrent ? changeTreeOrder(details.files) : detailsCurrent ? details.files : []),
    [treeMode, detailsCurrent, details]
  )
  // Only the rows near the viewport are rendered, so a commit with thousands of files stays responsive.
  const rowCount = shownRows ? shownRows.length : (details?.files.length ?? 0)
  const activeIndex = shownRows
    ? shownRows.findIndex((r) => r.id === (cursorId ?? activePath))
    : (details?.files.findIndex((f) => f.path === activePath) ?? -1)
  const {
    virtual,
    start: windowStart,
    end: windowEnd,
    spacer
  } = useVirtualRows({
    count: rowCount,
    getScrollElement: () => listRef.current,
    estimateSize: () => ROW_H,
    overscan: OVERSCAN
  })
  useEffect(() => {
    if (activeIndex >= 0) virtual.scrollToIndex(activeIndex, { align: 'auto' })
  }, [file, cursorId, rows, activeIndex])
  // Switching to the tree keeps the viewed file visible.
  const wasTree = useRef(changesTree)
  useEffect(() => {
    if (changesTree && !wasTree.current && activePath) setCollapsed(expandTo(collapsed, activePath))
    wasTree.current = changesTree
  }, [changesTree])

  const selectRow = (row: ChangeRow<ChangedFile>) => {
    if (row.entry) setFile(row.entry)
    else setFolderCursor({ key: selectionKey, id: row.id })
  }

  const fileMenu = async (f: ChangedFile) => {
    const id = await showMenu(
      fileMenuItems([f.path], {
        workingTree: working,
        canOpen: f.status !== 'D',
        history: true,
        blame: true,
        canBlame: f.status !== 'D',
        canRemote: f.status !== 'D',
        notOnRemote: isNewFileNotOnRemote(f.status, { working, commitUnpushed: isUnpushed(repo, remoteCommit) })
      })
    )
    runFileMenu(id, repo, [f.path], onFileHistory, (path) => onBlame(path, working ? null : hash), remoteCommit)
  }

  const onListKey = (e: React.KeyboardEvent) => {
    const back = focusCode
      ? undefined
      : () => {
          focusPane('.commit-list')
        }
    const current = detailsCurrent ? details.files.find((f) => f.path === activePath) : undefined
    const switchView = toggleChangesTree
    const page = Math.max(1, Math.floor((listRef.current?.clientHeight ?? ROW_H) / ROW_H) - 1)
    if (rows) {
      // With the viewed file inside a collapsed folder, the cursor is on that folder.
      const hiddenIn =
        activePath && !cursorId ? rows.findIndex((r) => r.folder && activePath.startsWith(`${r.id}/`) && collapsed.has(r.id)) : -1
      const index = rows.findIndex((r) => r.id === (cursorId ?? activePath))
      const at = index >= 0 ? index : hiddenIn
      const row = rows[at]
      const parent = row?.parent ? rows.find((r) => r.id === row.parent) : undefined
      const toggleRow = () => row && setCollapsed(toggled(collapsed, row.id))
      const closed = !!row?.folder && collapsed.has(row.id)
      const open = () => {
        focusPane('.details-diff .diff')
      }
      const firstChild = row?.folder && rows[at + 1]?.parent === row.id ? rows[at + 1] : undefined
      if (
        handleNavigation(e, {
          switchList: !working && hash ? switchList : undefined,
          switchView,
          back: row?.folder && !closed ? toggleRow : parent ? () => selectRow(parent) : back,
          deeper: !row ? undefined : row.folder ? (closed ? toggleRow : firstChild ? () => selectRow(firstChild) : undefined) : open,
          activate: !row ? undefined : row.folder ? toggleRow : open,
          menu: row?.entry ? () => fileMenu(row.entry!) : undefined
        })
      )
        return
      handleListNav(e, rows.length, at, (n) => selectRow(rows[n]), page)
      return
    }
    if (
      handleNavigation(e, {
        back,
        switchList: !working && hash ? switchList : undefined,
        switchView,
        menu: current ? () => fileMenu(current) : undefined
      })
    )
      return
    if (!details || !detailsCurrent) return
    const i = details.files.findIndex((f) => f.path === activePath)
    if (handleListNav(e, details.files.length, i, (n) => setFile(details.files[n]), page)) return
    const open = () => {
      focusPane('.details-diff .diff')
    }
    handleNavigation(e, { deeper: open, activate: open })
  }

  const pane = usePane('commit-files')
  const liveFiles = useRef({ repo, paths: [] as string[] })
  liveFiles.current = { repo, paths: activePath && detailsCurrent && fileIndex >= 0 ? [activePath] : [] }
  useEffect(
    () =>
      registerListCopy(
        fileListCopy(
          () => listRef.current,
          () => liveFiles.current
        )
      ),
    []
  )
  // Selecting another commit or comparison starts in Changes without pulling focus into the file list.
  const resetFromSelection = useRef(false)
  const firstSelection = useRef(true)
  useEffect(() => {
    if (firstSelection.current) {
      firstSelection.current = false
      return
    }
    if (getCommitFilesMode() === 'all') resetFromSelection.current = true
    setCommitFilesMode('changes')
  }, [selectionKey])
  const snapshot = useCommitTree(repo, hash, allMode)
  const treePaths = snapshot.paths ?? snapshot.stale
  const pathSet = useMemo(() => new Set(treePaths ?? []), [treePaths])
  const [treeSelection, setTreeSelection] = useState<string | null>(null)
  const [treeExpanded, setTreeExpanded] = useState<Set<string>>(() => new Set())
  const [forceContent, setForceContent] = useState<string | null>(null)
  const changed = useMemo(() => new Map((detailsCurrent ? details.files : []).map((f) => [f.path, f.status])), [details, detailsCurrent])
  const snapshotReady = !!snapshot.paths
  const treeSelected = !treeSelection || !snapshotReady ? treeSelection : nearestExisting(treeSelection, pathSet) || null
  const treeMissing = snapshotReady && !!treeSelection && treeSelected !== treeSelection
  const selectTreeFile = (p: string) => {
    setTreeSelection(p)
    setForceContent(null)
    const f = details?.files.find((x) => x.path === p)
    if (f) setFile(f)
  }
  // Entering All files starts from the file already being viewed, with its folders open.
  useEffect(() => {
    if (!allMode || treeSelection || !activePath) return
    setTreeSelection(activePath)
    setTreeExpanded((open) => new Set([...open, ...ancestors(activePath)]))
  }, [allMode, activePath])

  // Switching lists keeps the file selected and moves focus into the new list (the tree focuses once its snapshot has loaded).
  const [focusTree, setFocusTree] = useState(false)
  const prevAllMode = useRef(allMode)
  useEffect(() => {
    if (prevAllMode.current === allMode) return
    prevAllMode.current = allMode
    if (allMode) {
      if (activePath) {
        setTreeSelection(activePath)
        setForceContent(null)
        setTreeExpanded((open) => new Set([...open, ...ancestors(activePath)]))
      }
      setFocusTree(true)
    } else if (resetFromSelection.current) {
      resetFromSelection.current = false
      setFocusTree(false)
    } else {
      const f = treeSelection ? details?.files.find((x) => x.path === treeSelection) : undefined
      if (f) setFile(f)
      listRef.current?.focus()
      setFocusTree(false)
    }
  }, [allMode])
  const switchList = toggleCommitFilesMode
  const showContent =
    allMode && !!treeSelection && snapshotReady && !treeMissing && (!changed.has(treeSelection) || forceContent === treeSelection)
  // The jump waits for that file's diff to be the one on screen, and happens once, so later file picks are left alone.
  const [jumped, setJumped] = useState<number | null>(null)
  const revealLine =
    jump &&
    jumped !== jump.n &&
    !pending &&
    detailsCurrent &&
    !compareBase &&
    !branchComparison &&
    !showContent &&
    !allMode &&
    file?.path === jump.file
      ? jump.line
      : undefined
  const contentKey = JSON.stringify([repo, hash, treeSelection])
  const [content, setContent] = useState<{ key: string; text?: string; error?: string } | null>(null)
  useEffect(() => {
    if (!showContent || !hash || !treeSelection) return
    let cancelled = false
    loadCommitFileContent(repo, hash, treeSelection)
      .then((text) => !cancelled && setContent({ key: contentKey, text }))
      .catch((e) => !cancelled && setContent({ key: contentKey, error: errorMessage(e) }))
    return () => {
      cancelled = true
    }
  }, [showContent, contentKey])
  const currentContent = content?.key === contentKey ? content : null
  const treeMenu = async (p: string) => {
    const id = await showMenu([
      ...fileMenuItems([p], { workingTree: false, history: true, blame: true }),
      { type: 'separator' },
      { id: 'save', label: 'Save a copy…' }
    ])
    if (id === 'save' && hash) {
      try {
        const saved = await api.saveFileCopy(repo, hash, p)
        if (saved) toast.success(`Saved ${saved}`)
      } catch (e) {
        toast.error(errorMessage(e))
      }
    } else runFileMenu(id, repo, [p], onFileHistory, (path) => onBlame(path, working ? null : hash), remoteCommit)
  }
  /** The shown file's path when it can be opened in an editor: it still exists in the working copy (or is the current content). */
  const editorPath = treeMissing ? null : showContent ? treeSelection : file && file.status !== 'D' ? file.path : null
  const openAt = (line?: number) => {
    if (!editorPath) return
    openInEditor(repo, editorPath, line, working ? undefined : 'Opened the working copy; the line may differ from this commit')
  }

  const findFile = () =>
    openPalette({
      placeholder: 'Find changed file…',
      items: detailsCurrent
        ? (details?.files ?? []).map((f) => ({
            id: f.path,
            label: f.path,
            run: () => {
              setFile(f)
              setCollapsed(expandTo(collapsed, f.path))
              listRef.current?.focus()
            }
          }))
        : []
    })

  const renderFile = (
    f: ChangedFile,
    { selected, style, spacer }: { selected: boolean; style?: React.CSSProperties; spacer?: boolean }
  ) => {
    const { dir, name } = splitPath(f.path)
    return (
      <Tip key={f.path} label={f.oldPath ? `${f.oldPath} → ${f.path}` : f.path} focusable={false}>
        <div
          className={`file-row ${selected ? 'selected' : ''}`}
          style={style}
          onClick={() => setFile(f)}
          onContextMenu={(e) => {
            e.preventDefault()
            setFile(f)
            fileMenu(f)
          }}
        >
          {spacer && <ChevronSpacer />}
          <Tip label={STATUS_LABEL[f.status]} focusable={false}>
            <span className={`status status-${f.status === '?' ? 'U' : f.status}`}>{f.status}</span>
          </Tip>
          <FileIcon path={f.path} kind="file" />
          <span className="file-name">{name}</span>
          <span className="file-dir">{spacer ? '' : dir}</span>
          {f.additions !== null && (
            <span className="numstat">
              <span className="add">+{f.additions}</span> <span className="del">−{f.deletions}</span>
            </span>
          )}
        </div>
      </Tip>
    )
  }

  const [subject, ...rest] = (details?.message ?? '').split('\n')
  const body = rest.join('\n').trim()
  const endpoint = (h: string) => `${h.slice(0, 8)} · ${commits.find((c) => c.hash === h)?.subject ?? ''}`

  return (
    <div className="commit-details-view">
      <Split id="commit-details" label="Commit files width" initial={420} min={260} max={900} collapsed={filesHidden}>
        <div className="commit-info" aria-busy={pending}>
          <div
            className="commit-meta"
            tabIndex={-1}
            {...pane.ownerProps}
            onKeyDown={(e) => {
              const target = e.target as HTMLElement
              if (
                e.currentTarget.contains(target) &&
                target.closest('.branch-comparison-controls') &&
                handleDismissNavigation(e, [onClearComparison], { allowTextInput: true })
              )
                return
              handleToolNavigation(e)
            }}
          >
            {branchComparison && (
              <BranchComparisonControls
                comparison={branchComparison}
                source={comparisonSource}
                onPickTarget={onPickTarget}
                onEnd={onClearComparison}
              />
            )}
            {details && preview?.compareBase ? (
              <>
                {!branchComparison && <h3 className="commit-subject">Compare commits</h3>}
                {preview.branchComparison && (
                  <p className="commit-body">
                    Target: {preview.branchComparison.targetName} · {preview.branchComparison.targetHash?.slice(0, 8)}
                  </p>
                )}
                <p className="commit-body">
                  {preview.comparisonMode === 'changes' ? 'Common ancestor' : 'Before'}: {endpoint(preview.compareBase)}
                </p>
                <p className="commit-body">After: {endpoint(details.hash)}</p>
                {!preview.branchComparison && (
                  <div
                    className="comparison-actions"
                    onKeyDown={(e) => handleDismissNavigation(e, [onClearComparison], { allowTextInput: true })}
                  >
                    <Button className="btn" isDisabled={!detailsCurrent || pending} onPress={onSwap}>
                      Swap
                    </Button>
                    <Button className="btn" onPress={onClearComparison}>
                      Exit comparison
                    </Button>
                  </div>
                )}
                <span className="muted small">
                  {preview.branchComparison
                    ? comparisonSummary(preview.branchComparison.targetName, preview.comparisonMode ?? 'changes', relation)
                    : 'Net changes between these commits'}
                </span>
              </>
            ) : details && working ? (
              <>
                <h3 className="commit-subject">Working changes</h3>
                <p className="commit-body">Everything uncommitted compared with HEAD: staged, unstaged and untracked files.</p>
                <div className="comparison-actions">
                  <Button className="btn" onPress={onOpenChanges}>
                    Open in Changes
                  </Button>
                </div>
              </>
            ) : details ? (
              <>
                <h3 className="commit-subject">{subject}</h3>
                {body && <pre className="commit-body">{body}</pre>}
                <div className="commit-identity">
                  <div className="author-line">
                    <Avatar name={details.author} email={details.email} size={30} />
                    <div>
                      <div>
                        <strong>{details.author}</strong> <span className="muted">&lt;{details.email}&gt;</span>
                      </div>
                      <div className="muted small">
                        {fullDate(details.authorDate)}
                        {details.committer !== details.author && ` · committed by ${details.committer}`}
                      </div>
                    </div>
                  </div>
                  <div className="hash-line">
                    <span className="mono">{details.hash.slice(0, 12)}</span>
                    <Tip label="Copy full hash" keys="Ctrl+Shift+C">
                      <button
                        className="icon-btn"
                        disabled={!detailsCurrent}
                        aria-label="Copy full hash"
                        onClick={() => copyText(details.hash, 'commit hash')}
                      >
                        <Icon name="copy" size={13} />
                      </button>
                    </Tip>
                    {details.parents.length > 0 && <span className="muted small">{details.parents.length > 1 ? 'parents' : 'parent'}</span>}
                    {details.parents.map((p) => (
                      <button key={p} className="link mono" disabled={!detailsCurrent} onClick={() => onSelectCommit(p)}>
                        {p.slice(0, 8)}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="commit-placeholder">{hash ? '\u00a0' : 'Select a commit'}</div>
            )}
          </div>
          <div className="file-list-head" {...pane.ownerProps}>
            {!working && !!hash ? (
              <div className="segmented" role="group" aria-label="Files shown">
                {(['changes', 'all'] as const).map((m) => (
                  <Tip key={m} label={commitFilesMode === m ? undefined : 'Switch list'} keys="T">
                    <button className="segment" aria-pressed={commitFilesMode === m} onClick={() => setCommitFilesMode(m)}>
                      {m === 'changes' ? (details ? `${details.files.length} changed` : 'Changes') : 'All files'}
                      <kbd aria-hidden="true">T</kbd>
                    </button>
                  </Tip>
                ))}
              </div>
            ) : details ? (
              <>
                {details.files.length} {details.files.length === 1 ? 'file' : 'files'} changed
              </>
            ) : (
              '\u00a0'
            )}
            {details && !allMode && !preview?.compareBase && details.parents.length > 1 && (
              <span className="muted small"> (vs first parent)</span>
            )}
            {!!hash && !allMode && <TreeToggle />}
          </div>
          {allMode ? (
            snapshot.error ? (
              <div className="muted small tree-empty" role="alert">
                Could not list files: {snapshot.error}
              </div>
            ) : treePaths ? (
              <FileTree
                repo={repo}
                paths={treePaths}
                selected={treeSelected}
                expanded={treeExpanded}
                changed={changed}
                onExpandedChange={setTreeExpanded}
                onSelect={selectTreeFile}
                onOpen={() => {
                  focusPane('.details-diff .diff')
                }}
                onMenu={treeMenu}
                onSwitch={switchList}
                focusRequest={focusTree}
                onFocusHandled={() => setFocusTree(false)}
              />
            ) : (
              <div className="muted small tree-empty" role="status">
                Loading files…
              </div>
            )
          ) : (
            <PaneFrame>
              <div
                ref={listRef}
                className="file-list details-files"
                tabIndex={0}
                {...pane.targetProps}
                {...pane.resetProps}
                aria-label={
                  working
                    ? 'Uncommitted files'
                    : preview?.compareBase
                      ? 'Files changed between selected commits'
                      : 'Files changed in this commit'
                }
                onKeyDown={onListKey}
                onKeyDownCapture={(e) => pane.navigate(e, findFile)}
              >
                <div className="file-rows" style={spacer}>
                  {shownRows
                    ? shownRows.slice(windowStart, windowEnd).map((row) => {
                        const style = { '--indent': `${row.depth * CHANGE_TREE_INDENT}px` } as React.CSSProperties
                        if (row.entry) return renderFile(row.entry, { style, spacer: true, selected: !cursorId && activePath === row.id })
                        const closed = collapsed.has(row.id)
                        return (
                          <Tip key={row.id} label={row.id} focusable={false}>
                            <div
                              className={`file-row folder-row ${cursorId === row.id ? 'selected' : ''}`}
                              style={style}
                              onClick={() => {
                                selectRow(row)
                                setCollapsed(toggled(collapsed, row.id))
                              }}
                            >
                              <FolderLabel row={row} collapsed={closed} />
                            </div>
                          </Tip>
                        )
                      })
                    : details?.files.slice(windowStart, windowEnd).map((f) => renderFile(f, { selected: activePath === f.path }))}
                </div>
              </div>
            </PaneFrame>
          )}
        </div>
        <div className={`diff-pane details-diff ${showContent ? 'plain-content' : ''}`} aria-busy={pending}>
          {allMode && (
            <div className="diff-mode-bar">
              <span className="muted small">
                {!treeSelection || treeMissing
                  ? 'Files at this commit'
                  : changed.has(treeSelection)
                    ? showContent
                      ? 'File content at this commit'
                      : 'Changes in this commit'
                    : 'Unchanged in this commit'}
              </span>
              <button
                className="btn"
                disabled={!treeSelection || treeMissing || !changed.has(treeSelection)}
                onClick={() => treeSelection && setForceContent(showContent ? null : treeSelection)}
              >
                {showContent ? 'Show diff' : 'Show content'}
              </button>
            </div>
          )}
          <DiffView
            revealLine={revealLine}
            onRevealed={() => jump && setJumped(jump.n)}
            title={
              showContent || treeMissing
                ? (treeSelection ?? undefined)
                : file
                  ? file.oldPath
                    ? `${file.oldPath} → ${file.path}`
                    : file.path
                  : undefined
            }
            text={treeMissing ? null : showContent ? (currentContent?.text ?? null) : diff}
            loading={showContent ? !currentContent : !!file}
            emptyText={
              treeMissing
                ? `${treeSelection} is not present in this commit`
                : currentContent?.error && showContent
                  ? `Could not load file: ${currentContent.error}`
                  : allMode
                    ? treeSelection
                      ? ''
                      : 'Select a file'
                    : !hash
                      ? 'Select a commit'
                      : details
                        ? details.files.length
                          ? 'Select a file'
                          : working
                            ? 'No uncommitted changes'
                            : preview?.compareBase
                              ? 'No differences between these commits'
                              : 'No file changes in this commit'
                        : ''
            }
            onBack={
              filesHidden
                ? undefined
                : () => {
                    focusPane('.details-files')
                  }
            }
            onSwitchView={filesHidden || allMode ? undefined : toggleChangesTree}
            onOpenInEditor={editorPath ? openAt : undefined}
            remote={
              editorPath && !working
                ? {
                    open: (line) => openOnRemote(repo, { kind: 'file', hash: remoteCommit, path: editorPath, line }),
                    copyLink: (line) => copyRemoteLink(repo, { kind: 'file', hash: remoteCommit, path: editorPath, line }, 'line link'),
                    notOnRemote: () =>
                      !!file && isNewFileNotOnRemote(file.status, { working, commitUnpushed: isUnpushed(repo, remoteCommit) })
                  }
                : undefined
            }
            leading={filesToggle}
            plain={showContent}
            files={
              !allMode && detailsCurrent && details.files.length
                ? {
                    index: navFiles.findIndex((f) => f.path === activePath),
                    count: navFiles.length,
                    onSelect: (index) => {
                      const next = navFiles[index]
                      if (next) {
                        setFile(next)
                        setCollapsed(expandTo(collapsed, next.path))
                      }
                    }
                  }
                : undefined
            }
          />
        </div>
      </Split>
      {currentError ? (
        <div className="commit-load-status" role="alert">
          Could not load the selected preview: {currentError}
          <Button className="btn" onPress={() => setRetry((n) => n + 1)}>
            Retry
          </Button>
        </div>
      ) : (
        pending &&
        slowKey === key && (
          <div className="commit-load-status" role="status">
            <ProgressBar className="commit-loading-progress" isIndeterminate aria-label="Loading selected preview">
              <span className="spinner" aria-hidden="true" />
              {detailsCurrent
                ? 'Loading selected file…'
                : compareBase || branchComparison
                  ? 'Loading selected comparison…'
                  : 'Loading selected commit…'}
              {details && <span className="muted">Showing previous preview</span>}
            </ProgressBar>
          </div>
        )
      )}
    </div>
  )
}
