import { app, BrowserWindow, clipboard, dialog, shell, type OpenDialogOptions } from 'electron'
import { spawn } from 'child_process'
import { existsSync, promises as fs } from 'fs'
import path from 'path'
import { getGitBinary, git, outputSink, setGitBinary } from './git'
import { parseRemoteUrl, pullRequestUrl, pullRequestUrlFromOutput } from '../shared/pullRequest'
import { homedir } from 'os'
import { addRecent, listRecent, removeRecent } from './recent'
import { listThemes, setWindowTheme, themesDir, type WindowTheme } from './windowTheme'
import { checkForUpdates, installUpdate, updateStatus } from './updater'
import { checkoutBranchNames } from '../shared/recentBranches'
import { setsLineEndings } from '../shared/gitTools'
import { splitFileLogChunk } from '../shared/fileLog'
import { configFilePath, findExecutables, openConfigFile } from './gitConfigFiles'
import type {
  Branch,
  ChangedFile,
  CheckoutKind,
  Commit,
  CommitDetails,
  DiffKind,
  HistoryScope,
  PullMode,
  Ref,
  RepoState,
  RepoStatus,
  ResetMode,
  Stash
} from '../shared/types'

export type GitConfigScope = 'global' | 'local'

/** A Git for Windows install found when "git" wasn't on PATH (see gitInfo). */
let detectedGit: string | null = null

/** The first existing folder among command-line arguments (skipping the exe/script and flags), resolved against `cwd`. */
export function folderArg(argv: string[], cwd: string): string | null {
  const args = argv.slice(process.defaultApp ? 2 : 1).filter((a) => !a.startsWith('-'))
  const dir = args.map((a) => path.resolve(cwd, a)).find((a) => existsSync(a))
  return dir ?? null
}

const US = '\x1f'
const RS = '\x1e'
const MAX_PREVIEW_BYTES = 2 * 1024 * 1024

// ---------- helpers ----------

/**
 * One `git cat-file --batch` process reads a blob and its size together (process start-up dominates on Windows).
 * Stops reading as soon as the header shows the blob is over `limit`. Resolves null when the object is missing.
 */
function readBlob(repo: string, spec: string, limit: number): Promise<{ size: number; data: Buffer } | null> {
  return new Promise((resolve, reject) => {
    const child = spawn(getGitBinary(), ['cat-file', '--batch'], { cwd: repo, windowsHide: true })
    const chunks: Buffer[] = []
    let received = 0
    let done = false
    const finish = (result: { size: number; data: Buffer } | null, error?: Error) => {
      if (done) return
      done = true
      child.kill()
      if (error) reject(error)
      else resolve(result)
    }
    const check = () => {
      const buf = Buffer.concat(chunks)
      const end = buf.indexOf(10)
      if (end < 0) return
      const header = buf.subarray(0, end).toString('utf8')
      const match = /^\S+ \S+ (\d+)$/.exec(header)
      if (!match) return finish(null)
      const size = Number(match[1])
      if (size > limit) return finish({ size, data: Buffer.alloc(0) })
      if (received - end - 1 >= size) finish({ size, data: buf.subarray(end + 1, end + 1 + size) })
    }
    child.stdout.on('data', (d: Buffer) => {
      chunks.push(d)
      received += d.length
      check()
    })
    child.on('error', (e) => finish(null, new Error(`Could not run git: ${e.message}`)))
    child.on('close', () => finish(null))
    child.stdin.on('error', () => {})
    child.stdin.end(`${spec}\n`)
  })
}

const gitDirs = new Map<string, string>()

async function gitDir(repo: string) {
  let dir = gitDirs.get(repo)
  if (!dir) {
    dir = path.resolve(repo, (await git(repo, ['rev-parse', '--git-dir'])).trim())
    gitDirs.set(repo, dir)
  }
  return dir
}

async function hasHead(repo: string) {
  try {
    await git(repo, ['rev-parse', '--verify', '--quiet', 'HEAD'])
    return true
  } catch {
    return false
  }
}

async function currentBranch(repo: string) {
  try {
    return (await git(repo, ['symbolic-ref', '--short', '-q', 'HEAD'])).trim() || null
  } catch {
    return null
  }
}

async function defaultRemote(repo: string) {
  const remotes = (await git(repo, ['remote'])).split('\n').map((s) => s.trim()).filter(Boolean)
  if (!remotes.length) throw new Error('This repository has no remotes configured.')
  return remotes.includes('origin') ? 'origin' : remotes[0]
}

/** The "new pull request" page for a pushed branch, on the remote it tracks (else origin). */
async function pullRequestPage(repo: string, branch: string) {
  const config = async (key: string) => (await git(repo, ['config', '--get', key], { okCodes: [1] })).trim()
  const configured = await config(`branch.${branch}.remote`)
  const remote = configured && configured !== '.' ? configured : await defaultRemote(repo)
  const remoteBranch = (await config(`branch.${branch}.merge`)).replace(/^refs\/heads\//, '') || branch
  const pushed = await git(repo, ['rev-parse', '--verify', '-q', `refs/remotes/${remote}/${remoteBranch}`], { okCodes: [1] })
  if (!pushed.trim()) throw new Error(`Push "${branch}" first: it isn't on ${remote} yet.`)
  const remoteUrl = (await git(repo, ['remote', 'get-url', remote])).trim()
  const url = pullRequestUrl(remoteUrl, remoteBranch)
  if (!url) throw new Error(`Oak doesn't know where ${remote} (${parseRemoteUrl(remoteUrl)?.host ?? remoteUrl}) hosts pull requests. GitHub, GitLab, Bitbucket and Azure DevOps are supported.`)
  return url
}

async function repoState(repo: string): Promise<RepoState> {
  const dir = await gitDir(repo)
  const has = (f: string) => existsSync(path.join(dir, f))
  if (has('rebase-merge') || has('rebase-apply')) return 'rebasing'
  if (has('MERGE_HEAD')) return 'merging'
  if (has('CHERRY_PICK_HEAD')) return 'cherry-picking'
  if (has('REVERT_HEAD')) return 'reverting'
  return 'clean'
}

function splitZ(out: string) {
  const tokens = out.split('\0')
  if (tokens[tokens.length - 1] === '') tokens.pop()
  return tokens
}

function parseRefs(decoration: string): Ref[] {
  const refs: Ref[] = []
  for (const part of decoration.split(', ').map((s) => s.trim()).filter(Boolean)) {
    if (part === 'HEAD') refs.push({ name: 'HEAD', type: 'head' })
    else if (part.startsWith('HEAD -> '))
      refs.push({ name: part.slice(8).replace(/^refs\/heads\//, ''), type: 'local', current: true })
    else if (part.startsWith('tag: ')) refs.push({ name: part.slice(5).replace(/^refs\/tags\//, ''), type: 'tag' })
    else if (part.startsWith('refs/heads/')) refs.push({ name: part.slice(11), type: 'local' })
    else if (part.startsWith('refs/remotes/') && !part.endsWith('/HEAD'))
      refs.push({ name: part.slice(13), type: 'remote' })
  }
  return refs
}

/** Builds a "new file" diff for an untracked file, which git diff can't show directly. */
async function untrackedDiff(repo: string, file: string) {
  const p = file.replace(/\\/g, '/')
  const head = `diff --git a/${p} b/${p}\nnew file mode 100644\n`
  const full = path.join(repo, file)
  const stat = await fs.stat(full)
  if (stat.isDirectory()) return head
  if (stat.size > MAX_PREVIEW_BYTES) return `${head}File is too large to preview\n`
  const buf = await fs.readFile(full)
  if (buf.includes(0)) return `${head}Binary files /dev/null and b/${p} differ\n`
  const text = buf.toString('utf8')
  if (!text) return head
  const lines = text.split('\n')
  const noEol = !text.endsWith('\n')
  if (!noEol) lines.pop()
  return (
    `${head}--- /dev/null\n+++ b/${p}\n@@ -0,0 +1,${lines.length} @@\n` +
    lines.map((l) => '+' + l).join('\n') +
    '\n' +
    (noEol ? '\\ No newline at end of file\n' : '')
  )
}

// ---------- handlers exposed to the renderer ----------

export const handlers = {
  // ---- repositories ----
  async pickFolder(title?: string): Promise<string | null> {
    const opts: OpenDialogOptions = { title, properties: ['openDirectory', 'createDirectory'] }
    const win = BrowserWindow.getFocusedWindow()
    const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    return res.canceled ? null : res.filePaths[0]
  },

  async openRepo(dir: string): Promise<string> {
    if (!existsSync(dir)) throw new Error(`Folder not found: ${dir}`)
    const top = path.normalize((await git(dir, ['rev-parse', '--show-toplevel'])).trim())
    await addRecent(top)
    return top
  },

  async initRepo(dir: string): Promise<string> {
    await git(dir, ['init'])
    return handlers.openRepo(dir)
  },

  async cloneRepo(url: string, parentDir: string, name: string): Promise<string> {
    await git(parentDir, ['clone', '--progress', url, name])
    return handlers.openRepo(path.join(parentDir, name))
  },

  /** A folder passed on the command line (e.g. `oak C:devepo`), if any. */
  async launchPath(): Promise<string | null> {
    return folderArg(process.argv, process.cwd())
  },

  recentRepos: () => listRecent(),
  removeRecent: (repoPath: string) => removeRecent(repoPath),

  // ---- reading ----
  async status(repo: string): Promise<RepoStatus> {
    const out = await git(repo, ['status', '--porcelain=v2', '--branch', '-z', '--untracked-files=all'])
    const s: RepoStatus = {
      branch: null,
      head: null,
      upstream: null,
      ahead: 0,
      behind: 0,
      staged: [],
      unstaged: [],
      conflicted: [],
      state: await repoState(repo)
    }
    const t = splitZ(out)
    for (let i = 0; i < t.length; i++) {
      const line = t[i]
      if (line.startsWith('# ')) {
        const [, key, ...rest] = line.split(' ')
        const val = rest.join(' ')
        if (key === 'branch.oid') s.head = val === '(initial)' ? null : val
        else if (key === 'branch.head') s.branch = val === '(detached)' ? null : val
        else if (key === 'branch.upstream') s.upstream = val
        else if (key === 'branch.ab') {
          const m = /\+(\d+) -(\d+)/.exec(val)
          if (m) [s.ahead, s.behind] = [Number(m[1]), Number(m[2])]
        }
        continue
      }
      const kind = line[0]
      const parts = line.split(' ')
      if (kind === '1' || kind === '2') {
        const xy = parts[1]
        const p = parts.slice(kind === '1' ? 8 : 9).join(' ')
        const oldPath = kind === '2' ? t[++i] : undefined
        if (xy[0] !== '.') s.staged.push({ path: p, oldPath, status: xy[0] })
        // .A = added with --intent-to-add and nothing staged yet: to the user it's still untracked.
        if (xy === '.A') s.unstaged.push({ path: p, status: '?' })
        else if (xy[1] !== '.') s.unstaged.push({ path: p, status: xy[1] })
      } else if (kind === 'u') {
        s.conflicted.push({ path: parts.slice(10).join(' '), status: parts[1] })
      } else if (kind === '?') {
        s.unstaged.push({ path: line.slice(2), status: '?' })
      }
    }
    return s
  },

  async log(repo: string, limit: number, include?: string, scope: HistoryScope = { kind: 'all' }, file?: string): Promise<Commit[]> {
    const roots = scope.kind === 'all' ? ['--all'] : scope.kind === 'head' ? [scope.base ? `${scope.base}..HEAD` : 'HEAD']
      : scope.kind === 'target' ? ['HEAD', scope.target] : [`${scope.from}..${scope.to}`]
    const fields = '%H%x1f%P%x1f%an%x1f%ae%x1f%at%x1f%s%x1f%D'
    let out: string
    try {
      out = await git(repo, [
        '-c', 'core.quotepath=off',
        'log',
        '--exclude=refs/stash',
        ...roots,
        '--date-order',
        '--decorate=full',
        `--max-count=${limit}`,
        // A leading separator keeps each commit's name-status lines inside its own chunk.
        ...(file ? ['--follow', '--name-status', '-M', `--format=%x1e${fields}`] : [`--format=${fields}%x1e`]),
        ...(include && !file ? [include] : []),
        ...(file ? ['--', file] : [])
      ])
    } catch (e) {
      if (!(await hasHead(repo))) return []
      throw e
    }
    return out
      .split(RS)
      .map((s) => s.replace(/^\n/, ''))
      .filter((s) => s.trim())
      .map((rec) => {
        const followed = file ? splitFileLogChunk(rec, file) : null
        const [hash, parents, author, email, at, subject, deco] = (followed ? followed.record : rec).split(US)
        return {
          hash,
          parents: parents ? parents.split(' ') : [],
          author,
          email,
          date: Number(at) * 1000,
          subject,
          refs: parseRefs(deco ?? ''),
          ...(followed ? { path: followed.path, status: followed.status, oldPath: followed.oldPath } : {})
        }
      })
  },

  async branches(repo: string): Promise<Branch[]> {
    const fmt = [
      '%(refname)',
      '%(objectname)',
      '%(*objectname)',
      '%(upstream:short)',
      '%(upstream:track,nobracket)',
      '%(HEAD)',
      '%(creatordate:unix)',
      '%(contents:subject)'
    ].join('%1f')
    const out = await git(repo, ['for-each-ref', '--sort=refname', `--format=${fmt}`, 'refs/heads', 'refs/remotes', 'refs/tags'])
    const list: Branch[] = []
    for (const line of out.split('\n')) {
      if (!line) continue
      const [ref, obj, peeled, upstream, track, head, date, subject] = line.split(US)
      let type: Branch['type']
      let name: string
      if (ref.startsWith('refs/heads/')) [type, name] = ['local', ref.slice(11)]
      else if (ref.startsWith('refs/remotes/')) [type, name] = ['remote', ref.slice(13)]
      else [type, name] = ['tag', ref.slice(10)]
      if (type === 'remote' && name.endsWith('/HEAD')) continue
      list.push({
        name,
        fullName: ref,
        type,
        hash: peeled || obj,
        upstream: upstream || null,
        ahead: Number(/ahead (\d+)/.exec(track)?.[1] ?? 0),
        behind: Number(/behind (\d+)/.exec(track)?.[1] ?? 0),
        gone: track === 'gone',
        current: head === '*',
        date: Number(date) || 0,
        subject
      })
    }
    return list
  },

  async stashes(repo: string): Promise<Stash[]> {
    try {
      const out = await git(repo, ['stash', 'list', '--format=%gd%x1f%s'])
      return out
        .split('\n')
        .filter(Boolean)
        .map((l) => {
          const [ref, message] = l.split(US)
          return { ref, message }
        })
    } catch {
      return []
    }
  },

  async recentBranches(repo: string): Promise<string[]> {
    try {
      return checkoutBranchNames(await git(repo, ['reflog', 'show', '-n', '100', '--grep-reflog=^checkout: moving from ', '--format=%gs', 'HEAD']))
    } catch {
      // A new repository or a repository with reflogs disabled has no checkout history.
      return []
    }
  },

  /** Name (as in `branches`) of the branch a comparison defaults to; `source` null means the checked-out branch. */
  async remoteHead(repo: string): Promise<string | null> {
    return (await git(repo, ['symbolic-ref', '--short', '-q', 'refs/remotes/origin/HEAD'], { okCodes: [1] })).trim() || null
  },

  /** The single common ancestor, or null when there is none or several (only a tip-to-tip difference is meaningful then). */
  async mergeBase(repo: string, before: string, after: string): Promise<string | null> {
    const bases = (await git(repo, ['merge-base', '--all', before, after], { okCodes: [0, 1] })).trim().split('\n').filter(Boolean)
    return bases.length === 1 ? bases[0] : null
  },

  /** Commits reachable from `target` but not from `source`: the target's work that a tip-to-tip difference shows reversed. */
  async commitsAhead(repo: string, target: string, source: string): Promise<number> {
    return Number((await git(repo, ['rev-list', '--count', `${source}..${target}`])).trim()) || 0
  },

  async commitDetails(repo: string, hash: string, compareBase?: string): Promise<CommitDetails> {
    const meta = await git(repo, ['show', '-s', '--format=%H%x1f%P%x1f%an%x1f%ae%x1f%at%x1f%cn%x1f%ce%x1f%ct%x1f%B', hash])
    const [h, p, an, ae, at, cn, ce, ct, ...body] = meta.split(US)
    const parents = p ? p.split(' ') : []
    const range = compareBase ? [compareBase, h] : parents.length ? [parents[0], h] : ['--root', h]
    const base = ['diff-tree', '-r', '-M', '-z', '--no-commit-id']
    const [ns, num] = await Promise.all([
      git(repo, [...base, '--name-status', ...range]),
      git(repo, [...base, '--numstat', ...range])
    ])

    const files: ChangedFile[] = []
    const nt = splitZ(ns)
    for (let i = 0; i < nt.length; ) {
      const status = nt[i++]
      if (/^[RC]/.test(status)) {
        const oldPath = nt[i++]
        files.push({ path: nt[i++], oldPath, status: status[0], additions: null, deletions: null })
      } else {
        files.push({ path: nt[i++], status, additions: null, deletions: null })
      }
    }
    const byPath = new Map(files.map((f) => [f.path, f]))
    const mt = splitZ(num)
    for (let i = 0; i < mt.length; ) {
      const [a, d, p] = mt[i++].split('\t')
      let filePath = p
      if (p === '') {
        i++ // old path of a rename
        filePath = mt[i++]
      }
      const f = byPath.get(filePath)
      if (f) {
        f.additions = a === '-' ? null : Number(a)
        f.deletions = d === '-' ? null : Number(d)
      }
    }

    return {
      hash: h,
      parents,
      author: an,
      email: ae,
      authorDate: Number(at) * 1000,
      committer: cn,
      committerEmail: ce,
      commitDate: Number(ct) * 1000,
      message: body.join(US).trimEnd(),
      files
    }
  },

  async commitFileDiff(repo: string, hash: string, parent: string | null, file: string, oldPath?: string, context = 3) {
    const paths = oldPath ? [oldPath, file] : [file]
    if (parent) return git(repo, ['diff', '--no-ext-diff', `-U${context}`, '-M', parent, hash, '--', ...paths])
    return git(repo, ['show', '--no-ext-diff', `-U${context}`, '--format=', '-M', hash, '--', ...paths])
  },

  /** Everything uncommitted (staged, unstaged and untracked) as one change set against HEAD. */
  /** Every file path in the commit's snapshot. */
  async commitTree(repo: string, hash: string): Promise<string[]> {
    return splitZ(await git(repo, ['ls-tree', '-r', '-z', '--name-only', '--full-tree', hash]))
  },

  /** A file as it was at a commit, shaped as a new-file diff so the diff view can render and highlight it. */
  async commitFileContent(repo: string, hash: string, file: string): Promise<string> {
    const p = file.replace(/\\/g, '/')
    const head = `diff --git a/${p} b/${p}\nnew file mode 100644\n`
    const spec = `${hash}:${p}`
    const blob = await readBlob(repo, spec, MAX_PREVIEW_BYTES)
    if (!blob) throw new Error(`Could not read ${file} at ${hash.slice(0, 8)}`)
    if (blob.size > MAX_PREVIEW_BYTES) return `${head}File is too large to preview (${blob.size} bytes)\n`
    const text = blob.data.toString('utf8')
    if (text.includes('\0') || text.includes('\ufffd')) return `${head}Binary files /dev/null and b/${p} differ\n`
    if (!text) return head
    const lines = text.split('\n')
    const noEol = !text.endsWith('\n')
    if (!noEol) lines.pop()
    return `${head}--- /dev/null\n+++ b/${p}\n@@ -0,0 +1,${lines.length} @@\n` +
      lines.map((l) => '+' + l).join('\n') + '\n' + (noEol ? '\\ No newline at end of file\n' : '')
  },

  /** Saves a file as it was at a commit to a location the user picks. Returns the path, or null if cancelled. */
  async saveFileCopy(repo: string, hash: string, file: string): Promise<string | null> {
    const win = BrowserWindow.getFocusedWindow()
    const name = file.split('/').pop() ?? file
    const opts = { title: 'Save a copy', defaultPath: name }
    const res = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
    if (res.canceled || !res.filePath) return null
    const data = await new Promise<Buffer>((resolve, reject) => {
      const child = spawn(getGitBinary(), ['cat-file', 'blob', `${hash}:${file}`], { cwd: repo, windowsHide: true })
      const out: Buffer[] = []
      child.stdout.on('data', (d: Buffer) => out.push(d))
      child.on('error', (e) => reject(new Error(`Could not run git: ${e.message}`)))
      child.on('close', (code) => code === 0 ? resolve(Buffer.concat(out)) : reject(new Error(`Could not read ${file} at ${hash.slice(0, 8)}`)))
    })
    await fs.writeFile(res.filePath, data)
    return res.filePath
  },

  async workingChanges(repo: string): Promise<ChangedFile[]> {
    const base = ['diff', '--no-ext-diff', '-M', '-z']
    const [ns, num, untracked] = await Promise.all([
      git(repo, [...base, '--name-status', 'HEAD']),
      git(repo, [...base, '--numstat', 'HEAD']),
      git(repo, ['ls-files', '--others', '--exclude-standard', '-z'])
    ])
    const files: ChangedFile[] = []
    const nt = splitZ(ns)
    for (let i = 0; i < nt.length; ) {
      const status = nt[i++]
      if (/^[RC]/.test(status)) {
        const oldPath = nt[i++]
        files.push({ path: nt[i++], oldPath, status: status[0], additions: null, deletions: null })
      } else files.push({ path: nt[i++], status, additions: null, deletions: null })
    }
    const byPath = new Map(files.map((f) => [f.path, f]))
    const mt = splitZ(num)
    for (let i = 0; i < mt.length; ) {
      const [a, d, p] = mt[i++].split('\t')
      let filePath = p
      if (p === '') {
        i++ // old path of a rename
        filePath = mt[i++]
      }
      const f = byPath.get(filePath)
      if (f) {
        f.additions = a === '-' ? null : Number(a)
        f.deletions = d === '-' ? null : Number(d)
      }
    }
    for (const p of splitZ(untracked)) if (!byPath.has(p)) files.push({ path: p, status: '?', additions: null, deletions: null })
    return files.sort((a, b) => a.path.localeCompare(b.path))
  },

  async workingFileDiff(repo: string, file: string, status: string, oldPath?: string, context = 3) {
    if (status === '?') return untrackedDiff(repo, file)
    return git(repo, ['diff', '--no-ext-diff', `-U${Math.max(1, context)}`, '-M', 'HEAD', '--', ...(oldPath ? [oldPath, file] : [file])])
  },

  async workingDiff(repo: string, file: string, kind: DiffKind, oldPath?: string, context = 3) {
    if (kind === 'untracked') return untrackedDiff(repo, file)
    const args = ['diff', '--no-ext-diff', `-U${Math.max(1, context)}`]
    if (kind === 'staged') args.push('--cached', '-M')
    args.push('--', ...(oldPath && kind === 'staged' ? [oldPath, file] : [file]))
    return git(repo, args)
  },

  async lastCommitMessage(repo: string) {
    return (await git(repo, ['log', '-1', '--format=%B'])).trimEnd()
  },

  async mergeMessage(repo: string) {
    try {
      const text = await fs.readFile(path.join(await gitDir(repo), 'MERGE_MSG'), 'utf8')
      return text
        .split('\n')
        .filter((l) => !l.startsWith('#'))
        .join('\n')
        .trim()
    } catch {
      return ''
    }
  },

  // ---- working tree ----
  async stage(repo: string, paths: string[]) {
    await git(repo, ['add', '-A', '--', ...paths])
  },

  async unstage(repo: string, paths: string[]) {
    if (await hasHead(repo)) await git(repo, ['reset', '-q', 'HEAD', '--', ...paths])
    else await git(repo, ['rm', '--cached', '-r', '-q', '--', ...paths])
  },

  async stageAll(repo: string) {
    await git(repo, ['add', '-A'])
  },

  async unstageAll(repo: string) {
    if (await hasHead(repo)) await git(repo, ['reset', '-q'])
    else await git(repo, ['rm', '--cached', '-r', '-q', '.'])
  },

  async discard(repo: string, tracked: string[], untracked: string[]) {
    if (tracked.length) await git(repo, ['restore', '--worktree', '--', ...tracked])
    for (const f of untracked) await shell.trashItem(path.join(repo, f))
    // Drop any --intent-to-add entries left for them (no-op for truly untracked files).
    if (untracked.length) await git(repo, ['rm', '--cached', '-q', '--ignore-unmatch', '--', ...untracked])
  },

  async resolveConflict(repo: string, file: string, side: 'ours' | 'theirs' | 'mark') {
    if (side !== 'mark') await git(repo, ['checkout', `--${side}`, '--', file])
    await git(repo, ['add', '--', file])
  },

  /** The files that still contain conflict markers. */
  async conflictMarkers(repo: string, files: string[]): Promise<string[]> {
    const found: string[] = []
    for (const f of files) {
      try {
        const text = await fs.readFile(path.join(repo, f), 'utf8')
        if (/^<{7}( |$)/m.test(text) && /^>{7}( |$)/m.test(text)) found.push(f)
      } catch {
        // A file deleted on one side has nothing to scan.
      }
    }
    return found
  },

  /** Opens the configured merge tool for the files (all conflicted files when none are given), leaving no backups in the repo. False when no tool is configured. */
  async openMergeTool(repo: string, files: string[]): Promise<boolean> {
    const tool = (await git(repo, ['config', '--get', 'merge.tool'], { okCodes: [1] })).trim()
    if (!tool) return false
    await git(repo, ['-c', 'mergetool.keepBackup=false', '-c', 'mergetool.keepTemporaries=false', '-c', 'mergetool.writeToTemp=true', 'mergetool', '--no-prompt', ...(files.length ? ['--', ...files] : [])])
    return true
  },

  /** `intentToAdd`: a new file's path, recorded in the index first so part of it can be staged. */
  async applyPatch(repo: string, patch: string, opts: { cached?: boolean; reverse?: boolean; intentToAdd?: string }) {
    if (opts.intentToAdd) await git(repo, ['add', '--intent-to-add', '--', opts.intentToAdd])
    const args = ['apply', '--recount', '--whitespace=nowarn']
    if (opts.cached) args.push('--cached')
    if (opts.reverse) args.push('--reverse')
    await git(repo, [...args, '-'], { input: patch })
  },

  async commit(repo: string, message: string, amend: boolean, signoff = false) {
    await git(repo, ['commit', '-F', '-', ...(amend ? ['--amend'] : []), ...(signoff ? ['--signoff'] : [])], { input: message })
  },

  // ---- branches & refs ----
  async checkout(repo: string, ref: string, kind: CheckoutKind) {
    if (kind === 'local') return void (await git(repo, ['switch', ref]))
    if (kind === 'detached') return void (await git(repo, ['switch', '--detach', ref]))
    const localName = ref.split('/').slice(1).join('/')
    try {
      await git(repo, ['show-ref', '--verify', '--quiet', `refs/heads/${localName}`])
      await git(repo, ['switch', localName])
    } catch {
      await git(repo, ['switch', '--track', '-c', localName, ref])
    }
  },

  async createBranch(repo: string, name: string, start: string | null, checkout: boolean) {
    const at = start ? [start] : []
    await git(repo, checkout ? ['switch', '-c', name, ...at] : ['branch', name, ...at])
  },

  async renameBranch(repo: string, oldName: string, newName: string) {
    await git(repo, ['branch', '-m', oldName, newName])
  },

  async deleteBranch(repo: string, name: string, force: boolean) {
    await git(repo, ['branch', force ? '-D' : '-d', name])
  },

  async deleteRemoteBranch(repo: string, remoteBranch: string) {
    const [remote, ...rest] = remoteBranch.split('/')
    await git(repo, ['push', remote, '--delete', rest.join('/')])
  },

  async merge(repo: string, ref: string) {
    return git(repo, ['merge', '--no-edit', ref])
  },

  async rebase(repo: string, onto: string) {
    await git(repo, ['rebase', onto])
  },

  async cherryPick(repo: string, hash: string, isMerge: boolean) {
    await git(repo, ['cherry-pick', ...(isMerge ? ['-m', '1'] : []), hash])
  },

  async revert(repo: string, hash: string, isMerge: boolean) {
    await git(repo, ['revert', '--no-edit', ...(isMerge ? ['-m', '1'] : []), hash])
  },

  async reset(repo: string, hash: string, mode: ResetMode) {
    await git(repo, ['reset', `--${mode}`, hash])
  },

  async createTag(repo: string, name: string, hash: string, message: string) {
    await git(repo, message ? ['tag', '-a', name, '-m', message, hash] : ['tag', name, hash])
  },

  async deleteTag(repo: string, name: string) {
    await git(repo, ['tag', '-d', name])
  },

  async abortOperation(repo: string) {
    const cmd = { merging: 'merge', rebasing: 'rebase', 'cherry-picking': 'cherry-pick', reverting: 'revert', clean: null }[
      await repoState(repo)
    ]
    if (cmd) await git(repo, [cmd, '--abort'])
  },

  async continueOperation(repo: string) {
    const state = await repoState(repo)
    if (state === 'merging') await git(repo, ['commit', '--no-edit'])
    else if (state === 'rebasing') await git(repo, ['rebase', '--continue'])
    else if (state === 'cherry-picking') await git(repo, ['cherry-pick', '--continue'])
    else if (state === 'reverting') await git(repo, ['revert', '--continue'])
  },

  // ---- remotes ----
  /** Background fetch (auto-fetch): never prompts for credentials; returns the error instead of throwing. */
  async backgroundFetch(repo: string, prune = true): Promise<string | null> {
    try {
      await git(repo, ['fetch', '--all', '--quiet', ...(prune ? ['--prune'] : [])], { noPrompt: true })
      return null
    } catch (e) {
      return e instanceof Error ? e.message : String(e)
    }
  },

  async fetch(repo: string, prune = true) {
    await git(repo, ['fetch', '--progress', '--all', ...(prune ? ['--prune'] : [])])
  },

  async pull(repo: string, mode: PullMode) {
    const flag = { default: [], merge: ['--no-rebase'], rebase: ['--rebase'], 'ff-only': ['--ff-only'] }[mode]
    await git(repo, ['pull', '--progress', '--no-edit', ...flag])
  },

  /** Pushes; resolves with a link to open a pull request when one is useful (see pullRequestUrlFromOutput). */
  async push(repo: string, force: boolean): Promise<string | null> {
    const branch = await currentBranch(repo)
    if (!branch) throw new Error('You are not on a branch (detached HEAD). Create a branch first.')
    const forceArgs = force ? ['--force-with-lease'] : []
    let hasUpstream = true
    try {
      await git(repo, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'])
    } catch {
      hasUpstream = false
    }
    let output = ''
    const parent = outputSink.getStore()
    const capture = (text: string) => {
      output += text
      parent?.(text)
    }
    await outputSink.run(capture, async () => {
      if (hasUpstream) await git(repo, ['push', '--progress', ...forceArgs])
      else await git(repo, ['push', '--progress', ...forceArgs, '-u', await defaultRemote(repo), branch])
    })
    const printed = pullRequestUrlFromOutput(output)
    if (printed) return printed
    // A first push is the moment people open a pull request; later pushes update an existing one.
    if (hasUpstream) return null
    return pullRequestPage(repo, branch).catch(() => null)
  },

  async pullRequestUrl(repo: string, branch?: string) {
    const name = branch ?? (await currentBranch(repo))
    if (!name) throw new Error('You are not on a branch (detached HEAD).')
    return pullRequestPage(repo, name)
  },

  async pushTag(repo: string, tag: string) {
    await git(repo, ['push', await defaultRemote(repo), `refs/tags/${tag}`])
  },

  // ---- stash ----
  async stash(repo: string, message: string) {
    await git(repo, ['stash', 'push', '-u', ...(message ? ['-m', message] : [])])
  },

  async stashPop(repo: string, ref?: string) {
    await git(repo, ['stash', 'pop', ...(ref ? [ref] : [])])
  },

  async stashApply(repo: string, ref: string) {
    await git(repo, ['stash', 'apply', ref])
  },

  async stashDrop(repo: string, ref: string) {
    await git(repo, ['stash', 'drop', ref])
  },

  // ---- shell integration ----
  async openPath(repo: string, file?: string) {
    await shell.openPath(file ? path.join(repo, file) : repo)
  },

  async revealFile(repo: string, file: string) {
    shell.showItemInFolder(path.join(repo, file))
  },

  async openTerminal(repo: string) {
    if (process.platform === 'win32') {
      const wt = spawn('wt.exe', ['-d', repo], { detached: true, stdio: 'ignore' })
      wt.on('error', () => {
        spawn('cmd.exe', ['/c', 'start', 'cmd.exe', '/K', `cd /d "${repo}"`], { detached: true, stdio: 'ignore' }).unref()
      })
      wt.unref()
    } else if (process.platform === 'darwin') {
      spawn('open', ['-a', 'Terminal', repo], { detached: true, stdio: 'ignore' }).unref()
    } else {
      spawn('x-terminal-emulator', [], { cwd: repo, detached: true, stdio: 'ignore' }).unref()
    }
  },

  async copyText(text: string) {
    clipboard.writeText(text)
  },

  /** Title bar, window background and native menus follow the renderer's theme. */
  async setWindowTheme(t: WindowTheme) {
    setWindowTheme(t)
  },

  listThemes: () => listThemes(),

  // ---- git configuration (Preferences writes real git config, so the command line agrees) ----

  /** Values of config keys at one scope (null where unset). Global needs no repository. One git call reads them all. */
  async gitConfigGet(repo: string | null, scope: GitConfigScope, keys: string[]) {
    const cwd = scope === 'local' && repo ? repo : homedir()
    const all = new Map<string, string>()
    for (const entry of (await git(cwd, ['config', `--${scope}`, '--list', '-z'], { okCodes: [1] })).split('\0')) {
      const nl = entry.indexOf('\n')
      if (nl > 0) all.set(entry.slice(0, nl), entry.slice(nl + 1))
    }
    const out: Record<string, string | null> = {}
    for (const key of keys) out[key] = all.get(key.toLowerCase())?.trim() || null
    return out
  },

  /** Sets a config key at one scope; an empty value unsets it (so a repository inherits the global one). */
  async gitConfigSet(repo: string | null, scope: GitConfigScope, key: string, value: string) {
    const cwd = scope === 'local' && repo ? repo : homedir()
    if (value.trim()) await git(cwd, ['config', `--${scope}`, key, value.trim()])
    else await git(cwd, ['config', `--${scope}`, '--unset', key], { okCodes: [5] })
  },

  /** Opens the global or this repository's git config file in the editor git would use; returns its path. */
  async openGitConfig(repo: string | null, scope: GitConfigScope) {
    return openConfigFile(repo, scope)
  },

  /** The path of that config file (for display). */
  gitConfigPath: (repo: string | null, scope: GitConfigScope) => configFilePath(repo, scope),

  /** Which of the executables exist on this machine (PATH and the usual install folders). */
  async findExecutables(exes: string[]) {
    return findExecutables(exes)
  },

  /** What the Git page needs to explain: an editor environment override, and .gitattributes line-ending rules. */
  async gitConfigContext(repo: string | null) {
    const attributes = repo ? await fs.readFile(path.join(repo, '.gitattributes'), 'utf8').catch(() => '') : ''
    return { editorEnv: process.env.GIT_EDITOR?.trim() || null, attributesSetLineEndings: setsLineEndings(attributes) }
  },

  /**
   * Which git Oak runs and its version (or why it can't run). When plain "git" isn't on PATH, the
   * standard Git for Windows locations are tried too: a Git installed while Oak was running isn't on
   * this process's PATH until a restart, and this lets "Check again" pick it up straight away.
   */
  async gitInfo(): Promise<{ binary: string; version: string | null; location: string | null; error: string | null }> {
    const probe = async () => {
      const [version, location] = await Promise.all([git(homedir(), ['--version']), git(homedir(), ['--exec-path'])])
      return { binary: getGitBinary(), version: version.trim(), location: location.trim(), error: null }
    }
    try {
      return await probe()
    } catch (e) {
      if (getGitBinary() === 'git' && process.platform === 'win32') {
        const roots = [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs')]
        const found = roots.filter(Boolean).map((r) => path.join(r!, 'Git', 'cmd', 'git.exe')).find((p) => existsSync(p))
        if (found) {
          detectedGit = found
          setGitBinary(found)
          try {
            return await probe()
          } catch {
            setGitBinary('git')
          }
        }
      }
      return { binary: getGitBinary(), version: null, location: null, error: e instanceof Error ? e.message : String(e) }
    }
  },

  async appVersion() {
    return app.getVersion()
  },

  async releaseNotesContext() {
    return { version: app.getVersion(), installed: app.isPackaged }
  },

  async openReleaseNotes(version?: string) {
    const base = 'https://github.com/benfo/oak/releases'
    await shell.openExternal(version && /^\d+\.\d+\.\d+$/.test(version) ? `${base}/tag/v${version}` : base)
  },

  // ---- self-update (updater.ts) ----

  async updateStatus() {
    return updateStatus()
  },

  checkForUpdates: () => checkForUpdates(),

  async installUpdate() {
    installUpdate()
  },

  async pickFile(title: string, filters: { name: string; extensions: string[] }[]): Promise<string | null> {
    const opts: OpenDialogOptions = { title, filters, properties: ['openFile'] }
    const win = BrowserWindow.getFocusedWindow()
    const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    return res.canceled ? null : res.filePaths[0]
  },

  /** Opens a web page in the default browser (https only). */
  async openUrl(url: string) {
    if (url.startsWith('https://')) await shell.openExternal(url)
  },

  async setGitPath(p: string) {
    // Empty = automatic: git from PATH, or the Git for Windows install found by gitInfo.
    setGitBinary(p.trim() || detectedGit || 'git')
  },

  /** Opens (creating if needed) the folder custom theme files go in. */
  async openThemesFolder() {
    await fs.mkdir(themesDir(), { recursive: true })
    await shell.openPath(themesDir())
  },

  /** Writes a new custom theme file (never overwriting one) and shows it in the folder. */
  async createThemeFile(theme: { name: string; base: 'light' | 'dark'; colors: Record<string, string> }) {
    await fs.mkdir(themesDir(), { recursive: true })
    const slug = theme.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'theme'
    let file = path.join(themesDir(), `${slug}.json`)
    for (let n = 2; existsSync(file); n++) file = path.join(themesDir(), `${slug}-${n}.json`)
    await fs.writeFile(file, JSON.stringify(theme, null, 2) + '\n', { flag: 'wx' })
    shell.showItemInFolder(file)
    return path.basename(file)
  }
}

export type Handlers = typeof handlers
