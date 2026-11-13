import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildGraph, firstParentLine } from '../src/renderer/src/history/graph.ts'
import { lineChild, lineParent, stepTrail, type FollowTrail } from '../src/renderer/src/history/followLine.ts'
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
const rows = buildGraph(commits).rows
const child = (hash: string, head: string | null = 'm2', trail: FollowTrail = []) =>
  lineChild(commits, rows, at(hash), { trail, headLine: firstParentLine(commits, head) })

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
  // The checked-out line wins over the lane, whatever the graph emphasises.
  assert.deepEqual(child('base', 'f2'), { hash: 'f1' })
  // Detached elsewhere, the lane decides: base continues in the lane its first child, m1, opened.
  assert.deepEqual(child('base', null), { hash: 'm1' })
})

test('up retraces the walk down, back onto the branch it started on', () => {
  let trail: FollowTrail = []
  trail = stepTrail(trail, 'f2', 'f1', 'parent')
  trail = stepTrail(trail, 'f1', 'base', 'parent')
  assert.deepEqual(child('base', 'm2', trail), { hash: 'f1' })
  trail = stepTrail(trail, 'base', 'f1', 'child')
  assert.deepEqual(child('f1', 'm2', trail), { hash: 'f2' })
  // Away from the trail's end, the usual preference applies.
  assert.deepEqual(child('m1', 'm2', trail), { hash: 'merge' })
  // A walk down from elsewhere starts a new trail.
  assert.deepEqual(stepTrail(trail, 'merge', 'm1', 'parent'), ['merge', 'm1'])
})

test('up from a merged branch tip goes to the merge that took it in', () => {
  assert.deepEqual(child('f2'), { hash: 'merge' })
})
