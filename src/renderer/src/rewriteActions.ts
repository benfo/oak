import { api } from './api'
import { reportOpError, runOp, short } from './actions'
import type { RepoCtx } from './useRepo'
import { confirm, prompt, toast } from './ui'
import {
  combinedMessage,
  isReadyToRewrite,
  planRewrite,
  type RewriteMode,
  type RewritePlan,
  type RewriteResult
} from '../../shared/rewrite'

const REWRITE_WORDS: Record<RewriteMode, { name: string; busy: string; done: string }> = {
  squash: { name: 'Squash', busy: 'Squashing', done: 'Squashed' },
  fixup: { name: 'Fixup', busy: 'Fixing up', done: 'Fixed up' }
}

export function checkRewrite(r: RepoCtx, selection: string[], mode: RewriteMode) {
  return planRewrite({
    commits: r.commits,
    selection,
    mode,
    head: r.status?.head ?? null,
    clean: isReadyToRewrite(r.status),
    filtered: !!(r.historyFile || r.commitsFile)
  })
}

/** Without remote branches nothing can be pushed, and the unpushed list would call every commit pushed. */
async function pushedWarning(r: RepoCtx, plan: RewritePlan) {
  if (!r.branches.some((b) => b.type === 'remote')) return undefined
  try {
    const { unpushed } = await api.unpushedCommits(r.path)
    const local = new Set(unpushed)
    const pushed = plan.affected.filter((h) => !local.has(h)).length
    if (!pushed) return undefined
    return `${pushed} of the ${plan.affected.length} commits this rewrites ${pushed === 1 ? 'is' : 'are'} already pushed, so your next push will need a force push.`
  } catch {
    return undefined
  }
}

async function undo(r: RepoCtx, result: RewriteResult) {
  await runOp(r, 'Undoing', () => api.undoRewrite(r.path, result), 'Restored the branch to how it was')
}

/** Squash keeps the combined message the user edits; fixup keeps the oldest commit's message. */
export async function rewriteCommits(r: RepoCtx, selection: string[], mode: RewriteMode) {
  const words = REWRITE_WORDS[mode]
  const check = checkRewrite(r, selection, mode)
  if (!check.ok) return toast.error(`${words.name}: ${check.reason}`)
  const { plan } = check
  const subjects = new Map(r.commits.map((c) => [c.hash, c.subject]))
  const count = plan.combined.length
  const items = plan.combined.map((h) => ({ lead: short(h), text: subjects.get(h) ?? '' }))
  const warning = await pushedWarning(r, plan)

  let message = ''
  if (mode === 'squash') {
    const answer = await prompt({
      title: `Squash ${count} commits`,
      message: 'These commits become one.',
      items,
      warning,
      label: 'Message',
      initial: combinedMessage(await api.commitMessages(r.path, plan.combined)),
      multiline: true,
      caretAtEnd: true,
      ok: 'Squash'
    })
    if (!answer) return
    message = answer.value
  } else {
    const rest = count - 1
    const ok = await confirm({
      title: `Fixup into ${short(plan.combined[0])}`,
      message: `The changes from ${rest === 1 ? 'the newer commit' : `the other ${rest} commits`} are kept. Their messages are discarded.`,
      items,
      warning,
      ok: 'Fixup'
    })
    if (!ok) return
  }

  try {
    const result = await r.withBusy(words.busy, () => api.rewriteCommits(r.path, plan, message))
    toast.withActions(`${words.done} ${count} commits`, [{ label: 'Undo', run: () => void undo(r, result) }])
  } catch (e) {
    reportOpError(r, e)
  }
}
