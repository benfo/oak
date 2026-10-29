import { promises as fs } from 'fs'
import path from 'path'
import { readBlob } from './blob.ts'
import {
  previewRefs,
  PREVIEW_MAX_BYTES,
  type FileVersion,
  type FileVersions,
  type PreviewSource,
  type VersionRef
} from '../shared/filePreview.ts'

const MISSING: FileVersion = { state: 'missing' }

async function readDisk(repo: string, file: string): Promise<FileVersion> {
  try {
    const full = path.join(repo, file)
    const stat = await fs.stat(full)
    if (!stat.isFile()) return MISSING
    if (stat.size > PREVIEW_MAX_BYTES) return { state: 'tooLarge', size: stat.size }
    return { state: 'ok', bytes: new Uint8Array(await fs.readFile(full)) }
  } catch {
    return MISSING
  }
}

async function readGit(repo: string, spec: string): Promise<FileVersion> {
  const blob = await readBlob(repo, spec, PREVIEW_MAX_BYTES)
  if (!blob) return MISSING
  if (blob.size > PREVIEW_MAX_BYTES) return { state: 'tooLarge', size: blob.size }
  return { state: 'ok', bytes: new Uint8Array(blob.data) }
}

function readVersion(repo: string, ref: VersionRef | null): Promise<FileVersion> {
  if (!ref) return Promise.resolve(MISSING)
  return ref.from === 'git' ? readGit(repo, ref.spec) : readDisk(repo, ref.file)
}

/** Both sides of the file a diff shows, as bytes. A side the source doesn't have, or that is too large, says so instead of throwing. */
export async function fileVersions(repo: string, source: PreviewSource): Promise<FileVersions> {
  const { before, after } = previewRefs(source)
  const [b, a] = await Promise.all([readVersion(repo, before), readVersion(repo, after)])
  return { before: b, after: a }
}
