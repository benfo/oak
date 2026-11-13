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

const samePath = (a: string, b: string) => {
  const plain = (p: string) => p.replace(/\\/g, '/').replace(/\/$/, '').toLowerCase()
  return plain(a) === plain(b)
}

/**
 * Opens a repository from the recent list. A folder that stopped being a repository of its own (a removed worktree
 * that left files behind) opens the repository around it, which looks like nothing happened: say so and forget it.
 */
export async function openRecent(dir: string): Promise<string | null> {
  const opened = await openFolder(dir)
  if (opened && !samePath(opened, dir)) {
    await api.removeRecent(dir)
    notify.warning(
      `${dir} is no longer a repository of its own. It is now a plain folder inside ${opened}, so it was removed from the recent list.`
    )
  }
  return opened
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
