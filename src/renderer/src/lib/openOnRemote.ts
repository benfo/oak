import { api, errorMessage } from '../api'
import type { RemotePageTarget } from '../../../shared/remote'
import type { Branch } from '../../../shared/types'
import { toast } from '../ui'

/** Opens the repository, a branch, a commit or a file line on the remote's website. A `hash` of 'HEAD' means the current commit. */
export async function openOnRemote(repo: string, target: RemotePageTarget, remoteName?: string) {
  try {
    await api.openUrl(await api.remotePage(repo, target, remoteName))
  } catch (e) {
    toast.error(errorMessage(e))
  }
}

/** Copies the same page's link. A commit that isn't on a remote yet has no page to link to, so that is an error. */
export async function copyRemoteLink(repo: string, target: RemotePageTarget, what: string, remoteName?: string) {
  try {
    await api.copyText(await api.remotePage(repo, target, remoteName))
    toast.brief(`Copied ${what}`)
  } catch (e) {
    toast.error(errorMessage(e))
  }
}

/** A branch row as a remote page: a remote-tracking branch names its remote (`origin/main`); a local one uses the remote it tracks. */
export function branchRemotePage(b: Branch): { target: RemotePageTarget; remoteName?: string } {
  if (b.type !== 'remote') return { target: { kind: 'branch', name: b.name } }
  const slash = b.name.indexOf('/')
  return { target: { kind: 'branch', name: b.name.slice(slash + 1) }, remoteName: b.name.slice(0, slash) }
}
