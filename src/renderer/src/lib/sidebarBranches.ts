import type { Branch } from '../../../shared/types'

export interface SidebarBranchOptions {
  sort: 'name' | 'latest'
  hideGone: boolean
}

export const DEFAULT_BRANCH_OPTIONS: SidebarBranchOptions = { sort: 'name', hideGone: false }

export function readBranchOptions(value: string | null): SidebarBranchOptions {
  try {
    const saved = JSON.parse(value ?? '{}')
    return { sort: saved?.sort === 'latest' ? 'latest' : 'name', hideGone: saved?.hideGone === true }
  } catch {
    return DEFAULT_BRANCH_OPTIONS
  }
}

/** Only local branches can have a gone upstream; the checked-out branch always stays visible. */
export function sidebarBranches(branches: Branch[], current: string | null | undefined, options: SidebarBranchOptions) {
  return branches.filter((b) => !options.hideGone || b.type !== 'local' || !b.gone || b.name === current)
    .sort((a, b) => (options.sort === 'latest' ? b.date - a.date : 0) || a.name.localeCompare(b.name))
}
