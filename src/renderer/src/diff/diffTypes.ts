/** What the diff's lines can be used for. Patches are built by the view (whole hunks or selected lines). */
export interface DiffActions {
  /** Stage (forward) or Unstage (reverse). Runs on Enter. */
  primary: { label: string; reverse: boolean; run: (patch: string) => void }
  /** Discard from the working tree — always a reverse patch. Runs on Delete. */
  discard?: { label: string; run: (patch: string) => void }
}

/** One rendered line, in display order. */
export interface Row {
  index: number
  hunk: number
  line: number
  key: string
  change: boolean
}

/** One entry of the flat list the pane renders: a hunk header, or a line (inline) or line pair (side by side). */
export interface Item {
  key: string
  hunk: number
  header?: boolean
  row?: number
  pos?: number
  change: boolean
}

/** Row indexes shown side by side; null is a blank cell opposite an addition or deletion. */
export interface SidePair {
  old: number | null
  new: number | null
}

export type DiffSide = 'old' | 'new'
