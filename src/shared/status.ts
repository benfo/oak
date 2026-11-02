/** Timings and wording for the status bar; pure so they are unit tested without a UI. */
import type { RebaseStep } from './rebaseStep'
import type { RepoState } from './types'

/** Quick operations finish before this and show only their result, never a flash of progress. */
export const PROGRESS_DELAY_MS = 300
/** How long a result stays in the bar before the idle content returns. */
export const RESULT_MS = 4000

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** "3 minutes ago", at the coarseness a person reads it; "just now" for the first minute. */
export function agoText(at: number, now: number, locale?: string): string {
  const age = Math.max(0, now - at)
  if (age < MINUTE) return 'just now'
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'always' })
  if (age < HOUR) return rtf.format(-Math.floor(age / MINUTE), 'minute')
  if (age < DAY) return rtf.format(-Math.floor(age / HOUR), 'hour')
  return rtf.format(-Math.floor(age / DAY), 'day')
}

/** "Fetched 3 minutes ago"; null means this repository never fetched. */
export function fetchedText(at: number | null, now: number, locale?: string): string {
  return at === null ? 'Not fetched yet' : `Fetched ${agoText(at, now, locale)}`
}

/** The commit a branch tip points at, as far as the status bar needs it. `time` is Unix seconds. */
export interface TipCommit {
  hash: string
  author: string
  email: string
  time: number
  subject: string
}

/** Whether the commit is by the person using Oak: the same email as their git identity, ignoring case. */
export const isYou = (commit: TipCommit, identityEmail: string | null) =>
  !!identityEmail && commit.email.trim().toLowerCase() === identityEmail.trim().toLowerCase()

/** "You, 2 hours ago" or "Ben Fourie, 3 days ago". */
export function tipCommitText(commit: TipCommit, identityEmail: string | null, now: number, locale?: string): string {
  return `${isYou(commit, identityEmail) ? 'You' : commit.author}, ${agoText(commit.time * 1000, now, locale)}`
}

const IN_PROGRESS: Record<Exclude<RepoState, 'clean'>, string> = {
  merging: 'Merging',
  rebasing: 'Rebasing',
  'cherry-picking': 'Cherry-picking',
  reverting: 'Reverting'
}

/** The status bar's line for an operation Git is part-way through; null when the repository is clean. */
export function repoStateText(state: RepoState, conflicts: number, step?: RebaseStep): string | null {
  if (state === 'clean') return null
  const detail = conflicts === 0 ? 'ready to continue' : `${conflicts} ${conflicts === 1 ? 'conflict' : 'conflicts'}`
  const where = state === 'rebasing' && step ? ` ${step.current}/${step.total}` : ''
  return `${IN_PROGRESS[state]}${where}: ${detail}`
}

/** How the automatic fetch preference reads in a hover card. */
export function autoFetchText(minutes: number): string {
  if (minutes <= 0) return 'Automatic fetch is off'
  return minutes === 1 ? 'Automatic fetch every minute' : `Automatic fetch every ${minutes} minutes`
}
