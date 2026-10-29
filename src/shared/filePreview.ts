import type { DiffKind } from './types.ts'

/** Largest file version a preview will load; bigger ones are reported as too large instead. */
export const PREVIEW_MAX_BYTES = 5 * 1024 * 1024

/** Where a diff came from: enough to find the file's two sides again. */
export type PreviewSource =
  | { kind: 'working'; diffKind: DiffKind; file: string; oldPath?: string }
  | { kind: 'headToWorking'; file: string; oldPath?: string }
  | { kind: 'commit'; hash: string; parent: string | null; file: string; oldPath?: string }

/** One side of a file: a Git object (`HEAD:path`, `:path` for the index) or a file in the working tree. */
export type VersionRef = { from: 'git'; spec: string } | { from: 'disk'; file: string }

/** The two sides a preview compares. A side is null when the source has no such version (an added file has no "before"). */
export interface PreviewRefs {
  before: VersionRef | null
  after: VersionRef | null
}

/** A file's bytes at one side, or why they aren't there. */
export type FileVersion = { state: 'missing' } | { state: 'tooLarge'; size: number } | { state: 'ok'; bytes: Uint8Array }

export interface FileVersions {
  before: FileVersion
  after: FileVersion
}

const git = (spec: string): VersionRef => ({ from: 'git', spec })
const disk = (file: string): VersionRef => ({ from: 'disk', file })

/**
 * Which versions of the file a diff compares. Git objects that don't exist (a file the index or a commit lacks)
 * are not worked out here: reading them reports `missing`, so added and deleted files need no status.
 */
export function previewRefs(source: PreviewSource): PreviewRefs {
  const before = source.oldPath ?? source.file
  switch (source.kind) {
    case 'working':
      if (source.diffKind === 'untracked') return { before: null, after: disk(source.file) }
      if (source.diffKind === 'staged') return { before: git(`HEAD:${before}`), after: git(`:${source.file}`) }
      if (source.diffKind === 'conflicted') return { before: git(`HEAD:${source.file}`), after: disk(source.file) }
      return { before: git(`:${source.file}`), after: disk(source.file) }
    case 'headToWorking':
      return { before: git(`HEAD:${before}`), after: disk(source.file) }
    case 'commit':
      return { before: source.parent ? git(`${source.parent}:${before}`) : null, after: git(`${source.hash}:${source.file}`) }
  }
}
