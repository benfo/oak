import {
  Database,
  File,
  FileArchive,
  FileAudio,
  FileCode,
  FileCog,
  FileImage,
  FileJson,
  FileKey,
  FileLock,
  FileSpreadsheet,
  FileTerminal,
  FileText,
  FileType,
  FileVideo,
  Folder,
  FolderOpen,
  GitBranch,
  Package,
  type LucideIcon
} from 'lucide-react'
import type { SimpleIconId } from './simplePack'

/** The Lucide glyph for each icon id of the Simple pack; the type makes a missing one a compile error. */
const SIMPLE_GLYPHS: Record<SimpleIconId, LucideIcon> = {
  file: File,
  folder: Folder,
  'folder-open': FolderOpen,
  code: FileCode,
  json: FileJson,
  text: FileText,
  config: FileCog,
  image: FileImage,
  archive: FileArchive,
  terminal: FileTerminal,
  spreadsheet: FileSpreadsheet,
  database: Database,
  audio: FileAudio,
  video: FileVideo,
  font: FileType,
  key: FileKey,
  lock: FileLock,
  package: Package,
  git: GitBranch
}

export function SimpleIcon({ id, size }: { id: string; size: number }) {
  const Glyph = SIMPLE_GLYPHS[id as SimpleIconId] ?? File
  return <Glyph className="file-icon mono" size={size} strokeWidth={1.5} aria-hidden />
}
