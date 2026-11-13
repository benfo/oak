import type { Branch } from '../../../shared/types'

/** What a local branch's row says beside its name, the same in the sidebar and the branch switcher. */
export const branchBadges = (b: Branch): { text: string; warn?: boolean }[] => [
  ...(b.worktree ? [{ text: 'worktree' }] : []),
  ...(b.gone ? [{ text: 'gone', warn: true }] : []),
  ...(b.ahead ? [{ text: `↑${b.ahead}` }] : []),
  ...(b.behind ? [{ text: `↓${b.behind}` }] : [])
]
