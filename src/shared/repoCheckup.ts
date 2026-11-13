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
  merging: 'Merge in progress',
  rebasing: 'Rebase in progress',
  'cherry-picking': 'Cherry-pick in progress',
  reverting: 'Revert in progress'
}

/** One area of the check-up's summary: its headline finding and whether it wants attention. */
export interface CheckupTile {
  id: 'branches' | 'storage' | 'state'
  label: string
  value: string
  detail: string
  attention: boolean
}

function branchTile({ target, candidates }: BranchCleanup): CheckupTile {
  const merged = candidates.filter((c) => c.reason === 'merged').length
  const gone = candidates.length - merged
  const found = [merged && `${merged} merged`, gone && `${gone} upstream gone`].filter(Boolean).join(', ')
  return {
    id: 'branches',
    label: 'Branches',
    value: candidates.length ? `${candidates.length} to clean up` : 'Tidy',
    detail: !target ? 'No default branch to measure against' : found || `Nothing merged into ${target} or gone`,
    attention: candidates.length > 0
  }
}

function stateTile(state: RepoState, staleLock: boolean): CheckupTile {
  const tile = { id: 'state' as const, label: 'State' }
  if (state !== 'clean') return { ...tile, value: STATE_TEXT[state], detail: 'Finish or abort it in Changes', attention: true }
  if (staleLock) return { ...tile, value: 'Stale lock', detail: 'A leftover index.lock may be blocking Git', attention: true }
  return { ...tile, value: 'Clean', detail: 'No operation left unfinished', attention: false }
}

/** The summary at the top of the check-up: one tile per area, also when there is nothing to do. */
export function checkupTiles(checkup: RepoCheckup, state: RepoState): CheckupTile[] {
  const { storage } = checkup
  return [
    branchTile(checkup.cleanup),
    {
      id: 'storage',
      label: 'Storage',
      value: formatSize(storageBytes(storage)),
      detail: `${count(storage.looseCount, 'loose object')}, ${count(storage.packs, 'pack')}`,
      attention: worthCompacting(storage)
    },
    stateTile(state, checkup.staleLock)
  ]
}

/** The one line under the title: whether anything is worth doing. */
export const checkupVerdict = (rows: CheckupRow[]) =>
  rows.some((row) => row.checked) ? 'Tick what to clean up, then confirm.' : 'Everything looks tidy. You can still compact if you like.'

/** Shown under the list when a listed branch has commits found nowhere else. */
export const checkupCaution = (checkup: RepoCheckup) =>
  checkup.cleanup.candidates.some((c) => c.reason === 'gone') ? 'Commits that are only on a deleted branch are lost with it.' : undefined

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
