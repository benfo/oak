import { spawn } from 'child_process'
import { getGitBinary } from './git.ts'

/**
 * One `git cat-file --batch` process reads a blob and its size together (process start-up dominates on Windows).
 * Stops reading as soon as the header shows the blob is over `limit`. Resolves null when the object is missing.
 */
export function readBlob(repo: string, spec: string, limit: number): Promise<{ size: number; data: Buffer } | null> {
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
