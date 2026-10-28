import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import {
  Button,
  GridList,
  GridListItem,
  Menu,
  MenuItem as AriaMenuItem,
  MenuTrigger,
  Popover,
  Virtualizer,
  type Selection
} from 'react-aria-components'
import { useMultipleSelectionState } from 'react-stately'
import { api, errorMessage, showMenu } from '../api'
import { splitPath, STATUS_LABEL } from '../lib/format'
import type { RepoCtx } from '../useRepo'
import { confirm, toast } from '../ui'
import { openPreferences } from '../components/Preferences'
import { useContextLines } from '../diff/useDiffContext'
import type { DiffKind, FileChange, MenuItem } from '../../../shared/types'
import { CommitBox } from './CommitBox'
import oakIcon from '../../../../build/icon.svg'
import { DiffView, type DiffActions } from '../diff/DiffView'
import type { FileDiff } from '../diff/diff'
import { Tip } from '../components/Tip'
import { focusFiles, focusPane, handleNavigation, handleToolNavigation } from '../lib/navigation'
import { usePane } from '../lib/usePane'
import { fileMenuItems, runFileMenu } from '../lib/fileMenu'
import { fileListCopy, registerListCopy } from '../lib/listCopy'
import { PaneFrame } from '../components/Pane'
import { openPalette } from '../components/Palette'
import { Icon } from '../components/Icon'
import { Split } from '../components/Split'
import { MenuNavigation } from '../components/MenuNavigation'
import { stash } from '../actions'
import { useSettings } from '../settings'
import { buildChangeRows, changeTreeOrder, CHANGE_TREE_INDENT, expandTo, toggled, type ChangeRow } from '../lib/changeTree'
import { ChevronSpacer, FolderLabel } from '../components/ChangeTreeRow'
import { TreeToggle, toggleChangesTree } from '../components/TreeToggle'

/** Matches --row-md (tokens.css). */
const ROW_H = 28
const NONE_COLLAPSED: ReadonlySet<string> = new Set()

type Section = 'conflicted' | 'unstaged' | 'staged'

interface Entry extends FileChange {
  kind: DiffKind
}

/** The selection lives in one section at a time; `lead` is the file whose diff is shown. */
interface Sel {
  section: Section
  keys: Set<string>
  lead: string | null
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export function ChangesView({
  r,
  onBackToSidebar,
  focusCode,
  onFileHistory,
  onBlame
}: {
  r: RepoCtx
  onBackToSidebar: () => void
  focusCode: boolean
  onFileHistory: (path: string) => void
  onBlame: (path: string, rev: string | null) => void
}) {
  const st = r.status
  // React Aria keeps the Shift+click anchor on its Selection (a Set subclass) and only honours it on an
  // instance of that class. The class isn't exported, so take it from its public selection hook and use it
  // for selections we make ourselves (landing on a file, after staging, right-click).
  const RacSelection = useMultipleSelectionState({}).selectedKeys.constructor as new (
    keys: Iterable<string>,
    anchorKey?: string | null,
    currentKey?: string | null
  ) => Set<string>
  const anchored = (keys: string[], anchor: string | null = keys[keys.length - 1] ?? null) => new RacSelection(keys, anchor, anchor)
  const [sel, setSel] = useState<Sel>({ section: 'unstaged', keys: new Set(), lead: null })
  const [diff, setDiff] = useState<string | null>(null)
  /** Where the selection should go after the current selection is staged/unstaged/discarded. */
  const pending = useRef<{ section: Section; path: string } | null>(null)

  const lists = useMemo((): Record<Section, Entry[]> => {
    if (!st) return { conflicted: [], unstaged: [], staged: [] }
    return {
      conflicted: st.conflicted.map((f): Entry => ({ ...f, kind: 'conflicted' })),
      unstaged: st.unstaged.map((f): Entry => ({ ...f, kind: f.status === '?' ? 'untracked' : 'unstaged' })),
      staged: st.staged.map((f): Entry => ({ ...f, kind: 'staged' }))
    }
  }, [st])

  const find = (section: Section, path: string | null) => (path === null ? undefined : lists[section].find((e) => e.path === path))
  const lead = find(sel.section, sel.lead) ?? null
  const selected = lists[sel.section].filter((e) => sel.keys.has(e.path))

  // ---------- tree mode: folder rows stand for the files under them ----------
  const { changesTree } = useSettings()
  const [collapsed, setCollapsed] = useState<Record<Section, ReadonlySet<string>>>({
    conflicted: NONE_COLLAPSED,
    unstaged: NONE_COLLAPSED,
    staged: NONE_COLLAPSED
  })
  const treeRows = useMemo(
    () =>
      changesTree
        ? (Object.fromEntries(
            (['conflicted', 'unstaged', 'staged'] as Section[]).map((s) => [s, buildChangeRows(lists[s], collapsed[s])])
          ) as Record<Section, ChangeRow<Entry>[]>)
        : null,
    [changesTree, lists, collapsed]
  )
  const folderFiles = useMemo(
    () =>
      treeRows &&
      (Object.fromEntries(
        (['conflicted', 'unstaged', 'staged'] as Section[]).map((s) => [
          s,
          new Map(treeRows[s].filter((r) => r.folder).map((r) => [r.id, r.files]))
        ])
      ) as Record<Section, Map<string, Entry[]>>),
    [treeRows]
  )
  /** The files a row stands for: a folder's files, or the file itself. */
  const ownersOf = (section: Section, id: string): Entry[] =>
    folderFiles?.[section].get(id) ?? (find(section, id) ? [find(section, id)!] : [])
  const orderOf = (section: Section) => (changesTree ? changeTreeOrder(lists[section]) : lists[section])
  const toggleFolder = (section: Section, id: string) => setCollapsed((c) => ({ ...c, [section]: toggled(c[section], id) }))
  const revealFile = (section: Section, path: string) =>
    setCollapsed((c) => (expandTo(c[section], path) === c[section] ? c : { ...c, [section]: expandTo(c[section], path) }))
  // Switching to the tree keeps the file being viewed visible.
  const wasTree = useRef(changesTree)
  useEffect(() => {
    if (changesTree && !wasTree.current && lead) revealFile(sel.section, lead.path)
    wasTree.current = changesTree
  }, [changesTree])
  /** Rows shown as selected: a folder counts once all its files are. */
  const gridKeys = (section: Section): Set<string> => {
    if (sel.section !== section) return new Set()
    const full = treeRows?.[section].filter((r) => r.folder && r.files.every((f) => sel.keys.has(f.path))).map((r) => r.id)
    if (!full?.length) return sel.keys
    const anchor = (sel.keys as { anchorKey?: string | null }).anchorKey ?? null
    return new RacSelection([...sel.keys, ...full], anchor, anchor)
  }

  // Keep the selection valid as files move between sections: prune vanished files, and when the
  // lead file is gone, move to the neighbour queued by the last action (or the first file).
  useEffect(() => {
    if (!st) return
    const kept = [...sel.keys].filter((k) => find(sel.section, k))
    const anchor = (sel.keys as { anchorKey?: string | null }).anchorKey
    const keys = anchored(kept, anchor && kept.includes(anchor) ? anchor : undefined)
    if (lead) {
      if (keys.size !== sel.keys.size) setSel({ ...sel, keys })
      return
    }
    const p = pending.current
    pending.current = null
    const next =
      (p && find(p.section, p.path) && p) ||
      (['conflicted', 'unstaged', 'staged'] as Section[]).map((s) => lists[s][0] && { section: s, path: lists[s][0].path }).find(Boolean) ||
      null
    setSel(
      next ? { section: next.section, keys: anchored([next.path]), lead: next.path } : { section: 'unstaged', keys: new Set(), lead: null }
    )
  }, [lists])

  // Reloads keep the current diff on screen; it's only cleared when switching to another file.
  const contextLines = useContextLines()
  const shownKey = useRef<string | null>(null)
  useEffect(() => {
    if (!lead) {
      shownKey.current = null
      setDiff(null)
      return
    }
    // By list, not kind: a new file becoming "modified" (part of it staged) is still the same diff.
    const key = `${sel.section}:${lead.path}`
    if (shownKey.current !== key) setDiff(null)
    let cancelled = false
    api
      .workingDiff(r.path, lead.path, lead.kind, lead.oldPath, contextLines)
      .then((t) => {
        if (cancelled) return
        shownKey.current = key
        setDiff(t)
      })
      .catch((e) => !cancelled && setDiff(`Could not load diff: ${errorMessage(e)}`))
    return () => {
      cancelled = true
    }
  }, [r.path, lead?.kind, lead?.path, lead?.oldPath, st, r.contentRevision, contextLines])

  const onSelectionChange = (section: Section, selection: Selection) => {
    if (treeRows) {
      const raw = selection === 'all' ? lists[section].map((e) => e.path) : [...selection].map(String)
      const files = [...new Set(raw.flatMap((k) => (selection === 'all' ? [k] : ownersOf(section, k).map((e) => e.path))))]
      const anchor = selection === 'all' ? null : ((selection as { anchorKey?: string | null }).anchorKey ?? null)
      const keys = anchored(files, anchor ?? undefined)
      const shown = gridKeys(section)
      const added = raw.filter((k) => !shown.has(k))
      const last = added[added.length - 1]
      // Selecting a folder shows its first file; otherwise the lead follows the newest row.
      const nextLead = last
        ? (ownersOf(section, last)[0]?.path ?? null)
        : keys.has(sel.lead ?? '') && sel.section === section
          ? sel.lead
          : (files[0] ?? null)
      setSel({ section, keys, lead: nextLead })
      return
    }
    // Keep React Aria's own Selection object: it carries the anchor that Shift+click ranges start from
    // (copying it into a plain Set loses that, and Shift+click then only adds the clicked file).
    const keys =
      selection === 'all'
        ? anchored(lists[section].map((e) => e.path))
        : selection instanceof RacSelection
          ? (selection as Set<string>)
          : anchored([...selection].map(String))
    // The lead follows the most recently added file, so the diff tracks keyboard/mouse movement.
    const added = [...keys].filter((k) => !(sel.section === section && sel.keys.has(k)))
    const nextLead = added.length
      ? added[added.length - 1]
      : keys.has(sel.lead ?? '') && sel.section === section
        ? sel.lead
        : ([...keys][0] ?? null)
    setSel({ section, keys, lead: nextLead })
  }

  /** Before acting on files, remember which neighbour to select once they leave the list. */
  const queueNeighbour = (section: Section, acted: Entry[]) => {
    const list = lists[section]
    const gone = new Set(acted.map((e) => e.path))
    const last = Math.max(...acted.map((e) => list.indexOf(e)))
    const next = list.slice(last + 1).find((e) => !gone.has(e.path)) ?? [...list.slice(0, last)].reverse().find((e) => !gone.has(e.path))
    pending.current = next ? { section, path: next.path } : null
  }

  // ---------- actions (each takes the files to act on) ----------

  const stage = (files: Entry[]) => {
    queueNeighbour(files[0].kind === 'conflicted' ? 'conflicted' : 'unstaged', files)
    return r.run(files.length > 1 ? `Staging ${files.length} files` : 'Staging', () =>
      api.stage(
        r.path,
        files.map((e) => e.path)
      )
    )
  }
  const unstage = (files: Entry[]) => {
    queueNeighbour('staged', files)
    return r.run(files.length > 1 ? `Unstaging ${files.length} files` : 'Unstaging', () =>
      api.unstage(
        r.path,
        files.flatMap((e) => (e.oldPath ? [e.path, e.oldPath] : [e.path]))
      )
    )
  }
  const discard = async (files: Entry[]) => {
    const untracked = files.filter((e) => e.kind === 'untracked')
    const tracked = files.filter((e) => e.kind !== 'untracked')
    const one = files.length === 1 ? files[0] : null
    const ok = await confirm({
      title: one?.kind === 'untracked' ? 'Delete untracked file' : 'Discard changes',
      message: one
        ? one.kind === 'untracked'
          ? `Move "${one.path}" to the Recycle Bin?`
          : `Discard all unstaged changes to "${one.path}"? This cannot be undone.`
        : `Discard changes to ${plural(files.length, 'file')}?${tracked.length ? ` ${plural(tracked.length, 'modified file')} will be reset (cannot be undone).` : ''}${untracked.length ? ` ${plural(untracked.length, 'untracked file')} will be moved to the Recycle Bin.` : ''}`,
      ok: one?.kind === 'untracked' ? 'Delete' : 'Discard',
      danger: true
    })
    if (!ok) return
    queueNeighbour('unstaged', files)
    await r.run('Discarding', () =>
      api.discard(
        r.path,
        tracked.map((e) => e.path),
        untracked.map((e) => e.path)
      )
    )
  }
  const resolve = async (files: Entry[], side: 'ours' | 'theirs' | 'mark') => {
    if (side === 'mark') {
      const marked = await api.conflictMarkers(
        r.path,
        files.map((e) => e.path)
      )
      if (marked.length) {
        const ok = await confirm({
          title: 'Conflict markers remain',
          message:
            marked.length === 1
              ? `"${marked[0]}" still contains conflict markers (<<<<<<<). Mark it as resolved anyway?`
              : `${plural(marked.length, 'file')} still contain conflict markers (<<<<<<<). Mark them as resolved anyway?`,
          ok: 'Mark as resolved',
          danger: true
        })
        if (!ok) return
      }
    }
    queueNeighbour('conflicted', files)
    return r.run('Resolving conflicts', async () => {
      for (const e of files) await api.resolveConflict(r.path, e.path, side)
    })
  }
  const openMergeTool = (files: Entry[]) =>
    runMergeTool(
      r,
      files.map((e) => e.path)
    )
  const discardAll = async () => discard(lists.unstaged)

  /** Enter / double-click: the section's main action, on the selection if the file is part of it. Conflicts have none, so a stray key can't resolve one. */
  const primary = (section: Section, files: Entry[]) => {
    if (section === 'conflicted') {
      toast.brief('Use "Open in merge tool" or "Mark as resolved" on the file')
      return
    }
    return section === 'staged' ? unstage(files) : stage(files)
  }

  /** Files an action applies to: the selection when the row's files are all in it, else just the row's files. */
  const targets = (section: Section, owners: Entry[]) =>
    sel.section === section && owners.every((e) => sel.keys.has(e.path)) && selected.length > 1 ? selected : owners

  const fileMenu = async (section: Section, files: Entry[]) => {
    const n = files.length
    const one = n === 1 ? files[0] : null
    const many = n > 1 ? ` ${plural(n, 'file')}` : ''
    const items: MenuItem[] =
      section === 'conflicted'
        ? [
            { id: 'mergetool', label: `Open${many} in merge tool` },
            { id: 'ours', label: `Resolve${many} using ours (current branch)` },
            { id: 'theirs', label: `Resolve${many} using theirs (incoming)` },
            { id: 'mark', label: `Mark${many} as resolved` }
          ]
        : section === 'staged'
          ? [{ id: 'unstage', label: `Unstage${many}` }]
          : [
              { id: 'stage', label: `Stage${many}` },
              { id: 'discard', label: one?.kind === 'untracked' ? 'Delete file…' : `Discard changes${many ? ` to${many}` : ''}…` }
            ]
    const id = await showMenu([
      ...items,
      { type: 'separator' },
      ...fileMenuItems(
        files.map((e) => e.path),
        {
          workingTree: true,
          canOpen: one?.status !== 'D',
          history: true,
          blame: true,
          canBlame: !!one && !['A', 'D', '?'].includes(one.status)
        }
      )
    ])
    if (id === 'stage') stage(files)
    else if (id === 'unstage') unstage(files)
    else if (id === 'discard') discard(files)
    else if (id === 'mergetool') openMergeTool(files)
    else if (id === 'ours' || id === 'theirs' || id === 'mark') resolve(files, id)
    else
      runFileMenu(
        id,
        r.path,
        files.map((e) => e.path),
        onFileHistory,
        (path) => onBlame(path, null)
      )
  }

  /** Keys we add on top of React Aria's list behaviour. Runs in the capture phase, before the grid. */
  const onGridKeyCapture = (section: Section) => (ev: React.KeyboardEvent) => {
    const key = (ev.target as HTMLElement).closest<HTMLElement>('[role=row]')?.dataset.key
    const entry = key ? find(section, key) : undefined
    const files = sel.section === section && selected.length ? selected : []
    handleNavigation(ev, {
      deeper: entry
        ? () => {
            // Tab and Ctrl+arrows may focus a row without selecting it. Right opens that
            // file, rather than the retained preview from another section or row.
            if (sel.section !== section || !sel.keys.has(entry.path)) setSel({ section, keys: anchored([entry.path]), lead: entry.path })
            else if (sel.lead !== entry.path) setSel({ ...sel, lead: entry.path })
            focusPane('.changes-diff .diff')
          }
        : undefined,
      back: onBackToSidebar,
      discard: section === 'unstaged' && files.length ? () => discard(files) : undefined,
      menu: files.length ? () => fileMenu(section, files) : undefined
    })
  }

  const diffActions = (d: FileDiff): DiffActions | null => {
    if (!lead || d.isDeleted || d.isRename) return null
    if (lead.kind === 'unstaged' || lead.kind === 'untracked') {
      // A new file goes into the index first (--intent-to-add) so part of it can be staged.
      const intentToAdd = lead.kind === 'untracked' ? lead.path : undefined
      return {
        primary: {
          label: 'Stage',
          reverse: false,
          run: (patch) => {
            queueNeighbour('unstaged', [lead])
            r.run('Staging', () => api.applyPatch(r.path, patch, { cached: true, intentToAdd }))
          }
        },
        discard: {
          label: 'Discard',
          run: async (patch) => {
            // Every line of a new file is the whole file: delete it to the Recycle Bin like the list does.
            if (d.isNew && /^new file mode/m.test(patch)) return discard([lead])
            const ok = await confirm({
              title: 'Discard changes',
              message: 'Discard these changes from the working tree? This cannot be undone.',
              ok: 'Discard',
              danger: true
            })
            if (!ok) return
            queueNeighbour('unstaged', [lead])
            r.run('Discarding', () => api.applyPatch(r.path, patch, { reverse: true }))
          }
        }
      }
    }
    if (lead.kind === 'staged')
      return {
        primary: {
          label: 'Unstage',
          reverse: true,
          run: (patch) => {
            queueNeighbour('staged', [lead])
            r.run('Unstaging', () => api.applyPatch(r.path, patch, { cached: true, reverse: true }))
          }
        }
      }
    return null
  }

  /** Why a diff has no hunk or line actions (shown above it, so it doesn't look broken). */
  const readOnlyReason = (d: FileDiff) => {
    if (!lead || lead.kind === 'conflicted' || !(d.isDeleted || d.isRename)) return null
    const staged = lead.kind === 'staged'
    return `${d.isDeleted ? 'Deleted' : 'Renamed'} file — use ${staged ? 'Unstage' : 'Stage or Discard'} on the file in the list. A ${d.isDeleted ? 'deletion' : 'rename'} can't be ${staged ? 'unstaged' : 'staged'} in parts.`
  }

  const filesRef = useRef<HTMLDivElement>(null)
  const liveSelection = useRef({ repo: r.path, paths: [] as string[] })
  liveSelection.current = { repo: r.path, paths: selected.map((e) => e.path) }
  useEffect(
    () =>
      registerListCopy(
        fileListCopy(
          () => filesRef.current,
          () => liveSelection.current
        )
      ),
    []
  )

  if (!st) return <div className="pane-empty">Loading…</div>

  const total = lists.conflicted.length + lists.unstaged.length + lists.staged.length

  const grid = (
    section: Section,
    title: string,
    emptyText: string,
    rowActions: (owners: Entry[]) => ReactNode,
    headerActions?: ReactNode,
    className = ''
  ) => (
    <FileGrid
      section={section}
      title={title}
      entries={lists[section]}
      selectedKeys={gridKeys(section)}
      isLead={sel.section === section && !!lead}
      emptyText={emptyText}
      className={className}
      headerActions={headerActions}
      rowActions={rowActions}
      tree={
        treeRows
          ? {
              rows: treeRows[section],
              collapsed: collapsed[section],
              onToggle: (id) => toggleFolder(section, id),
              onReveal: (path) => revealFile(section, path)
            }
          : undefined
      }
      onSelectionChange={(s) => onSelectionChange(section, s)}
      onSwitchView={toggleChangesTree}
      onAction={(id) => {
        const owners = ownersOf(section, id)
        if (owners.length) primary(section, targets(section, owners))
      }}
      onMenu={(owners) => {
        if (!(sel.section === section && owners.every((e) => sel.keys.has(e.path))))
          setSel({
            section,
            keys: anchored(
              owners.map((e) => e.path),
              owners[0].path
            ),
            lead: owners[0].path
          })
        fileMenu(section, targets(section, owners))
      }}
      onKeyDownCapture={onGridKeyCapture(section)}
    />
  )

  return (
    <Split id="changes" label="Changed files width" initial={360} min={260} max={800} collapsed={focusCode}>
      <div className="changes-left">
        <OperationBanner r={r} />
        <div className="changes-files" ref={filesRef}>
          {lists.conflicted.length > 0 &&
            grid(
              'conflicted',
              'Conflicts',
              '',
              (owners) => {
                const t = targets('conflicted', owners)
                return (
                  <>
                    <RowButton icon="merge" label="Open in merge tool" onPress={() => openMergeTool(t)} count={t.length} />
                    <RowButton icon="check" label="Mark as resolved" onPress={() => resolve(t, 'mark')} count={t.length} />
                  </>
                )
              },
              undefined,
              'conflicts'
            )}
          {grid(
            'unstaged',
            'Unstaged',
            'No unstaged changes',
            (owners) => {
              const t = targets('unstaged', owners)
              return (
                <>
                  <RowButton
                    icon="undo"
                    label={owners.every((e) => e.kind === 'untracked') ? 'Delete' : 'Discard changes'}
                    onPress={() => discard(t)}
                    count={t.length}
                  />
                  <RowButton icon="plus" label="Stage" onPress={() => stage(t)} count={t.length} />
                </>
              )
            },
            <>
              <TreeToggle />
              {lists.unstaged.length > 0 && (
                <>
                  <Tip label="Discard all">
                    <button className="icon-btn" onClick={discardAll}>
                      <Icon name="undo" size={14} />
                    </button>
                  </Tip>
                  <Tip label="Stage all" keys="Ctrl+Shift+A">
                    <button className="icon-btn" onClick={() => r.run('Staging all', () => api.stageAll(r.path))}>
                      <Icon name="plus" size={14} />
                    </button>
                  </Tip>
                </>
              )}
              <ChangesActions r={r} />
            </>
          )}
          {grid(
            'staged',
            'Staged',
            'Stage files to include them in the next commit',
            (owners) => {
              const t = targets('staged', owners)
              return <RowButton icon="minus" label="Unstage" onPress={() => unstage(t)} count={t.length} />
            },
            lists.staged.length > 0 && (
              <Tip label="Unstage all" keys="Ctrl+Shift+U">
                <button className="icon-btn" onClick={() => r.run('Unstaging all', () => api.unstageAll(r.path))}>
                  <Icon name="minus" size={14} />
                </button>
              </Tip>
            )
          )}
        </div>
        <CommitBox r={r} />
      </div>
      <div className="diff-pane changes-diff">
        <DiffView
          title={lead ? (lead.oldPath ? `${lead.oldPath} → ${lead.path}` : lead.path) : undefined}
          metadata={
            lead && (
              <>
                <span className="diff-kind">{lead.kind}</span>
                {selected.length > 1 && <span className="diff-kind count">{selected.length} files selected</span>}
              </>
            )
          }
          text={diff}
          loading={!!lead}
          emptyText={
            total ? (
              'Select a file'
            ) : (
              <div className="clean-state">
                <img className="clean-mark" src={oakIcon} alt="" />
                <strong>Working tree clean</strong>
                <span>Nothing to commit</span>
              </div>
            )
          }
          actions={diffActions}
          readOnlyReason={readOnlyReason}
          onBack={
            focusCode
              ? undefined
              : () => {
                  focusFiles()
                }
          }
          onSwitchView={focusCode ? undefined : toggleChangesTree}
          files={
            lead
              ? {
                  index: orderOf(sel.section).findIndex((entry) => entry.path === lead.path),
                  count: lists[sel.section].length,
                  onSelect: (index) => {
                    const entry = orderOf(sel.section)[index]
                    if (entry) {
                      revealFile(sel.section, entry.path)
                      setSel({ section: sel.section, keys: anchored([entry.path]), lead: entry.path })
                    }
                  }
                }
              : undefined
          }
        />
      </div>
    </Split>
  )
}

/** Occasional working-tree actions share the existing section header. */
function ChangesActions({ r }: { r: RepoCtx }) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const dirty = !!r.status && r.status.staged.length + r.status.unstaged.length > 0
  const reason = r.busy ? 'Wait for the current operation to finish.' : !dirty ? 'No changes to stash.' : null
  return (
    <MenuTrigger isOpen={open} onOpenChange={setOpen}>
      <Tip label="Changes actions">
        <Button ref={trigger} className="icon-btn" aria-label="Changes actions">
          <Icon name="more" size={14} />
        </Button>
      </Tip>
      <Popover className="menu-popover" placement="bottom end" offset={4}>
        <MenuNavigation>
          <Menu
            className="menu"
            aria-label="Changes actions"
            onAction={() => {
              // Restore the trigger before opening the prompt, so cancelling returns here.
              flushSync(() => setOpen(false))
              trigger.current?.focus()
              void stash(r)
            }}
          >
            <AriaMenuItem id="stash" textValue="Stash changes" className="menu-item" isDisabled={!!reason}>
              <span className="menu-label">Stash changes…</span>
              <span className="menu-help">{reason ?? 'Ctrl+Shift+S · Includes untracked files'}</span>
            </AriaMenuItem>
          </Menu>
        </MenuNavigation>
      </Popover>
    </MenuTrigger>
  )
}

interface FileGridProps {
  section: Section
  title: string
  entries: Entry[]
  selectedKeys: Set<string>
  isLead: boolean
  emptyText: string
  className?: string
  headerActions?: ReactNode
  rowActions: (owners: Entry[]) => ReactNode
  /** Folder tree mode: rows include folders standing for the files under them. */
  tree?: { rows: ChangeRow<Entry>[]; collapsed: ReadonlySet<string>; onToggle: (id: string) => void; onReveal: (path: string) => void }
  onSelectionChange: (s: Selection) => void
  onSwitchView: () => void
  onAction: (id: string) => void
  onMenu: (owners: Entry[]) => void
  onKeyDownCapture: (e: React.KeyboardEvent) => void
}

/**
 * One section of changed files, built on React Aria's GridList: desktop-style multi-select
 * (click, Shift/Ctrl+click, Shift+↑↓, Ctrl+A), explicit search, Enter/double-click actions, and
 * virtualized rows for very large change sets. Tree mode keeps this grid and adds indented
 * folder rows, so selection, anchors and virtualization behave exactly as in the list.
 */
function FileGrid(p: FileGridProps) {
  const pane = usePane(`files-${p.section}`, { virtualized: true })
  const gridRef = useRef<HTMLDivElement>(null)
  const focusRequest = useRef<string | null>(null)
  const rowAt = (key: string) => gridRef.current?.querySelector<HTMLElement>(`[role=row][data-key="${CSS.escape(key)}"]`)
  /** Focus a row, scrolling a virtualized one into the window first; its ref completes focus when it mounts. */
  const focusKey = (key: string, index: number) => {
    focusRequest.current = key
    const row = rowAt(key)
    if (row) {
      focusRequest.current = null
      row.focus()
    } else if (gridRef.current) gridRef.current.scrollTop = index * ROW_H
  }
  const findFile = () =>
    openPalette({
      placeholder: `Find ${p.section} file…`,
      items: p.entries.map((file, index) => ({
        id: file.path,
        label: file.path,
        run: () => {
          const rows = p.tree ? buildChangeRows(p.entries, expandTo(p.tree.collapsed, file.path)) : null
          p.tree?.onReveal(file.path)
          p.onSelectionChange(new Set([file.path]))
          focusKey(file.path, rows ? rows.findIndex((r) => r.id === file.path) : index)
        }
      }))
    })
  const rowKey = (target: EventTarget) => (target as HTMLElement).closest<HTMLElement>('[role=row]')?.dataset.key
  /** Tree arrows: ← closes a folder, then climbs to the parent; → opens a folder, then enters it. Files fall through. */
  const treeKey = (ev: React.KeyboardEvent) => {
    const tree = p.tree
    const key = rowKey(ev.target)
    const index = tree && key ? tree.rows.findIndex((r) => r.id === key) : -1
    const row = tree?.rows[index]
    if (!tree || !row) return false
    const closed = row.folder && tree.collapsed.has(row.id)
    const parent = row.parent ? tree.rows.findIndex((r) => r.id === row.parent) : -1
    const child = row.folder && !closed && tree.rows[index + 1]?.parent === row.id ? index + 1 : -1
    return handleNavigation(ev, {
      back: row.folder && !closed ? () => tree.onToggle(row.id) : parent >= 0 ? () => focusKey(tree.rows[parent].id, parent) : undefined,
      deeper: row.folder
        ? closed
          ? () => tree.onToggle(row.id)
          : child >= 0
            ? () => focusKey(tree.rows[child].id, child)
            : undefined
        : undefined
    })
  }
  const switchView = (ev: React.KeyboardEvent) =>
    handleNavigation(ev, {
      switchView: () => {
        // Keep focus on the same file: a folder row has no counterpart in the list, so use its first file.
        const key = rowKey(ev.target)
        const row = p.tree?.rows.find((r) => r.id === key)
        focusRequest.current = row?.folder ? (row.files[0]?.path ?? null) : (key ?? null)
        p.onSwitchView()
      }
    })
  const headerId = `files-${p.section}-label`
  // Selection follows plain keyboard movement, but not Ctrl (focus only), Shift (extend) or Tab (enter).
  const lastKey = useRef<React.KeyboardEvent | null>(null)
  // React Aria caches rendered rows, so handlers that depend on the current selection go through a ref.
  const live = useRef(p)
  live.current = p
  const onItemFocus = (path: string) => {
    const k = lastKey.current
    if (k && !k.ctrlKey && !k.metaKey && !k.shiftKey && k.key !== 'Tab' && !p.selectedKeys.has(path)) p.onSelectionChange(new Set([path]))
  }
  return (
    <section
      className={`file-section ${p.className ?? ''}`}
      {...pane.ownerProps}
      {...pane.resetProps}
      onKeyDownCapture={(ev) => {
        if (pane.navigate(ev, findFile)) return
        lastKey.current = ev
        if (switchView(ev) || treeKey(ev)) return
        p.onKeyDownCapture(ev)
      }}
      onPointerDownCapture={() => {
        pane.navigate.reset()
        lastKey.current = null
      }}
      onMouseDownCapture={(ev) => {
        // Right-click inside a multi-selection keeps it (like Explorer), so the menu acts on all of them.
        // Pressing would focus the row, and React Aria selects just the row that gains focus.
        const key = (ev.target as HTMLElement).closest<HTMLElement>('[role=row]')?.dataset.key
        if (ev.button === 2 && key && p.selectedKeys.has(key)) ev.preventDefault()
      }}
      onFocus={(ev) => {
        const key = (ev.target as HTMLElement).closest<HTMLElement>('[role=row]')?.dataset.key
        if (key) onItemFocus(key)
      }}
    >
      <header>
        <span id={headerId}>{p.title}</span>
        <span className="section-count">{p.entries.length}</span>
        <span className="spacer" />
        {p.headerActions}
      </header>
      <PaneFrame>
        <Virtualizer layout={pane.layout!} layoutOptions={{ rowHeight: ROW_H }}>
          <GridList
            ref={gridRef}
            aria-labelledby={headerId}
            className={`file-grid ${p.isLead ? 'lead' : ''} ${p.entries.length ? '' : 'empty'}`}
            {...pane.targetProps}
            items={p.tree ? p.tree.rows : p.entries}
            dependencies={[p.entries, p.selectedKeys, p.tree]}
            selectionMode="multiple"
            selectionBehavior="replace"
            disallowTypeAhead
            escapeKeyBehavior="none"
            selectedKeys={p.selectedKeys}
            onSelectionChange={p.onSelectionChange}
            onAction={(key) => p.onAction(String(key))}
            renderEmptyState={() => (p.emptyText ? <div className="list-empty">{p.emptyText}</div> : null)}
          >
            {(item: Entry | ChangeRow<Entry>) => {
              const row = 'files' in item ? item : null
              const e = row ? row.entry : (item as Entry)
              const id = row ? row.id : (item as Entry).path
              const owners = row ? row.files : [e!]
              const { dir, name } = splitPath(id)
              const closed = !!row?.folder && p.tree!.collapsed.has(id)
              const status = e ? (e.status === '?' ? 'A' : e.kind === 'conflicted' ? 'U' : e.status) : ''
              return (
                <GridListItem
                  ref={(el) => {
                    // A stale request (its row was never rendered) must not steal focus from elsewhere later.
                    if (el && focusRequest.current === id) {
                      focusRequest.current = null
                      const active = document.activeElement
                      if (!active || active === document.body || gridRef.current?.contains(active)) el.focus()
                    }
                  }}
                  id={id}
                  textValue={row?.folder ? row.name : name}
                  className={`file-row ${row?.folder ? 'folder-row' : ''}`}
                  style={row ? ({ '--indent': `${row.depth * CHANGE_TREE_INDENT}px` } as React.CSSProperties) : undefined}
                  onContextMenu={(ev) => {
                    ev.preventDefault()
                    live.current.onMenu(owners)
                  }}
                >
                  {row?.folder ? (
                    <FolderLabel
                      row={row}
                      collapsed={closed}
                      chevron={
                        <Button
                          className="row-chevron"
                          excludeFromTabOrder
                          aria-label={`${closed ? 'Expand' : 'Collapse'} ${row.name}`}
                          onPress={() => live.current.tree?.onToggle(id)}
                        >
                          <Icon name={closed ? 'chevronRight' : 'chevronDown'} size={14} />
                        </Button>
                      }
                    />
                  ) : (
                    <>
                      {row && <ChevronSpacer />}
                      <Tip label={e!.kind === 'untracked' ? 'Untracked' : (STATUS_LABEL[e!.status] ?? e!.status)} focusable={false}>
                        <span className={`status status-${status}`}>{e!.kind === 'untracked' ? '?' : status}</span>
                      </Tip>
                      <Tip label={e!.oldPath ? `${e!.oldPath} → ${e!.path}` : e!.path} focusable={false}>
                        <span className="file-name">{row ? row.name : name}</span>
                      </Tip>
                      <span className="file-dir">{row ? '' : dir}</span>
                    </>
                  )}
                  <span className="row-actions">{p.rowActions(owners)}</span>
                </GridListItem>
              )
            }}
          </GridList>
        </Virtualizer>
      </PaneFrame>
    </section>
  )
}

/** A row button that acts on just its own file. React Aria keeps its press from selecting the row. */
/** On a selected row it acts on every selected file (like Enter and the menu); `count` says how many. */
function RowButton({
  icon,
  label,
  count = 1,
  onPress
}: {
  icon: 'check' | 'undo' | 'plus' | 'minus' | 'merge'
  label: string
  count?: number
  onPress: () => void
}) {
  const text = count > 1 ? `${label} (${count} selected files)` : label
  return (
    <Tip label={text} placement="top">
      <Button className="icon-btn" aria-label={text} onPress={onPress} excludeFromTabOrder>
        <Icon name={icon} size={14} />
      </Button>
    </Tip>
  )
}

const STATE_TEXT = {
  merging: 'Merge in progress',
  rebasing: 'Rebase in progress',
  'cherry-picking': 'Cherry-pick in progress',
  reverting: 'Revert in progress'
}

/** Runs the merge tool on `files` (every conflicted file when empty); points to Git settings when none is configured. */
function runMergeTool(r: RepoCtx, files: string[]) {
  return r.run('Waiting for the merge tool', async () => {
    if (await api.openMergeTool(r.path, files)) return
    toast.withActions('No merge tool is set.', [{ label: 'Open Git settings', run: () => openPreferences('git') }])
  })
}

function OperationBanner({ r }: { r: RepoCtx }) {
  const st = r.status
  if (!st || st.state === 'clean') return null
  const conflicts = st.conflicted.length
  return (
    <div className="op-banner" data-pane-owner={conflicts ? 'files-conflicted' : 'files-unstaged'} onKeyDown={handleToolNavigation}>
      <Icon name="warning" />
      <div className="op-text">
        <strong>{STATE_TEXT[st.state]}</strong>
        <span>{conflicts ? `${conflicts} conflicted file(s) — resolve, then continue.` : 'All conflicts resolved.'}</span>
      </div>
      <div className="op-actions">
        <button
          className="btn"
          onClick={async () => {
            if (
              await confirm({
                title: 'Abort',
                message: `Abort the ${st.state.replace('ing', '')} and return to the previous state?`,
                ok: 'Abort',
                danger: true
              })
            )
              r.run('Aborting', () => api.abortOperation(r.path))
          }}
        >
          Abort
        </button>
        {conflicts > 0 && (
          <button className="btn" onClick={() => runMergeTool(r, [])}>
            Open merge tool
          </button>
        )}
        <button className="btn primary" disabled={conflicts > 0} onClick={() => r.run('Continuing', () => api.continueOperation(r.path))}>
          Continue
        </button>
      </div>
    </div>
  )
}
