import { api, errorMessage } from './api'
import { confirm, toast } from './ui'

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
        toast.error(errorMessage(e2))
        return null
      }
    }
    toast.error(msg)
    return null
  }
}

export async function pickAndOpen(): Promise<string | null> {
  const dir = await api.pickFolder('Open repository')
  return dir ? openFolder(dir) : null
}
