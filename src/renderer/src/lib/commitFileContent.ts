import { api } from '../api'

const MAX_CACHED = 30
const cache = new Map<string, Promise<string>>()

/** A file's content at a commit never changes, so recent ones are kept for instant revisits. Failures are not cached. */
export function loadCommitFileContent(repo: string, hash: string, path: string): Promise<string> {
  const key = JSON.stringify([repo, hash, path])
  const found = cache.get(key)
  if (found) {
    cache.delete(key)
    cache.set(key, found)
    return found
  }
  const promise = api.commitFileContent(repo, hash, path).catch((error) => {
    if (cache.get(key) === promise) cache.delete(key)
    throw error
  })
  cache.set(key, promise)
  if (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value!)
  return promise
}
