import test from 'node:test'
import assert from 'node:assert/strict'
import { fuzzyPositions, prepareFuzzy, rankFuzzy } from '../src/renderer/src/lib/fuzzy.ts'

// The contract any replacement matcher must keep.
const names = ['release/1.0', 'feature/login', 'main', 'hotfix-login']
const rank = (query: string, skip?: string) => rankFuzzy(query, names, (n) => (n === skip ? null : prepareFuzzy(n)), 10).map((r) => r.entry)

test('returns matching entries only, best first', () => {
  assert.equal(rank('main')[0], 'main')
  assert.deepEqual(rank('login').sort(), ['feature/login', 'hotfix-login'])
  assert.deepEqual(rank('zzz'), [])
})

test('a null target never matches and the limit applies', () => {
  assert.ok(!rank('main', 'main').includes('main'))
  assert.equal(rankFuzzy('e', names, (n) => prepareFuzzy(n), 2).length, 2)
})

test('reports matched character positions for highlighting', () => {
  assert.deepEqual([...fuzzyPositions('mn', 'main')].sort(), [0, 3])
  assert.equal(fuzzyPositions('zzz', 'main').size, 0)
})
