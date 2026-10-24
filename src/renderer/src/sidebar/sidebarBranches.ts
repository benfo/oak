import type { Branch } from '../../../shared/types'

export interface SidebarBranchOptions {
  sort: 'name' | 'latest'
  hideGone: boolean
  /** Globs (`*` matches anything, including `/`) for local and remote branch names, without the remote prefix. A name without `*` hides just that branch. */
  hiddenPatterns: string[]
  /** Hides remote branches that no local branch tracks or shares a name with, except the remote's default branch. */
  hideRemoteOnly: boolean
  /** Reveals hidden branches without forgetting the settings. Never saved: it resets when the repository opens. */
  showHidden: boolean
}

export const DEFAULT_BRANCH_OPTIONS: SidebarBranchOptions = {
  sort: 'name',
  hideGone: false,
  hiddenPatterns: [],
  hideRemoteOnly: false,
  showHidden: false
}

export function readBranchOptions(value: string | null): SidebarBranchOptions {
  try {
    const saved = JSON.parse(value ?? '{}')
    const patterns: unknown[] = Array.isArray(saved?.hiddenPatterns) ? saved.hiddenPatterns : []
    return {
      sort: saved?.sort === 'latest' ? 'latest' : 'name',
      hideGone: saved?.hideGone === true,
      hideRemoteOnly: saved?.hideRemoteOnly === true,
      hiddenPatterns: patterns.filter((p): p is string => typeof p === 'string' && p.trim() !== ''),
      showHidden: false
    }
  } catch {
    return DEFAULT_BRANCH_OPTIONS
  }
}

const globRegex = (glob: string) =>
  new RegExp(
    `^${glob
      .split('*')
      .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
      .join('.*')}$`
  )

const optionsKey = (repo: string) => `sidebarBranches:${repo}`

export function loadBranchOptions(repo: string): SidebarBranchOptions {
  try {
    return readBranchOptions(localStorage.getItem(optionsKey(repo)))
  } catch {
    return DEFAULT_BRANCH_OPTIONS
  }
}

export function saveBranchOptions(repo: string, options: SidebarBranchOptions) {
  try {
    const { showHidden: _session, ...saved } = options
    localStorage.setItem(optionsKey(repo), JSON.stringify(saved))
  } catch {
    /* Session only. */
  }
}

/** A branch's name as patterns see it: a remote branch without its remote (`origin/dependabot/x` is `dependabot/x`). */
const patternName = (b: Branch) => (b.type === 'remote' ? b.name.split('/').slice(1).join('/') : b.name)

/** Whether a pattern names this local or remote branch, ignoring the checked-out exception. */
const matchesPattern = (b: Branch, pattern: string) => b.type !== 'tag' && globRegex(pattern.trim()).test(patternName(b))

/** The patterns the branch menu offers: the branch itself, and its first folder (`dependabot/*`) when it has one. */
export function suggestHidePatterns(b: Branch) {
  const name = patternName(b)
  const slash = name.indexOf('/')
  return slash > 0 ? { exact: name, folder: `${name.slice(0, slash)}/*` } : { exact: name, folder: null }
}

/** Only local and remote branches can be hidden by pattern; the checked-out branch always stays visible. */
export function matchesHiddenPattern(b: Branch, current: string | null | undefined, patterns: string[]) {
  if (b.type === 'local' && b.name === current) return false
  return patterns.some((p) => matchesPattern(b, p))
}

/** How many branches the patterns hide right now (the checked-out branch is never counted). */
export function hiddenBranchCount(branches: Branch[], current: string | null | undefined, patterns: string[]) {
  return branches.filter((b) => matchesHiddenPattern(b, current, patterns)).length
}

/** The branches one pattern hides right now, by name. */
export function branchesHiddenBy(branches: Branch[], current: string | null | undefined, pattern: string) {
  return branches.filter((b) => matchesHiddenPattern(b, current, [pattern])).map((b) => b.name)
}

/**
 * Remote branches that stay visible while remote-only branches are hidden: tracked by a local branch, named like
 * one, or the remote's default branch (`remoteHead`, for example `origin/main`).
 */
function keptRemoteBranches(branches: Branch[], remoteHead: string | null) {
  const locals = new Set(branches.filter((b) => b.type === 'local').map((b) => b.name))
  const tracked = new Set(branches.flatMap((b) => (b.type === 'local' && b.upstream ? [b.upstream] : [])))
  return (b: Branch) => b.name === remoteHead || tracked.has(b.name) || locals.has(b.name.slice(b.name.indexOf('/') + 1))
}

/** The full refs hidden by patterns or by the remote-only rule, ignoring the reveal toggle. The checked-out branch is never in it. */
export function hiddenBranchRefs(
  branches: Branch[],
  current: string | null | undefined,
  options: SidebarBranchOptions,
  remoteHead: string | null
) {
  const kept = options.hideRemoteOnly ? keptRemoteBranches(branches, remoteHead) : null
  return new Set(
    branches
      .filter((b) => matchesHiddenPattern(b, current, options.hiddenPatterns) || (!!kept && b.type === 'remote' && !kept(b)))
      .map((b) => b.fullName)
  )
}

/**
 * Remote refs the graph keeps while remote-only branches are hidden, or null when that rule is off. The graph
 * excludes every remote ref in one glob and lists just these, so the command line stays short in a big repository.
 */
export function visibleRemoteRefs(branches: Branch[], options: SidebarBranchOptions, remoteHead: string | null) {
  if (options.showHidden || !options.hideRemoteOnly) return null
  const kept = keptRemoteBranches(branches, remoteHead)
  return branches
    .filter((b) => b.type === 'remote' && kept(b) && !options.hiddenPatterns.some((p) => matchesPattern(b, p)))
    .map((b) => b.fullName)
}

/**
 * Full-ref globs for the history graph (`git log --exclude` and `--decorate-refs-exclude`), spelled out per
 * remote so they match exactly what the sidebar hides. Git cannot exempt a ref from a glob, so a pattern that
 * also matches the checked-out branch is listed as the individual refs it hides instead.
 */
export function hiddenRefGlobs(branches: Branch[], options: SidebarBranchOptions) {
  if (options.showHidden || !options.hiddenPatterns.length) return []
  const current = branches.find((b) => b.type === 'local' && b.current)?.name
  const remotes = [...new Set(branches.filter((b) => b.type === 'remote').map((b) => b.name.split('/')[0]))]
  return options.hiddenPatterns.flatMap((raw) => {
    const pattern = raw.trim()
    if (current && matchesPattern({ name: current, type: 'local' } as Branch, pattern))
      return branches.filter((b) => matchesHiddenPattern(b, current, [pattern])).map((b) => b.fullName)
    const p = pattern.replace(/[?[\\]/g, '\\$&')
    return [`refs/heads/${p}`, ...remotes.map((remote) => `refs/remotes/${remote}/${p}`)]
  })
}

/** Only local branches can have a gone upstream; the checked-out branch always stays visible. */
export function sidebarBranches(
  branches: Branch[],
  current: string | null | undefined,
  options: SidebarBranchOptions,
  remoteHead: string | null = null
) {
  const hidden = options.showHidden ? null : hiddenBranchRefs(branches, current, options, remoteHead)
  return branches
    .filter((b) => !options.hideGone || b.type !== 'local' || !b.gone || b.name === current)
    .filter((b) => !hidden?.has(b.fullName))
    .sort((a, b) => (options.sort === 'latest' ? b.date - a.date : 0) || a.name.localeCompare(b.name))
}
