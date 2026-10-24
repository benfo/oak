import { useEffect, useState } from 'react'
import type { FileDiff } from './diff'
import { assignTokens, diffBlocks, diffPath, type DiffTokens, type Span } from './syntax'

/*
 * Client for the highlighting worker. One request in flight at a time: while it runs, a newer
 * request replaces any waiting one, so arrowing through files never builds a queue. Results are
 * cached by diff text, so going back to a file shows its colours at once.
 */

interface Job {
  path: string
  blocks: string[]
  resolve: (tokens: Span[][][] | null) => void
}

let worker: Worker | null = null
let busy = false
let waiting: Job | null = null
let nextId = 0

function send(job: Job) {
  worker ??= new Worker(new URL('../highlight.worker.ts', import.meta.url), { type: 'module' })
  busy = true
  const id = ++nextId
  worker.onmessage = (e: MessageEvent<{ id: number; tokens: Span[][][] | null; error?: string }>) => {
    if (e.data.id !== id) return
    if (e.data.error) console.warn('syntax highlighting failed:', e.data.error)
    busy = false
    job.resolve(e.data.tokens)
    const next = waiting
    waiting = null
    if (next) send(next)
  }
  worker.postMessage({ id, path: job.path, blocks: job.blocks })
}

function request(path: string, blocks: string[]): Promise<Span[][][] | null> {
  return new Promise((resolve) => {
    const job = { path, blocks, resolve }
    if (!busy) return send(job)
    waiting?.resolve(null)
    waiting = job
  })
}

const CACHE_SIZE = 30
const cache = new Map<string, DiffTokens | null>()

/** Highlighted tokens for the first `hunkCount` hunks of a diff, or null until ready (or when off / not code). */
export function useDiffTokens(diff: FileDiff | null, text: string | null, hunkCount: number, enabled: boolean): DiffTokens | null {
  const key = text === null ? null : `${hunkCount}\u0000${text}`
  const [result, setResult] = useState<{ key: string; tokens: DiffTokens | null } | null>(null)

  useEffect(() => {
    if (!enabled || !diff || key === null || diff.binary || !diff.hunks.length) return
    if (cache.has(key)) return setResult({ key, tokens: cache.get(key)! })
    const path = diffPath(diff)
    if (!path) return
    let live = true
    request(path, diffBlocks(diff, hunkCount)).then((blocks) => {
      const tokens = blocks && assignTokens(diff, blocks)
      if (blocks) {
        cache.set(key, tokens)
        if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value!)
      }
      if (live) setResult({ key, tokens })
    })
    return () => void (live = false)
  }, [key, enabled])

  if (!enabled || key === null) return null
  if (result?.key === key) return result.tokens
  return cache.get(key) ?? null
}
