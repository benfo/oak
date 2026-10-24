import { useEffect, useRef, useState } from 'react'
import { api, repoName } from './api'
import { openFolder } from './repoActions'
import { CloneHost, Welcome } from './components/Welcome'
import { GitMissing } from './components/GitMissing'
import { RepoView } from './components/RepoView'
import { DialogHost, Toasts, toast } from './ui'
import { PaletteHost } from './components/Palette'
import { ContextMenuHost } from './components/ContextMenu'
import { commandBinding, NAVIGATION_COMMANDS } from './commands'
import { useShortcutRoot, useShortcutScope } from './lib/useShortcuts'
import { APP_COMMANDS, PreferencesHost } from './components/Preferences'
import { getSettings } from './settings'
import { UpdateNotice } from './components/UpdateNotice'
import { WhatsNewHost } from './components/WhatsNew'
import { useWheelZoom } from './lib/useWheelZoom'
import { copyFocused, hasTextSelection } from './lib/copy'
import { activeDiffCopy } from './diff/diffCopy'
import { activeListCopy } from './lib/listCopy'

const LAST_REPO = 'lastRepo'

export default function App() {
  useShortcutRoot(toast.info)
  useWheelZoom()
  useShortcutScope({
    id: 'app',
    bindings: [
      ...[...APP_COMMANDS, ...NAVIGATION_COMMANDS].filter((c) => c.keys).map(commandBinding),
      {
        id: 'copy',
        keys: 'Mod+C',
        allowInOverlay: true,
        widgetFallback: true,
        when: () => hasTextSelection() || !!activeDiffCopy(true) || !!activeListCopy(),
        run: copyFocused
      },
      {
        id: 'select-all',
        keys: 'Mod+A',
        allowInOverlay: true,
        widgetFallback: true,
        run: () => {
          const el = document.activeElement as HTMLElement | null
          const text = el?.matches('.diff')
            ? (el.querySelector('.diff-inner') ??
              el.querySelector(
                `.side-column[data-side="${el.querySelector('.dl.cursor')?.getAttribute('data-side') ?? 'new'}"] .side-inner`
              ))
            : el?.closest('.op-output, .commit-meta')
          if (text) window.getSelection()?.selectAllChildren(text)
        }
      }
    ]
  })
  const [repo, setRepo] = useState<string | null>(() => (getSettings().reopenLastRepo ? localStorage.getItem(LAST_REPO) : null))
  // Nothing works without git, so say so up front (with a way to fix it) rather than failing later.
  // undefined while checking: nothing that runs git starts until we know it can.
  const [gitError, setGitError] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    api.gitInfo().then((info) => setGitError(info.error))
  }, [])

  // Open a repo passed on the command line, else reopen the last one (falling back to the welcome screen).
  // Only once git works, or a missing git would make us forget the last repo.
  const launched = useRef(false)
  useEffect(() => {
    if (gitError !== null || launched.current) return
    launched.current = true
    api.launchPath().then(async (dir) => {
      if (dir) {
        const opened = await openFolder(dir)
        if (opened) return setRepo(opened)
      }
      if (repo) api.openRepo(repo).catch(() => setRepo(null))
    })
  }, [gitError])

  // A folder opened from Explorer or `oak <path>` while Oak is already running.
  useEffect(
    () =>
      window.bridge.onOpenPath(async (dir) => {
        const opened = await openFolder(dir)
        if (opened) setRepo(opened)
      }),
    []
  )

  // Remember the open repo; forget it only when one is closed (not when we simply started without one).
  const hadRepo = useRef(false)
  useEffect(() => {
    if (repo) localStorage.setItem(LAST_REPO, repo)
    else if (hadRepo.current) localStorage.removeItem(LAST_REPO)
    hadRepo.current = !!repo
    document.title = repo ? `${repoName(repo)} — Oak` : 'Oak'
  }, [repo])

  return (
    <>
      {gitError === undefined ? null : gitError ? (
        <GitMissing error={gitError} onFixed={() => setGitError(null)} />
      ) : repo ? (
        <RepoView key={repo} repo={repo} onSwitch={setRepo} />
      ) : (
        <Welcome onOpen={setRepo} />
      )}
      <Toasts />
      <UpdateNotice />
      <WhatsNewHost />
      <PaletteHost />
      <ContextMenuHost />
      <CloneHost />
      <DialogHost />
      <PreferencesHost repo={repo} />
    </>
  )
}
