import assert from 'node:assert/strict'
import { test } from 'node:test'
import { capRefs, hiddenRefsLabel } from '../src/renderer/src/history/refBadge.ts'

const tags = (n: number) => Array.from({ length: n }, (_, i) => ({ type: 'tag', name: `v${i}`, current: false }))

test('a commit with few refs shows them all', () => {
  const { shown, hidden } = capRefs(tags(3), 6)
  assert.equal(shown.length, 3)
  assert.equal(hidden.length, 0)
})

test('refs past the cap fold into the hidden list, in order', () => {
  const { shown, hidden } = capRefs(tags(10), 6)
  assert.deepEqual(
    shown.map((r) => r.name),
    ['v0', 'v1', 'v2', 'v3', 'v4', 'v5']
  )
  assert.deepEqual(
    hidden.map((r) => r.name),
    ['v6', 'v7', 'v8', 'v9']
  )
})

test('the checked-out branch stays visible even past the cap', () => {
  const refs = [...tags(9), { type: 'local', name: 'main', current: true }]
  const { shown, hidden } = capRefs(refs, 6)
  assert.ok(shown.some((r) => r.name === 'main'))
  assert.equal(shown.length + hidden.length, refs.length)
})

test('the tooltip lists the first names and counts the rest', () => {
  assert.equal(hiddenRefsLabel([{ name: 'a' }, { name: 'b' }]), 'a, b')
  const label = hiddenRefsLabel(Array.from({ length: 25 }, (_, i) => ({ name: `t${i}` })))
  assert.ok(label.endsWith('and 5 more'))
})
