import { spawn } from 'child_process'
import { AsyncLocalStorage } from 'async_hooks'

interface GitOptions {
  input?: string
  okCodes?: number[]
  /** Fail instead of asking for credentials (also suppresses Git Credential Manager's window). */
  noPrompt?: boolean
}

const BASE_ARGS = ['--no-optional-locks', '-c', 'core.quotepath=false', '-c', 'color.ui=false']

const ENV = {
  ...process.env,
  GIT_TERMINAL_PROMPT: '0',
  GIT_EDITOR: 'true',
  GIT_SEQUENCE_EDITOR: 'true',
  GIT_MERGE_AUTOEDIT: 'no'
}

/**
 * When set (via `outputSink.run(fn, ...)`), every git process started inside that async call
 * streams its stdout/stderr — including hook output and --progress — to the function.
 */
export const outputSink = new AsyncLocalStorage<(text: string) => void>()

const PROGRESS =
  /^(remote: )?(Enumerating|Counting|Compressing|Writing|Receiving|Resolving|Total|Delta compression|Unpacking|Updating files)/

/** Error text without progress noise: carriage-return overwrites collapsed, progress lines dropped. */
function cleanError(text: string) {
  return text
    .split('\n')
    .map((l) => l.split('\r').filter(Boolean).pop() ?? '')
    .filter((l) => l.trim() && !PROGRESS.test(l.trim()))
    .join('\n')
    .trim()
}

/** The git executable: "git" from PATH unless Preferences names one. */
let gitBinary = 'git'
export const setGitBinary = (p: string) => void (gitBinary = p.trim() || 'git')
export const getGitBinary = () => gitBinary

/** Runs the system git binary and resolves with stdout. Rejects with stderr on failure. */
export function git(cwd: string, args: string[], opts: GitOptions = {}): Promise<string> {
  const sink = outputSink.getStore()
  return new Promise((resolve, reject) => {
    const env = opts.noPrompt ? { ...ENV, GCM_INTERACTIVE: 'never', GIT_ASKPASS: '', SSH_ASKPASS: '' } : ENV
    const child = spawn(gitBinary, [...BASE_ARGS, ...args], { cwd, env, windowsHide: true })
    const out: Buffer[] = []
    const err: Buffer[] = []
    child.stdout.on('data', (d: Buffer) => {
      out.push(d)
      sink?.(d.toString('utf8'))
    })
    child.stderr.on('data', (d: Buffer) => {
      err.push(d)
      sink?.(d.toString('utf8'))
    })
    child.on('error', (e) => reject(new Error(`Could not run git: ${e.message}`)))
    child.on('close', (code) => {
      const stdout = Buffer.concat(out).toString('utf8')
      if (code === 0 || (code !== null && opts.okCodes?.includes(code))) return resolve(stdout)
      const stderr = cleanError(Buffer.concat(err).toString('utf8'))
      reject(new Error(stderr || cleanError(stdout) || `git ${args[0]} exited with code ${code}`))
    })
    // Git can finish or reject a patch before consuming all input. Its exit status and stderr
    // remain authoritative; an early pipe closure must not become an uncaught process error.
    child.stdin.on('error', (e: NodeJS.ErrnoException) => {
      if (e.code !== 'EPIPE' && e.code !== 'EOF') reject(new Error(`Could not write to git: ${e.message}`))
    })
    child.stdin.end(opts.input)
  })
}
