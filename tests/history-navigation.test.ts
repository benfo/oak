import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadHistoryToCommit } from '../src/renderer/src/lib/historyNavigation.ts'
import type { Commit } from '../src/shared/types.ts'

const commit = (hash: string): Commit => ({ hash, parents: [], author: 'Test', email: '', date: 0, subject: hash, refs: [] })

test('history navigation expands all-branch history until the requested commit is present', async () => {
  const requests: [number, string | undefined][] = []
  const result = await loadHistoryToCommit(
    {
      log: async (_, limit, include) => {
        requests.push([limit, include])
        return limit < 8000 ? Array.from({ length: limit }, () => commit('new')) : [commit('new'), commit('old')]
      }
    },
    'repo',
    'old',
    2000,
    () => true
  )
  assert.deepEqual(requests, [
    [4000, 'old'],
    [8000, 'old']
  ])
  assert.equal(result?.limit, 8000)
  assert.equal(result?.commits[1].hash, 'old')
})

test('cancelled or superseded navigation publishes no stale result and starts no further batches', async () => {
  let current = true
  let resolve!: (commits: Commit[]) => void
  let calls = 0
  const pending = new Promise<Commit[]>((done) => {
    resolve = done
  })
  const result = loadHistoryToCommit(
    {
      log: async () => {
        calls++
        return pending
      }
    },
    'repo',
    'old',
    2000,
    () => current
  )
  current = false
  resolve(Array.from({ length: 4000 }, () => commit('new')))
  assert.equal(await result, null)
  assert.equal(calls, 1)
  current = true
  const foundButCancelled = await loadHistoryToCommit(
    {
      log: async () => {
        current = false
        return [commit('old')]
      }
    },
    'repo',
    'old',
    2000,
    () => current
  )
  assert.equal(foundButCancelled, null)
})

test('exhausted or failed history returns an actionable failure instead of looping', async () => {
  await assert.rejects(
    loadHistoryToCommit({ log: async () => [commit('new')] }, 'repo', 'missing', 2000, () => true),
    /could not be found/
  )
  await assert.rejects(
    loadHistoryToCommit(
      {
        log: async () => {
          throw new Error('Git unavailable')
        }
      },
      'repo',
      'old',
      2000,
      () => true
    ),
    /Git unavailable/
  )
})
