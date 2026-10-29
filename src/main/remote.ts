/** Everything that talks to git about a repository's remote website. The rules live in `shared/remote`; this answers their questions. */
import { git } from './git'
import {
  decideRemotePage,
  knownProviderLabels,
  parseRemoteUrl,
  pullRequestUrl,
  remotePageUrl,
  type RemoteFacts,
  type RemotePageTarget
} from '../shared/remote'

/** More unpushed commits than this are not listed (opening or copying a page still checks the commit itself). */
const UNPUSHED_LIMIT = 5000

/** The remote to use when none is named: origin, else the first one. */
export async function defaultRemote(repo: string) {
  const remotes = (await git(repo, ['remote']))
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
  if (!remotes.length) throw new Error('This repository has no remotes configured.')
  return remotes.includes('origin') ? 'origin' : remotes[0]
}

/** One git config value (empty when unset). */
async function configValue(repo: string, key: string) {
  return (await git(repo, ['config', '--get', key], { okCodes: [1] })).trim()
}

/** The remote and remote branch name a local branch tracks; the default remote and the same name when it tracks nothing. */
async function trackedBranch(repo: string, branch: string) {
  const configured = await configValue(repo, `branch.${branch}.remote`)
  const remote = configured && configured !== '.' ? configured : await defaultRemote(repo)
  const name = (await configValue(repo, `branch.${branch}.merge`)).replace(/^refs\/heads\//, '') || branch
  return { remote, name }
}

/** The newest commit in the history of `hash` that a remote branch has (by commit date), or null when no remote branch shares any. */
async function newestPushedAncestor(repo: string, hash: string) {
  const refs = (await git(repo, ['for-each-ref', '--format=%(refname)', 'refs/remotes']))
    .split('\n')
    .filter((r) => r && !r.endsWith('/HEAD'))
  let best: { hash: string; time: number } | null = null
  for (const ref of refs) {
    const base = (await git(repo, ['merge-base', hash, ref], { okCodes: [1] })).trim()
    if (!base) continue
    const time = Number((await git(repo, ['log', '-1', '--format=%ct', base])).trim())
    if (!best || time > best.time) best = { hash: base, time }
  }
  return best?.hash ?? null
}

/** The rules' questions about `repo`, answered with git. */
function gitFacts(repo: string, remote: string): RemoteFacts {
  return {
    isOnRemote: async (hash) => Boolean((await git(repo, ['branch', '-r', '--contains', hash], { okCodes: [1, 129] })).trim()),
    newestPushedAncestor: (hash) => newestPushedAncestor(repo, hash),
    objectAt: async (hash, file) => (await git(repo, ['ls-tree', hash, '--', file])).trim().split(/\s+/)[2] ?? null,
    hasLocalEdits: async (file) => Boolean((await git(repo, ['status', '--porcelain', '--', file])).trim()),
    hasRemoteBranch: async (name) =>
      Boolean((await git(repo, ['rev-parse', '--verify', '-q', `refs/remotes/${remote}/${name}`], { okCodes: [1] })).trim())
  }
}

/** "GitHub, GitLab and Bitbucket": the providers Oak can open pull requests on. */
function supportedHosts() {
  const labels = knownProviderLabels()
  return labels.length > 1 ? `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}` : labels.join('')
}

/** The "new pull request" page for a pushed branch, on the remote it tracks (else origin). */
export async function pullRequestPage(repo: string, branch: string) {
  const { remote, name } = await trackedBranch(repo, branch)
  if (!(await gitFacts(repo, remote).hasRemoteBranch(name))) throw new Error(`Push "${branch}" first: it isn't on ${remote} yet.`)
  const remoteUrl = (await git(repo, ['remote', 'get-url', remote])).trim()
  const url = pullRequestUrl(remoteUrl, name)
  if (!url)
    throw new Error(
      `Oak doesn't know where ${remote} (${parseRemoteUrl(remoteUrl)?.host ?? remoteUrl}) hosts pull requests. ${supportedHosts()} are supported.`
    )
  return url
}

/**
 * The remote website's page for the repository, a branch, a commit or a file line, for opening or copying. It refuses any
 * page that would not open (see `decideRemotePage`). A `hash` of 'HEAD' means the current commit; a branch uses `remoteName`
 * (a remote-tracking branch), else the remote it tracks, else the default remote.
 */
export async function remotePage(repo: string, target: RemotePageTarget, remoteName?: string) {
  let remote = remoteName ?? (await defaultRemote(repo))
  let resolved = target
  if (target.kind === 'branch' && !remoteName) {
    const tracked = await trackedBranch(repo, target.name)
    remote = tracked.remote
    resolved = { kind: 'branch', name: tracked.name }
  } else if ((target.kind === 'commit' || target.kind === 'file') && target.hash === 'HEAD') {
    resolved = { ...target, hash: (await git(repo, ['rev-parse', 'HEAD'])).trim() }
  }
  const workingCopy = target.kind === 'file' && target.hash === 'HEAD'
  const decision = await decideRemotePage(resolved, remote, workingCopy, gitFacts(repo, remote))
  if (!decision.ok) throw new Error(decision.error)
  const remoteUrl = (await git(repo, ['remote', 'get-url', remote])).trim()
  const url = remotePageUrl(remoteUrl, decision.target)
  if (!url) throw new Error(`Oak can't tell where ${remote} (${remoteUrl}) is hosted.`)
  return url
}

/**
 * HEAD and the commits (up to a cap) that no remote branch contains, so menus can tell at once which pages would not open.
 * Without remotes there is nothing to open, and opening says so.
 */
export async function unpushedCommits(repo: string) {
  const head = (await git(repo, ['rev-parse', '--verify', '-q', 'HEAD'], { okCodes: [1] })).trim() || null
  if (!head || !(await git(repo, ['remote'])).trim()) return { head, unpushed: [] as string[] }
  const out = await git(repo, ['rev-list', '-n', String(UNPUSHED_LIMIT), 'HEAD', '--branches', '--not', '--remotes'])
  return { head, unpushed: out.split('\n').filter(Boolean) }
}
