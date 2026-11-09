import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_NAV_ENTRIES,
  canGoBack,
  canGoForward,
  currentEntry,
  emptyNavHistory,
  pushEntry,
  stepHistory,
  updateCurrent
} from '../src/shared/navHistory.ts'

const same = (a: string, b: string) => a === b
const build = (...places: string[]) => places.reduce((h, p) => pushEntry(h, p, same), emptyNavHistory<string>())

test('push moves to the new entry and ignores a repeat of the current place', () => {
  const h = build('a', 'b', 'b')
  assert.deepEqual(h.entries, ['a', 'b'])
  assert.equal(currentEntry(h), 'b')
  assert.ok(canGoBack(h))
  assert.ok(!canGoForward(h))
})

test('going back several times then forward walks the same path', () => {
  let h = build('a', 'b', 'c')
  const seen: string[] = []
  for (let step = stepHistory(h, -1, () => true); step; step = stepHistory(h, -1, () => true)) {
    h = step.history
    seen.push(step.entry)
  }
  assert.deepEqual(seen, ['b', 'a'])
  assert.equal(stepHistory(h, 1, () => true)?.entry, 'b')
})

test('pushing after going back drops the forward entries', () => {
  const back = stepHistory(build('a', 'b', 'c'), -1, () => true)!
  const h = pushEntry(back.history, 'd', same)
  assert.deepEqual(h.entries, ['a', 'b', 'd'])
  assert.ok(!canGoForward(h))
})

test('stepping skips entries that no longer exist and reports nothing when none remain', () => {
  const h = build('a', 'gone', 'c')
  assert.equal(stepHistory(h, -1, (e) => e !== 'gone')?.entry, 'a')
  assert.equal(
    stepHistory(h, -1, () => false),
    undefined
  )
  assert.equal(
    stepHistory(h, 1, () => true),
    undefined
  )
})

test('updateCurrent replaces only the current entry', () => {
  const back = stepHistory(build('a', 'b'), -1, () => true)!
  assert.deepEqual(updateCurrent(back.history, 'a2').entries, ['a2', 'b'])
  assert.equal(updateCurrent(emptyNavHistory<string>(), 'x').entries.length, 0)
})

test('the stack is capped, keeping the newest entries', () => {
  const places = Array.from({ length: MAX_NAV_ENTRIES + 5 }, (_, i) => `p${i}`)
  const h = build(...places)
  assert.equal(h.entries.length, MAX_NAV_ENTRIES)
  assert.equal(currentEntry(h), places.at(-1))
  assert.equal(h.entries[0], 'p5')
})
