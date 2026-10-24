import { useSyncExternalStore } from 'react'

export type CommitFilesMode = 'changes' | 'all'

// Deliberately not a persisted setting: every launch, commit selection and return to History starts in Changes.
let mode: CommitFilesMode = 'changes'
const subs = new Set<() => void>()

export const getCommitFilesMode = () => mode

export function setCommitFilesMode(next: CommitFilesMode) {
  if (next === mode) return
  mode = next
  subs.forEach((s) => s())
}

export const toggleCommitFilesMode = () => setCommitFilesMode(mode === 'all' ? 'changes' : 'all')

export function useCommitFilesMode() {
  return useSyncExternalStore((s) => {
    subs.add(s)
    return () => void subs.delete(s)
  }, getCommitFilesMode)
}
