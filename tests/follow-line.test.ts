import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildGraph } from '../src/renderer/src/history/graph.ts'
import { lineChild, lineParent } from '../src/renderer/src/history/followLine.ts'
import type { Commit } from '../src/shared/types.ts'

const commit = (hash: string, ...parents: string[]): Commit => ({ hash, parents, author: '', email: '', date: 0, subject: hash, refs: [] })

// main: base - m1 - merge(m1, f2) - m2 (HEAD); feature: base - f1 - f2, interleaved by date.
const commits = [
  commit('m2', 'merge'),
  commit('merge', 'm1', 'f2'),
  commit('f2', 'f1'),
  commit('m1', 'base'),
  commit('f1', 'base'),
  commit('base')
]
const at = (hash: string) => commits.findIndex((c) => c.hash === hash)
const child = (hash: string, head: string | null = 'm2') => lineChild(commits, buildGraph(commits, head).rows, at(hash))

test('down follows the first parent, skipping other branches between', () => {
  assert.deepEqual(lineParent(commits[at('merge')]), { hash: 'm1' })
  assert.deepEqual(lineParent(commits[at('m1')]), { hash: 'base' })
  assert.deepEqual(lineParent(commits[at('base')]), { none: 'root' })
})

test('up follows the child whose first parent is this commit', () => {
  assert.deepEqual(child('m1'), { hash: 'merge' })
  assert.deepEqual(child('f1'), { hash: 'f2' })
  assert.deepEqual(child('m2'), { none: 'tip' })
})

test('up from a fork prefers the checked-out line, then the same lane', () => {
  assert.deepEqual(child('base'), { hash: 'm1' })
  // Without emphasis the lane decides: base continues in the lane its first child, m1, opened.
  assert.deepEqual(child('base', null), { hash: 'm1' })
})

test('up from a merged branch tip goes to the merge that took it in', () => {
  assert.deepEqual(child('f2'), { hash: 'merge' })
})
