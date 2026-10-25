import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findHits, findRanges, gotoLine } from '../src/shared/find.ts'

test('find marks every occurrence in any case, without overlaps', () => {
  assert.deepEqual(findRanges('Foo foo.FOO', 'foo'), [
    [0, 3],
    [4, 7],
    [8, 11]
  ])
  assert.deepEqual(findRanges('aaaa', 'aa'), [
    [0, 2],
    [2, 4]
  ])
  assert.deepEqual(findRanges('abc', 'x'), [])
  assert.deepEqual(findRanges('abc', ''), [])
})

test('a line with the text twice counts twice, in reading order', () => {
  assert.deepEqual(
    findHits(
      ['a ed ed', 'none', 'ED'].map((text) => ({ text })),
      'ed'
    ),
    [
      { line: 0, start: 2, end: 4 },
      { line: 0, start: 5, end: 7 },
      { line: 2, start: 0, end: 2 }
    ]
  )
  assert.deepEqual(findHits([{ text: 'x' }], ''), [])
})

test('a ":N" query names a line, kept within the file', () => {
  assert.equal(gotoLine(':3', 4), 2)
  assert.equal(gotoLine(': 3 ', 4), 2)
  assert.equal(gotoLine(':0', 4), 0)
  assert.equal(gotoLine(':99', 4), 3)
  assert.equal(gotoLine(':', 4), null)
  assert.equal(gotoLine(':x', 4), null)
  assert.equal(gotoLine('3', 4), null)
  assert.equal(gotoLine(':3', 0), null)
})
