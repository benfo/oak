import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

const ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 'Oak Test',
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'Oak Test',
  GIT_COMMITTER_EMAIL: 'test@example.com'
}

export const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, env: ENV }).toString()

export const tempDir = (prefix: string) => mkdtempSync(join(tmpdir(), `oak-ui-${prefix}-`))

export const removeDir = (dir: string) => rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })

export function write(repo: string, file: string, content: string) {
  const path = join(repo, file)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}

export function initRepo(dir: string) {
  git(dir, 'init', '-q', '-b', 'main')
  git(dir, 'config', 'core.autocrlf', 'false')
}

export function commitAll(repo: string, message: string) {
  git(repo, 'add', '-A')
  git(repo, 'commit', '-q', '-m', message)
}

export const numberedLines = (count: number, change: (n: number) => string | null = () => null) =>
  Array.from({ length: count }, (_, i) => change(i + 1) ?? `const value${i + 1} = ${i + 1}`).join('\n') + '\n'

/** A small repo with a modified TypeScript file that has three well separated hunks, plus an untracked file. */
export function smallRepo(dir: string) {
  initRepo(dir)
  write(dir, 'src/app.ts', numberedLines(120))
  write(dir, 'README.md', '# Demo\n')
  commitAll(dir, 'Initial commit')
  write(
    dir,
    'src/app.ts',
    numberedLines(120, (n) => (n === 5 || n === 60 || n === 110 ? `const changed${n} = 'edited'` : null))
  )
  write(dir, 'notes.txt', 'untracked note\n')
}

/** Many commits in one fast-import stream, which is far quicker than committing one by one. */
export function manyCommits(dir: string, count: number) {
  initRepo(dir)
  const chunks: string[] = []
  for (let i = 1; i <= count; i++) {
    const body = `change ${i}\n`
    const message = `Commit number ${i}`
    chunks.push(
      `commit refs/heads/main\nmark :${i}\ncommitter Oak Test <test@example.com> ${1700000000 + i} +0000\n` +
        `data ${Buffer.byteLength(message)}\n${message}\n` +
        (i > 1 ? `from :${i - 1}\n` : '') +
        `M 100644 inline log.txt\ndata ${Buffer.byteLength(body)}\n${body}\n`
    )
  }
  execFileSync('git', ['fast-import', '--quiet'], { cwd: dir, env: ENV, input: chunks.join(''), maxBuffer: 1 << 28 })
  git(dir, 'reset', '-q', '--hard', 'main')
}

/** A 60,000 line file with every 100th line changed in the working tree (far enough apart to stay separate hunks). */
export function hugeDiffRepo(dir: string) {
  initRepo(dir)
  write(dir, 'big.ts', numberedLines(60_000))
  commitAll(dir, 'Add big file')
  write(
    dir,
    'big.ts',
    numberedLines(60_000, (n) => (n % 100 === 0 ? `const edited${n} = 'changed'` : null))
  )
}
