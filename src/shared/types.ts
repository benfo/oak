export type RefType = 'head' | 'local' | 'remote' | 'tag'

export interface Ref {
  name: string
  type: RefType
  current?: boolean
}

export interface Commit {
  hash: string
  parents: string[]
  author: string
  email: string
  date: number
  subject: string
  refs: Ref[]
  /** In a file's history: the file's path in this commit, which differs from the filter path across renames. */
  path?: string
  /** In a file's history: the change status in this commit and, for renames, the previous path. */
  status?: string
  oldPath?: string
}

export interface ChangedFile {
  path: string
  oldPath?: string
  status: string
  additions: number | null
  deletions: number | null
}

export interface CommitDetails {
  hash: string
  parents: string[]
  author: string
  email: string
  authorDate: number
  committer: string
  committerEmail: string
  commitDate: number
  message: string
  files: ChangedFile[]
}

export interface FileChange {
  path: string
  oldPath?: string
  status: string
}

export type RepoState = 'clean' | 'merging' | 'rebasing' | 'cherry-picking' | 'reverting'

export interface RepoStatus {
  branch: string | null
  head: string | null
  upstream: string | null
  ahead: number
  behind: number
  staged: FileChange[]
  unstaged: FileChange[]
  conflicted: FileChange[]
  state: RepoState
}

export interface Branch {
  name: string
  fullName: string
  type: 'local' | 'remote' | 'tag'
  hash: string
  upstream: string | null
  ahead: number
  behind: number
  gone: boolean
  current: boolean
  /** Unix seconds: tagger date for annotated tags, otherwise the commit date. */
  date: number
  subject: string
}

/** Where the app's self-update stands (src/main/updater.ts). */
export type UpdateStatus =
  | { state: 'unsupported' } // not the installed app (dev build, unpacked folder)
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'latest' }
  | { state: 'downloading'; version: string; percent: number }
  | { state: 'ready'; version: string }
  | { state: 'error'; message: string }

export interface Stash {
  ref: string
  message: string
}

export interface RecentRepo {
  path: string
  name: string
  lastOpened: number
}

export interface MenuItem {
  id?: string
  label?: string
  type?: 'separator'
  enabled?: boolean
  checked?: boolean
  submenu?: MenuItem[]
}

/** Which refs the history graph walks: everything, only the checked-out line, that plus a target branch, or the commits a comparison adds (`from..to`). */
export type HistoryScope = { kind: 'all' } | { kind: 'head'; base?: string } | { kind: 'target'; target: string } | { kind: 'range'; from: string; to: string }

export type DiffKind = 'unstaged' | 'staged' | 'untracked' | 'conflicted'
export type PullMode = 'default' | 'merge' | 'rebase' | 'ff-only'
export type ResetMode = 'soft' | 'mixed' | 'hard'
export type CheckoutKind = 'local' | 'remote' | 'detached'
