export interface DiffLine {
  type: 'add' | 'del' | 'ctx' | 'note'
  text: string
  oldNo: number | null
  newNo: number | null
  /** Exact Before text for context whose whitespace differs between the two sides. */
  beforeText?: string
}

export interface Hunk {
  header: string
  lines: DiffLine[]
  /** Raw patch lines including the @@ header, used to build partial patches. */
  raw: string[]
}

export interface FileDiff {
  header: string[]
  hunks: Hunk[]
  binary: boolean
  isNew: boolean
  isDeleted: boolean
  isRename: boolean
}
