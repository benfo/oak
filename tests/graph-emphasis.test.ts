import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildGraph } from '../src/renderer/src/history/graph.ts'
import type { Commit } from '../src/shared/types.ts'

const commit = (hash: string, ...parents: string[]): Commit => ({ hash, parents, author: '', email: '', date: 0, subject: hash, refs: [] })

test('current emphasis follows first parents through merges and shared history, including passthrough rows', () => {
  const commits = [
    commit('tip', 'merge'),
    commit('other', 'base'),
    commit('merge', 'first', 'side'),
    commit('side', 'base'),
    commit('first', 'base'),
    commit('base')
  ]
  const graph = buildGraph(commits, 'tip')
  assert.deepEqual(
    graph.rows.map((row) => row.current),
    [true, false, true, false, true, true]
  )
  assert.equal(graph.rows[1].top.filter((e) => e.current).length, 1)
  assert.equal(graph.rows[1].bottom.filter((e) => e.current).length, 1)
  assert.equal(graph.rows[2].bottom.filter((e) => e.current).length, 1, 'merge only emphasizes its first-parent connection')
  assert.equal(graph.rows[3].bottom.find((e) => e.from === graph.rows[3].col)?.current, false, 'merged side path remains soft')
  assert.equal(graph.rows[5].top.filter((e) => e.current).length, 1, 'other paths joining shared ancestor remain soft')
})

test('a newer branch sharing the same lane colour does not become part of the checked-out path', () => {
  const commits = [commit('newer', 'head'), commit('head', 'base'), commit('base')]
  const graph = buildGraph(commits, 'head')
  assert.equal(graph.rows[0].color, graph.rows[1].color)
  assert.equal(graph.rows[0].current, false)
  assert.equal(graph.rows[0].bottom[0].current, false)
  assert.equal(graph.rows[1].top[0].current, false)
  assert.equal(graph.rows[1].bottom[0].current, true)
})

test('checkout changes the highlighted path without changing graph geometry and missing heads leave it neutral', () => {
  const commits = [commit('a', 'base'), commit('b', 'base'), commit('base')]
  const geometry = (head?: string) => JSON.stringify(buildGraph(commits, head), (key, value) => (key === 'current' ? undefined : value))
  assert.equal(geometry('a'), geometry('b'))
  assert.equal(geometry(), geometry('a'))
  assert.deepEqual(
    buildGraph(commits, 'b').rows.map((r) => r.current),
    [false, true, true]
  )
  assert.ok(buildGraph(commits, 'unloaded').rows.every((r) => !r.current && [...r.top, ...r.bottom].every((e) => !e.current)))
  assert.equal(buildGraph([commit('last-loaded', 'not-loaded')], 'last-loaded').rows[0].bottom[0].current, true)
})
