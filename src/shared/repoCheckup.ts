import { cleanupNote, type BranchCleanup } from './branchCleanup.ts'
import type { RepoState } from './types'

/** What `git count-objects -v` reports, in bytes. */
export interface RepoStorage {
  looseCount: number
  looseBytes: number
  packs: number
  packBytes: number
}

export interface RepoCheckup {
  cleanup: BranchCleanup
  storage: RepoStorage
  /** An `index.lock` that has sat there for a while, which makes git refuse to work. */
  staleLock: boolean
}

/** A row of the check-up's checklist; the id says what ticking it does. */
export interface CheckupRow {
  id: string
  group: string
  label: string
  note: string
  warn: boolean
  checked: boolean
}

export const COMPACT_ID = 'compact'
const BRANCH_ID = 'branch:'

/** Loose objects or packs beyond which compacting is worth suggesting; below it git is already tidy. */
const MANY_LOOSE = 1000
const MANY_PACKS = 10

export function parseCountObjects(out: string): RepoStorage {
  const field = (name: string) => Number(new RegExp(`^${name}: (\\d+)`, 'm').exec(out)?.[1] ?? 0)
  return { looseCount: field('count'), looseBytes: field('size') * 1024, packs: field('packs'), packBytes: field('size-pack') * 1024 }
}

export const storageBytes = (s: RepoStorage) => s.looseBytes + s.packBytes

export const worthCompacting = (s: RepoStorage) => s.looseCount >= MANY_LOOSE || s.packs > MANY_PACKS

export function formatSize(bytes: number): string {
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value >= 100 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`
}

const count = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en')} ${n === 1 ? one : many}`

const STATE_TEXT: Record<Exclude<RepoState, 'clean'>, string> = {
  merging: 'A merge is in progress',
  rebasing: 'A rebase is in progress',
  'cherry-picking': 'A cherry-pick is in progress',
  reverting: 'A revert is in progress'
}

/** The read-only findings at the top of the check-up: one line per area, also when there is nothing to do. */
export function checkupFacts(checkup: RepoCheckup, state: RepoState): { lead: string; text: string }[] {
  const { cleanup, storage } = checkup
  const merged = cleanup.candidates.filter((c) => c.reason === 'merged').length
  const gone = cleanup.candidates.length - merged
  const branches = !cleanup.target
    ? 'No default branch to measure against'
    : [merged && `${merged} merged into ${cleanup.target}`, gone && `${gone} with a deleted upstream`].filter(Boolean).join(', ') ||
      'Nothing to clean'
  const notes = [
    state !== 'clean' && `${STATE_TEXT[state]}: finish or abort it in Changes`,
    checkup.staleLock && 'A leftover index.lock may be blocking Git'
  ].filter((text): text is string => !!text)
  return [
    { lead: 'Branches', text: branches },
    {
      lead: 'Storage',
      text: `${formatSize(storageBytes(storage))}, ${count(storage.looseCount, 'loose object')}, ${count(storage.packs, 'pack')}`
    },
    ...notes.map((text) => ({ lead: 'State', text }))
  ]
}

/** What the check-up can do, branches first. Compacting is always offered and ticked only when it is worth it. */
export function checkupRows(checkup: RepoCheckup): CheckupRow[] {
  const { cleanup, storage } = checkup
  const target = cleanup.target
  const branches = target
    ? cleanup.candidates.map((c) => ({
        id: BRANCH_ID + c.name,
        group: 'Delete branches',
        label: c.name,
        note: cleanupNote(c, target),
        warn: c.reason === 'gone',
        checked: true
      }))
    : []
  const compact = worthCompacting(storage)
  return [
    ...branches,
    {
      id: COMPACT_ID,
      group: 'Storage',
      label: 'Compact repository',
      note: compact ? 'packs loose objects, keeps everything recoverable' : 'already compact',
      warn: false,
      checked: compact
    }
  ]
}

/** The branch names among ticked row ids. */
export const tickedBranches = (ids: string[]) => ids.filter((id) => id.startsWith(BRANCH_ID)).map((id) => id.slice(BRANCH_ID.length))

/** The status line after a check-up ran; `freed` is null when it did not compact. */
export function checkupDone(deleted: string[], freed: number | null): string {
  const parts = [
    deleted.length === 1 ? `deleted ${deleted[0]}` : deleted.length > 1 && `deleted ${deleted.length} branches`,
    freed !== null && (freed > 0 ? `compacted, freed ${formatSize(freed)}` : 'compacted, nothing to free')
  ].filter((part): part is string => !!part)
  const text = parts.join(', ')
  return text[0].toUpperCase() + text.slice(1)
}
