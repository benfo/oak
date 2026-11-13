import { api, errorMessage } from './api'
import { confirm } from './ui'
import { notify } from './notices'

/** Opens a folder as a repository, offering to initialise one if it isn't. Returns the repo root. */
export async function openFolder(dir: string): Promise<string | null> {
  try {
    return await api.openRepo(dir)
  } catch (e) {
    const msg = errorMessage(e)
    if (/not a git repository/i.test(msg)) {
      const ok = await confirm({
        title: 'Not a Git repository',
        message: `${dir}\n\nThis folder isn't a Git repository. Initialise a new repository here?`,
        ok: 'Initialise'
      })
      if (!ok) return null
      try {
        return await api.initRepo(dir)
      } catch (e2) {
        notify.error(errorMessage(e2))
        return null
      }
    }
    notify.error(msg)
    return null
  }
}

let showRepo: (repo: string) => void = () => {}

/** The app says how the open repository changes, so a flow far from it (a branch's worktree) can ask for another. */
export function onShowRepo(show: (repo: string) => void) {
  showRepo = show
}

/** Shows another worktree of this repository in place of the open one. */
export async function openWorktree(dir: string) {
  const opened = await openFolder(dir)
  if (opened) showRepo(opened)
}

export async function pickAndOpen(): Promise<string | null> {
  const dir = await api.pickFolder('Open repository')
  return dir ? openFolder(dir) : null
}
