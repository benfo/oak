import type { Command } from './commands'
import type { RepoCtx } from './useRepo'
import { rewriteCommits } from './rewriteActions'

/** Squash and fixup for what History has selected: its range, or its one commit. Running one that cannot work says why. */
export function rewriteCommands(r: RepoCtx, selection: string[]): Command[] {
  if (!selection.length) return []
  const what = selection.length > 1 ? `${selection.length} selected commits` : 'selected commit into previous'
  return [
    {
      id: 'c-squash',
      repositoryAction: true,
      requiresIdle: true,
      title: `Squash ${what}…`,
      help: 'Squash selected commits',
      category: 'Commit',
      run: () => void rewriteCommits(r, selection, 'squash')
    },
    {
      id: 'c-fixup',
      repositoryAction: true,
      requiresIdle: true,
      title: `Fixup ${what}`,
      help: 'Fixup selected commits',
      category: 'Commit',
      run: () => void rewriteCommits(r, selection, 'fixup')
    }
  ]
}
