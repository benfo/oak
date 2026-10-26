import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { api, errorMessage, repoName } from '../api'
import * as act from '../actions'
import { commandBinding, NAVIGATION_COMMANDS, type Command } from '../commands'
import { shortcutPlatform, useShortcutScope } from '../lib/useShortcuts'
import { requestPaneSearch } from '../lib/keymap'
import { activeDiffCopy } from '../diff/diffCopy'
import { copyDiffAsPatch, copyListItem, copyText } from '../lib/copy'
import { activeListCopy } from '../lib/listCopy'
import { shortcutBlockReason } from '../lib/shortcutPolicy'
import { focusFiles, focusPane } from '../lib/navigation'
import { WORKING_HASH, hasWorkingChanges } from '../../../shared/working.ts'
import { useRepo, type RepoCtx } from '../useRepo'
import { pickAndOpen } from '../repoActions'
import { showBranchPicker, showComparisonBranchPicker, showRepoPicker, showTagPicker } from '../pickers'
import { allThemes, loadCustomThemes, previewTheme, setTheme, themeSetting } from '../theme'
import type { Branch, Commit } from '../../../shared/types'
import type { CompareBranch } from '../lib/branchMenu'
import { Split } from './Split'
import { RESIZE_KEYS, resizeFocusedPane } from '../lib/paneResize'
import { Toolbar } from './Toolbar'
import { Sidebar } from '../sidebar/Sidebar'
import { publishActiveRepo } from '../sidebar/activeRepo'
import { HistoryView, type ComparisonRequest } from '../history/HistoryView'
import { ChangesView } from '../changes/ChangesView'
import { BlameView, type BlameRequest, type CommitTarget } from '../blame/BlameView'
import { openPalette, openShortcuts } from './Palette'
import { OutputDialog, showOutput } from './OpStatus'
import { APP_COMMANDS } from './Preferences'
import { getSettings, updateSettings, useSettings } from '../settings'
import { toggleChangesTree } from './TreeToggle'
import { getCommitFilesMode, setCommitFilesMode, toggleCommitFilesMode, useCommitFilesMode } from '../history/commitFilesMode'
import { toggleDiffLayout } from '../diff/diffLayout'
import { toggleWhitespace } from '../diff/toggleWhitespace'
import { changeDiffLayout } from '../diff/changeDiffLayout'
import { showLessContext, showMoreContext, toggleFullContext } from '../diff/useDiffContext'
import { toast } from '../ui'
import { openRepoOrGlobalConfig } from '../lib/useGitConfig'
import type { WorkspaceLayout } from './LayoutMenu'

export type View = 'changes' | 'history' | 'blame'

/** Focuses an element once the view switch has rendered. */
const focusLater = (selector: string) => setTimeout(() => document.querySelector<HTMLElement>(selector)?.focus(), 0)

export function RepoView({ repo, onSwitch }: { repo: string; onSwitch: (p: string | null) => void }) {
  const r = useRepo(repo)
  useEffect(() => {
    publishActiveRepo(r)
  })
  useEffect(() => () => publishActiveRepo(null), [])
  const [view, setViewState] = useState<View>('history')
  const [layout, setLayout] = useState<WorkspaceLayout>('standard')
  const lastWorkFocus = useRef<HTMLElement | null>(null)
  const restoreFocus = useRef<HTMLElement | null>(null)
  const setView = (next: View) => {
    if (next === 'changes') setCommitFilesMode('changes')
    setViewState(next)
  }
  const { sidebarHidden, autoFetchMinutes } = useSettings()
  useCommitFilesMode()
  const [focus, setFocus] = useState<{ hash: string; n: number; target?: CommitTarget } | null>(null)
  const [selectedCommit, setSelectedCommit] = useState<Commit | null>(null)
  const [comparisonRequest, setComparisonRequest] = useState<ComparisonRequest | null>(null)
  const compareBranch: CompareBranch = (source, target) => {
    setView('history')
    setComparisonRequest({ source, target, n: Date.now() })
  }

  const focusCommit = (hash: string, target?: CommitTarget) => {
    setView('history')
    setFocus({ hash, n: Date.now(), target })
  }

  const showFileHistory = (file: string) => {
    setView('history')
    r.setHistoryFile(file)
    focusLater('.commit-list')
  }

  // Blame stays open (and keeps its place) while other views are used; it closes only when asked.
  const [blame, setBlame] = useState<BlameRequest | null>(null)
  const blameFrom = useRef<'changes' | 'history'>('history')
  const showBlame = (file: string, rev: string | null) => {
    if (view !== 'blame') blameFrom.current = view
    setBlame({ file, rev, n: Date.now() })
    setView('blame')
  }
  const closeBlame = () => {
    setBlame(null)
    // Closed from the sidebar while another view is showing: that view stays.
    if (view !== 'blame') return
    setView(blameFrom.current)
    if (blameFrom.current === 'changes') setTimeout(focusFiles, 0)
    else focusLater('.commit-list')
  }
  const showBlameCommit = (hash: string | null, target: CommitTarget) => focusCommit(hash ?? WORKING_HASH, target)

  const sidebarVisible = !sidebarHidden && layout === 'standard'
  const focusMain = () => {
    if (layout === 'code' && focusPane('.view:not([hidden]) .diff')) return
    if (view === 'changes' && focusFiles()) return
    if (view === 'history' && focusPane('.commit-list')) return
    if (view === 'blame' && focusPane('.blame-view .diff')) return
    focusPane('[aria-label="Sidebar"]')
  }
  const revealPanes = () => flushSync(() => setLayout('standard'))
  const applyLayout = (next: WorkspaceLayout) => {
    if (layout === 'standard' && next !== 'standard') restoreFocus.current = lastWorkFocus.current
    flushSync(() => setLayout(next))
    if (next === 'code') focusPane('.view:not([hidden]) .diff') || focusPane('.view:not([hidden]) .file-list')
    else {
      const previous = restoreFocus.current
      if (previous?.isConnected && previous.offsetParent !== null && !previous.closest('[inert]')) previous.focus({ preventScroll: true })
      else focusMain()
    }
  }
  const toggleFocus = () => applyLayout(layout === 'standard' ? 'code' : 'standard')
  const setSidebarVisible = (visible: boolean) => {
    if (!visible && document.activeElement?.closest('.sidebar, #sidebar-divider')) {
      // Move focus before hiding its owner. Main-pane actions and selections stay intact.
      if (view === 'changes') focusFiles()
      else if (view === 'blame') focusPane('.blame-view .diff')
      else if (!focusPane('.commit-list')) focusPane('[data-pane="toolbar"] button')
    }
    flushSync(() => {
      setLayout('standard')
      updateSettings({ sidebarHidden: !visible })
    })
  }
  const focusSidebar = (search = false) => {
    setSidebarVisible(true)
    if (search) {
      focusPane('.sidebar-filter input')
      document.querySelector<HTMLInputElement>('.sidebar-filter input')?.select()
    } else focusPane('[data-pane="sidebar"]')
  }
  const commands = buildCommands({
    r,
    view,
    setView,
    onSwitch,
    selectedCommit,
    focusCommit,
    compareBranch,
    showFileHistory,
    blame,
    showBlame,
    sidebarHidden: !sidebarVisible,
    setSidebarVisible,
    focusSidebar,
    layout,
    revealPanes,
    toggleFocus
  })

  const focusMainRef = useRef(focusMain)
  focusMainRef.current = focusMain

  // Land in the commit graph once history has loaded, so arrows work straight away.
  const landed = useRef(false)
  useEffect(() => {
    if (landed.current || !r.commits.length) return
    landed.current = true
    if (document.activeElement === document.body) focusLater('.commit-list')
  }, [r.commits.length])

  // New conflicts (from Pull, Merge, Rebase, cherry-pick, stash pop) switch to Changes; focus stays where it is.
  const conflictCount = r.status?.conflicted.length ?? 0
  const hadConflicts = useRef(conflictCount > 0)
  useEffect(() => {
    if (conflictCount > 0 && !hadConflicts.current) setView('changes')
    hadConflicts.current = conflictCount > 0
  }, [conflictCount])

  // Automatic fetch (Preferences): quiet, never prompts for credentials, skipped while busy.
  const rRef = useRef(r)
  rRef.current = r
  useEffect(() => {
    if (!autoFetchMinutes) return
    let warned = false
    const id = setInterval(async () => {
      const cur = rRef.current
      if (cur.busy || !cur.branches.some((b) => b.type === 'remote')) return
      const error = await api.backgroundFetch(cur.path, getSettings().fetchPrune)
      if (!error) return cur.refresh()
      // Say so once; a repeating failure (e.g. needs a login) shouldn't nag every few minutes.
      if (!warned) toast.error(`Automatic fetch failed: ${error}`)
      warned = true
    }, autoFetchMinutes * 60_000)
    return () => clearInterval(id)
  }, [autoFetchMinutes, repo])

  useShortcutScope({
    id: 'workspace',
    priority: 10,
    bindings: [
      ...commands.filter((c) => c.keys && !c.global).map(commandBinding),
      // Shortcut only: a palette entry would add nothing to the key.
      ...RESIZE_KEYS.map((key) => ({
        id: `resize-pane-${key}`,
        keys: `Alt+Shift+${key}`,
        allowRepeat: true,
        enabled: layout === 'standard',
        disabledReason: layout === 'standard' ? undefined : 'Restore panes with F11 to resize',
        run: () => {
          resizeFocusedPane(key)
        }
      })),
      {
        id: 'recover-page-focus',
        keys: ['ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'],
        when: (context) => !!context.onPage,
        allowRepeat: true,
        run: () => focusMainRef.current()
      }
    ]
  })

  return (
    <div
      className="app"
      data-workspace-layout={layout}
      data-workspace-view={view}
      data-workspace-busy={!!r.busy}
      onFocusCapture={(e) => {
        const target = e.target as HTMLElement
        if (target.closest('main') && target.closest('[data-pane], [data-pane-owner], [data-search-pane]')) lastWorkFocus.current = target
      }}
    >
      <Toolbar
        r={r}
        onSwitch={onSwitch}
        layoutControls={{ layout, sidebarVisible, onSidebar: () => setSidebarVisible(!sidebarVisible), onToggleFocus: toggleFocus }}
      />
      <OutputDialog op={r.op} />
      <div className="app-body">
        <Split id="sidebar" label="Sidebar width" initial={260} min={180} max={520} collapsed={!sidebarVisible}>
          <Sidebar
            r={r}
            view={view}
            setView={setView}
            onFocusCommit={focusCommit}
            onCompareBranch={compareBranch}
            blameFile={blame?.file ?? null}
            onCloseBlame={closeBlame}
          />
          <main className="main">
            <div className="view" hidden={view !== 'changes'}>
              <ChangesView
                r={r}
                onBackToSidebar={() => focusSidebar()}
                focusCode={layout === 'code'}
                onFileHistory={showFileHistory}
                onBlame={showBlame}
              />
            </div>
            <div className="view" hidden={view !== 'history'}>
              <HistoryView
                r={r}
                focus={focus}
                comparisonRequest={comparisonRequest}
                onCompareBranch={compareBranch}
                onSelectedChange={setSelectedCommit}
                layout={layout}
                onBlame={showBlame}
                onOpenChanges={() => {
                  setView('changes')
                  setTimeout(focusFiles, 0)
                }}
              />
            </div>
            {blame && (
              <div className="view" hidden={view !== 'blame'}>
                <BlameView
                  key={blame.n}
                  repo={r.path}
                  request={blame}
                  status={r.status}
                  contentRevision={r.contentRevision}
                  active={view === 'blame'}
                  onOpenCommit={showBlameCommit}
                  onClose={closeBlame}
                />
              </div>
            )}
          </main>
        </Split>
      </div>
    </div>
  )
}

interface CommandCtx {
  r: RepoCtx
  view: View
  setView: (v: View) => void
  onSwitch: (p: string | null) => void
  selectedCommit: Commit | null
  focusCommit: (hash: string) => void
  compareBranch: CompareBranch
  showFileHistory: (file: string) => void
  blame: BlameRequest | null
  showBlame: (file: string, rev: string | null) => void
  sidebarHidden: boolean
  setSidebarVisible: (visible: boolean) => void
  focusSidebar: (search?: boolean) => void
  layout: WorkspaceLayout
  revealPanes: () => void
  toggleFocus: () => void
}

function buildCommands({
  r,
  view,
  setView,
  onSwitch,
  selectedCommit: c,
  focusCommit,
  compareBranch,
  showFileHistory,
  blame,
  showBlame,
  sidebarHidden,
  setSidebarVisible,
  focusSidebar,
  layout,
  revealPanes,
  toggleFocus
}: CommandCtx): Command[] {
  const st = r.status
  const hasRemotes = r.branches.some((b) => b.type === 'remote')
  const currentBranch = r.branches.find((b) => b.type === 'local' && b.current) ?? null
  const hasOtherBranch = r.branches.some((b) => b.type !== 'tag' && !b.current)
  const isHead = !!c && c.hash === st?.head
  const commitLabel = c ? c.hash.slice(0, 7) : ''

  const commands: Command[] = [
    // General
    { id: 'palette', title: 'Show all commands', category: 'General', keys: 'Ctrl+Shift+P', run: () => showCommandPalette(commands) },
    ...APP_COMMANDS,
    { id: 'palette-f1', title: 'Show all commands', category: 'General', keys: 'F1', run: () => showCommandPalette(commands) },
    {
      id: 'shortcuts',
      title: 'Keyboard shortcuts',
      category: 'General',
      keys: 'Ctrl+/',
      run: () => openShortcuts(commands.filter((x) => x.id !== 'palette-f1'))
    },
    {
      id: 'refresh',
      repositoryAction: true,
      requiresIdle: true,
      title: 'Refresh',
      category: 'General',
      keys: 'F5',
      run: () => r.refresh()
    },
    { id: 'show-output', title: 'Show git output (current or last operation)', category: 'General', run: showOutput },
    ...NAVIGATION_COMMANDS,

    // Repository
    {
      id: 'switch-repo',
      repositoryAction: true,
      title: 'Switch repository…',
      category: 'Repository',
      keys: 'Ctrl+P',
      run: () => showRepoPicker(r.path, onSwitch)
    },
    {
      id: 'open-repo',
      repositoryAction: true,
      title: 'Open repository…',
      category: 'Repository',
      keys: 'Ctrl+O',
      run: async () => {
        const p = await pickAndOpen()
        if (p) onSwitch(p)
      }
    },
    { id: 'close-repo', repositoryAction: true, title: 'Close repository', category: 'Repository', run: () => onSwitch(null) },
    {
      id: 'explorer',
      repositoryAction: true,
      title: 'Open in Explorer',
      category: 'Repository',
      keys: 'Ctrl+Shift+E',
      run: () => api.openPath(r.path)
    },
    {
      id: 'terminal',
      repositoryAction: true,
      title: 'Open terminal here',
      category: 'Repository',
      keys: 'Ctrl+`',
      run: () => api.openTerminal(r.path)
    },

    // View
    {
      id: 'compare-target',
      title: 'Compare current branch with its target',
      category: 'History',
      enabled: !!currentBranch && hasOtherBranch,
      run: () => compareBranch(currentBranch!, null)
    },
    {
      id: 'compare-branch',
      title: 'Compare current branch with…',
      category: 'History',
      enabled: !!currentBranch && hasOtherBranch,
      run: () => showComparisonBranchPicker(r, null, currentBranch!, (target) => compareBranch(currentBranch!, target))
    },
    {
      id: 'file-history',
      title: 'Show file history…',
      category: 'History',
      run: async () => {
        let files: string[]
        try {
          files = await api.commitTree(r.path, 'HEAD')
        } catch {
          toast.info('No committed files yet.')
          return
        }
        openPalette({
          placeholder: 'Show history of file…',
          items: files.map((f) => ({ id: f, label: f, run: () => showFileHistory(f) }))
        })
      }
    },
    {
      id: 'blame-file',
      title: 'Blame file…',
      category: 'History',
      run: async () => {
        let files: string[]
        try {
          files = await api.commitTree(r.path, 'HEAD')
        } catch {
          toast.info('No committed files yet.')
          return
        }
        openPalette({
          placeholder: 'Blame file…',
          items: files.map((f) => ({ id: f, label: f, run: () => showBlame(f, null) }))
        })
      }
    },
    ...(['all', 'head', 'lineage', 'target'] as const).map((kind): Command => ({
      id: `history-scope-${kind}`,
      category: 'History',
      title:
        kind === 'all'
          ? 'Show all branches'
          : kind === 'head'
            ? `Show ${st?.branch ? 'current branch only' : 'current commit only'}`
            : kind === 'lineage'
              ? `Show ${st?.branch ? 'current branch + full history' : 'current commit + ancestry'}`
              : `Show ${st?.branch ? 'current branch' : 'current commit'} + target`,
      enabled: r.historyScope !== kind,
      run: () => {
        setView('history')
        r.setHistoryScope(kind)
      }
    })),
    {
      id: 'view-changes',
      title: 'Go to Changes',
      category: 'View',
      keys: 'Ctrl+1',
      run: () => {
        setView('changes')
        if (layout === 'code') focusLater('.changes-diff .diff')
        else setTimeout(focusFiles, 0)
      }
    },
    {
      id: 'view-history',
      title: 'Go to History',
      category: 'View',
      keys: 'Ctrl+2',
      run: () => {
        setView('history')
        focusLater(layout === 'code' ? '.details-diff .diff' : '.commit-list')
      }
    },
    {
      id: 'view-blame',
      title: 'Go to Blame',
      category: 'View',
      keys: 'Ctrl+3',
      shortcutDisabledReason: blame ? undefined : 'Open a file blame first, from a file menu or Blame file…',
      run: () => {
        if (!blame) return toast.info('No blame is open. Use a file menu or Blame file…')
        setView('blame')
        focusLater('.blame-view .diff')
      }
    },
    {
      id: 'focus-commit-msg',
      revealsPanes: true,
      title: 'Write commit message',
      category: 'View',
      keys: 'Ctrl+K',
      run: () => {
        revealPanes()
        setView('changes')
        focusLater('.commit-box textarea')
      }
    },
    {
      id: 'focus-files',
      revealsPanes: true,
      title: 'Focus changed files',
      category: 'View',
      keys: 'Ctrl+Shift+1',
      run: () => {
        revealPanes()
        setView('changes')
        setTimeout(focusFiles, 0)
      }
    },
    {
      id: 'find-commit',
      revealsPanes: true,
      title: 'Find commit…',
      category: 'View',
      run: () => {
        revealPanes()
        setView('history')
        focusLater('.history-search')
      }
    },
    {
      id: 'find-in-pane',
      revealsPanes: true,
      widgetFallback: true,
      title: 'Find in focused pane…',
      category: 'View',
      keys: 'Ctrl+F',
      run: () => {
        const active = document.activeElement
        revealPanes()
        if (active?.closest('.sidebar')) {
          focusPane('.sidebar-filter input')
          document.querySelector<HTMLInputElement>('.sidebar-filter input')?.select()
          return
        }
        const selector = active?.closest('.commit-info, .details-diff')
          ? '.details-files'
          : view === 'changes'
            ? '.file-grid.lead'
            : '.commit-list'
        const visible = (query: string) => [...document.querySelectorAll<HTMLElement>(query)].find((el) => el.offsetParent !== null)
        const list = visible(selector) ?? (view === 'changes' ? (visible('.file-grid:not(.empty)') ?? visible('.file-grid')) : null)
        if (list) requestPaneSearch(list, shortcutPlatform())
        else focusPane('.history-search')
      }
    },
    {
      id: 'focus-graph',
      revealsPanes: true,
      title: 'Focus History commit list (graph)',
      category: 'View',
      keys: 'Ctrl+Shift+2',
      run: () => {
        revealPanes()
        setView('history')
        focusLater('.commit-list')
      }
    },
    {
      id: 'filter-branches',
      revealsPanes: true,
      title: 'Filter branches…',
      category: 'View',
      keys: 'Ctrl+L',
      run: () => focusSidebar(true)
    },
    { id: 'toggle-workspace-focus', title: 'Expand code area / restore previous layout', category: 'View', keys: 'F11', run: toggleFocus },
    { id: 'toggle-whitespace', title: 'Show / hide spaces and tabs in code', category: 'View', run: toggleWhitespace },
    {
      id: 'restore-workspace-layout',
      title: 'Restore previous layout',
      help: 'Restore expanded code after dismissing overlays and line selection',
      detail: 'Escape, after dismissing transient UI and line selection',
      category: 'View',
      keys: 'Escape',
      widgetFallback: true,
      enabled: layout === 'code',
      when: () => layout === 'code',
      run: toggleFocus
    },
    {
      id: 'toggle-changes-tree',
      title: getSettings().changesTree ? 'Show changed files as a list' : 'Show changed files as a tree',
      detail: 'V in a changed-file list or diff',
      category: 'View',
      run: toggleChangesTree
    },
    {
      id: 'toggle-commit-files-mode',
      title: getCommitFilesMode() === 'all' ? 'Show changed files' : 'Show all files',
      detail: 'T in the file list',
      category: 'History',
      enabled: view === 'history',
      run: toggleCommitFilesMode
    },
    {
      id: 'toggle-sidebar',
      revealsPanes: true,
      title: sidebarHidden ? 'Show sidebar' : 'Hide sidebar',
      category: 'View',
      run: () => setSidebarVisible(sidebarHidden)
    },
    {
      id: 'copy-diff-patch',
      title: 'Copy diff lines as patch',
      category: 'Diff',
      keys: 'Ctrl+Shift+C',
      when: () => !!activeDiffCopy(true),
      run: copyDiffAsPatch
    },
    {
      id: 'copy-alternate',
      title: 'Copy full path / commit hash of selection',
      category: 'View',
      keys: 'Ctrl+Shift+C',
      when: () => !!activeListCopy(),
      run: () => copyListItem(true)
    },
    {
      id: 'toggle-diff-layout',
      title: 'Toggle Inline / Side by side diff',
      category: 'View',
      keys: 'Ctrl+Shift+D',
      run: () => {
        const pane = [...document.querySelectorAll<HTMLElement>('[data-pane="diff"]')].find((el) => el.offsetParent !== null)
        if (pane) changeDiffLayout(toggleDiffLayout(getSettings().diffLayout, pane.clientWidth))
      }
    },
    { id: 'more-diff-context', title: 'Show more diff context', category: 'View', keys: 'Ctrl+Shift+=', run: showMoreContext },
    { id: 'less-diff-context', title: 'Show less diff context', category: 'View', keys: 'Ctrl+Shift+-', run: showLessContext },
    {
      id: 'full-diff-context',
      title: 'Show whole file / restore diff context',
      category: 'View',
      keys: 'Ctrl+Shift+W',
      run: toggleFullContext
    },
    { id: 'theme', title: 'Choose theme…', category: 'View', run: showThemePicker },
    { id: 'themes-folder', title: 'Open custom themes folder', category: 'View', run: () => api.openThemesFolder() },
    {
      id: 'open-repo-git-config',
      repositoryAction: true,
      title: 'Open repository git config',
      category: 'Repository',
      run: () => openRepoOrGlobalConfig(r.path, 'local')
    },
    {
      id: 'goto-head',
      title: 'Go to HEAD commit',
      category: 'View',
      keys: 'Ctrl+H',
      enabled: !!st?.head,
      run: () => st?.head && focusCommit(st.head)
    },
    {
      id: 'goto-working',
      title: 'Show working changes in History',
      category: 'View',
      enabled: hasWorkingChanges(st),
      run: () => focusCommit(WORKING_HASH)
    },
    {
      id: 'goto-tag',
      title: 'Go to tag…',
      category: 'View',
      enabled: r.branches.some((b) => b.type === 'tag'),
      run: () => showTagPicker(r, focusCommit)
    },

    // Changes
    {
      id: 'stage-all',
      repositoryAction: true,
      requiresIdle: true,
      title: 'Stage all changes',
      category: 'Changes',
      keys: 'Ctrl+Shift+A',
      enabled: !!st?.unstaged.length,
      run: () => r.run('Staging all', () => api.stageAll(r.path))
    },
    {
      id: 'unstage-all',
      repositoryAction: true,
      requiresIdle: true,
      title: 'Unstage all changes',
      category: 'Changes',
      keys: 'Ctrl+Shift+U',
      enabled: !!st?.staged.length,
      run: () => r.run('Unstaging all', () => api.unstageAll(r.path))
    },
    {
      id: 'stash',
      repositoryAction: true,
      requiresIdle: true,
      title: 'Stash changes…',
      category: 'Changes',
      keys: 'Ctrl+Shift+S',
      enabled: !!st && st.staged.length + st.unstaged.length > 0,
      run: () => act.stash(r)
    },
    {
      id: 'stash-pop',
      repositoryAction: true,
      requiresIdle: true,
      title: 'Pop latest stash',
      category: 'Changes',
      keys: 'Ctrl+Shift+O',
      enabled: r.stashes.length > 0,
      run: () => act.stashPop(r)
    },
    {
      id: 'stash-apply-pick',
      repositoryAction: true,
      requiresIdle: true,
      title: 'Apply stash…',
      category: 'Changes',
      enabled: r.stashes.length > 0,
      run: () =>
        openPalette({
          placeholder: 'Apply which stash?',
          items: r.stashes.map((s) => ({ id: s.ref, label: s.message, detail: s.ref, run: () => act.stashApply(r, s.ref) }))
        })
    },
    {
      id: 'abort-op',
      repositoryAction: true,
      requiresIdle: true,
      title: 'Abort merge / rebase / cherry-pick',
      category: 'Changes',
      enabled: !!st && st.state !== 'clean',
      run: () => r.run('Aborting', () => api.abortOperation(r.path))
    },
    {
      id: 'continue-op',
      repositoryAction: true,
      requiresIdle: true,
      title: 'Continue merge / rebase / cherry-pick',
      category: 'Changes',
      enabled: !!st && st.state !== 'clean' && !st.conflicted.length,
      run: () => r.run('Continuing', () => api.continueOperation(r.path))
    },

    // Branches
    {
      id: 'checkout-branch',
      repositoryAction: true,
      requiresIdle: true,
      title: 'Checkout branch…',
      category: 'Branch',
      keys: 'Ctrl+B',
      run: () => showBranchPicker(r)
    },
    {
      id: 'new-branch',
      repositoryAction: true,
      requiresIdle: true,
      title: 'New branch…',
      category: 'Branch',
      keys: 'Ctrl+Shift+B',
      enabled: !!st?.head,
      run: () => act.newBranch(r)
    },
    {
      id: 'merge-branch',
      repositoryAction: true,
      requiresIdle: true,
      title: 'Merge branch into current…',
      category: 'Branch',
      keys: 'Ctrl+Shift+M',
      run: () => pickRef(r, `Merge into ${st?.branch ?? 'HEAD'}…`, (name) => act.merge(r, name))
    },
    {
      id: 'rebase-branch',
      repositoryAction: true,
      requiresIdle: true,
      title: 'Rebase current branch onto…',
      category: 'Branch',
      keys: 'Ctrl+Shift+R',
      run: () => pickRef(r, `Rebase ${st?.branch ?? 'HEAD'} onto…`, (name) => act.rebase(r, name))
    },
    {
      id: 'delete-branch',
      repositoryAction: true,
      requiresIdle: true,
      title: 'Delete branch…',
      category: 'Branch',
      run: () =>
        openPalette({
          placeholder: 'Delete which branch?',
          items: r.branches
            .filter((b) => b.type === 'local' && !b.current)
            .map((b) => ({ id: b.fullName, label: b.name, run: () => act.deleteBranch(r, b.name) }))
        })
    },

    // Remote
    {
      id: 'fetch',
      repositoryAction: true,
      requiresIdle: true,
      title: 'Fetch all remotes',
      category: 'Remote',
      keys: 'Ctrl+Shift+F',
      enabled: hasRemotes,
      run: () => act.fetchAll(r)
    },
    {
      id: 'pull',
      repositoryAction: true,
      requiresIdle: true,
      title: 'Pull',
      category: 'Remote',
      keys: 'Ctrl+Shift+L',
      enabled: !!st?.upstream,
      run: () => act.pull(r)
    },
    {
      id: 'pull-rebase',
      repositoryAction: true,
      requiresIdle: true,
      title: 'Pull (rebase)',
      category: 'Remote',
      enabled: !!st?.upstream,
      run: () => act.pull(r, 'rebase')
    },
    {
      id: 'pull-merge',
      repositoryAction: true,
      requiresIdle: true,
      title: 'Pull (merge)',
      category: 'Remote',
      enabled: !!st?.upstream,
      run: () => act.pull(r, 'merge')
    },
    {
      id: 'pull-ff',
      repositoryAction: true,
      requiresIdle: true,
      title: 'Pull (fast-forward only)',
      category: 'Remote',
      enabled: !!st?.upstream,
      run: () => act.pull(r, 'ff-only')
    },
    {
      id: 'push',
      repositoryAction: true,
      requiresIdle: true,
      title: 'Push',
      category: 'Remote',
      keys: 'Ctrl+Shift+K',
      enabled: !!st?.branch,
      run: () => act.push(r)
    },
    {
      id: 'open-pull-request',
      title: 'Open pull request for current branch',
      category: 'Remote',
      enabled: !!st?.branch && hasRemotes,
      run: () => act.openPullRequest(r)
    },

    // Selected commit (History)
    ...(view === 'history' && c
      ? ([
          {
            id: 'c-checkout',
            repositoryAction: true,
            requiresIdle: true,
            title: `Checkout ${commitLabel} (detached)`,
            detail: c.subject,
            category: 'Commit',
            run: () => act.checkout(r, c.hash, 'detached')
          },
          {
            id: 'c-branch',
            repositoryAction: true,
            requiresIdle: true,
            title: `Create branch at ${commitLabel}…`,
            help: 'Create branch at selected commit',
            detail: c.subject,
            category: 'Commit',
            keys: 'Ctrl+Alt+B',
            run: () => act.newBranch(r, c.hash)
          },
          {
            id: 'c-tag',
            repositoryAction: true,
            requiresIdle: true,
            title: `Create tag at ${commitLabel}…`,
            help: 'Create tag at selected commit',
            detail: c.subject,
            category: 'Commit',
            keys: 'Ctrl+Alt+T',
            run: () => act.createTag(r, c.hash)
          },
          {
            id: 'c-pick',
            repositoryAction: true,
            requiresIdle: true,
            title: `Cherry-pick ${commitLabel}`,
            detail: c.subject,
            category: 'Commit',
            enabled: !isHead,
            run: () => act.cherryPick(r, c)
          },
          {
            id: 'c-revert',
            repositoryAction: true,
            requiresIdle: true,
            title: `Revert ${commitLabel}…`,
            detail: c.subject,
            category: 'Commit',
            run: () => act.revert(r, c)
          },
          {
            id: 'c-reset-soft',
            repositoryAction: true,
            requiresIdle: true,
            title: `Reset (soft) to ${commitLabel}…`,
            detail: c.subject,
            category: 'Commit',
            enabled: !isHead,
            run: () => act.reset(r, c, 'soft')
          },
          {
            id: 'c-reset-mixed',
            repositoryAction: true,
            requiresIdle: true,
            title: `Reset (mixed) to ${commitLabel}…`,
            detail: c.subject,
            category: 'Commit',
            enabled: !isHead,
            run: () => act.reset(r, c, 'mixed')
          },
          {
            id: 'c-reset-hard',
            repositoryAction: true,
            requiresIdle: true,
            title: `Reset (hard) to ${commitLabel}…`,
            detail: c.subject,
            category: 'Commit',
            enabled: !isHead,
            run: () => act.reset(r, c, 'hard')
          },
          {
            id: 'c-copy',
            title: `Copy hash of ${commitLabel}`,
            help: 'Copy hash of selected commit',
            detail: c.subject,
            category: 'Commit',
            run: () => copyText(c.hash, 'commit hash')
          }
        ] as Command[])
      : [])
  ]
  return commands.map((command) => ({
    ...command,
    enabled: command.enabled !== false && (!command.requiresIdle || !r.busy),
    shortcutDisabledReason: shortcutBlockReason(command, { editing: false, expanded: layout, busy: !!r.busy })
  }))
}

async function showThemePicker() {
  await loadCustomThemes()
  const current = themeSetting()
  const mark = (id: string) => (id === current ? 'current' : undefined)
  openPalette({
    placeholder: 'Choose a theme…  (↑↓ preview, Enter keeps, Esc reverts)',
    onHighlight: previewTheme,
    seeThrough: true,
    onCancel: () => previewTheme(null),
    items: [
      { id: 'system', label: 'Follow system (light or dark)', detail: mark('system'), run: () => setTheme('system') },
      ...allThemes().map((t) => ({ id: t.id, label: t.name, detail: mark(t.id), run: () => setTheme(t.id) }))
    ]
  })
}

function showCommandPalette(commands: Command[]) {
  openPalette({
    kind: 'commands',
    placeholder: 'Type a command…',
    recentKey: 'recentCommands',
    items: commands
      .filter((c) => c.enabled !== false && c.id !== 'palette-f1')
      .map((c) => ({
        id: c.id,
        label: c.title,
        category: c.category,
        detail: c.detail,
        hint: c.shortcutDisabledReason ? undefined : c.keys,
        run: c.run
      }))
  })
}

function pickRef(r: RepoCtx, placeholder: string, run: (name: string) => void) {
  openPalette({
    placeholder,
    items: r.branches
      .filter((b) => !b.current)
      .map((b) => ({
        id: b.fullName,
        label: b.name,
        category: b.type === 'local' ? 'Branch' : b.type === 'remote' ? 'Remote' : 'Tag',
        detail: b.subject,
        run: () => run(b.name)
      }))
  })
}
