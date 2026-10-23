import { test } from 'node:test'
import assert from 'node:assert/strict'
import { singleLane, splitFileLogChunk } from '../src/shared/fileLog.ts'
import { buildGraph } from '../src/renderer/src/lib/graph.ts'
import type { Commit } from '../src/shared/types.ts'

const commit = (hash: string, ...parents: string[]): Commit => ({ hash, parents, author: '', email: '', date: 0, subject: hash, refs: [] })

test('single lane links each commit to the next and draws one column', () => {
  const lane = singleLane([commit('c', 'x', 'y'), commit('b', 'z'), commit('a')])
  assert.deepEqual(lane.map((c) => c.parents), [['b'], ['a'], []])
  assert.ok(buildGraph(lane).rows.every((row) => row.col === 0))
})

test('file log chunks give the path at that commit, following renames', () => {
  assert.deepEqual(splitFileLogChunk('rec\n\nM\tb.txt', 'b.txt'), { record: 'rec', path: 'b.txt', status: 'M' })
  assert.deepEqual(splitFileLogChunk('rec\n\nR100\ta.txt\tb.txt', 'b.txt'), { record: 'rec', path: 'b.txt', status: 'R', oldPath: 'a.txt' })
  assert.equal(splitFileLogChunk('rec\n\nR090\told.txt\tnew.txt', 'x').path, 'new.txt')
  assert.deepEqual(splitFileLogChunk('rec\n', 'fallback.txt'), { record: 'rec', path: 'fallback.txt' })
})
