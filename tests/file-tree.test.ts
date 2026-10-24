import test from 'node:test'
import assert from 'node:assert/strict'
import { ancestors, buildFileTree, filesInOrder, nearestExisting, searchPaths } from '../src/renderer/src/lib/fileTree.ts'

test('builds a tree with folders before files', () => {
  const tree = buildFileTree(['b.txt', 'src/z.ts', 'src/lib/a.ts', 'a.txt'])
  assert.deepEqual(
    tree.map((e) => e.path),
    ['src', 'a.txt', 'b.txt']
  )
  assert.deepEqual(filesInOrder(tree), ['src/lib/a.ts', 'src/z.ts', 'a.txt', 'b.txt'])
})

test('ancestors are outermost first', () => {
  assert.deepEqual(ancestors('a/b/c.ts'), ['a', 'a/b'])
  assert.deepEqual(ancestors('c.ts'), [])
})

test('search matches paths and keeps all paths for an empty query', () => {
  const paths = ['src/app.ts', 'src/lib/util.ts', 'README.md']
  assert.deepEqual(searchPaths('', paths), paths)
  assert.deepEqual(searchPaths('util', paths), ['src/lib/util.ts'])
  assert.deepEqual(searchPaths('zzzz', paths), [])
})

test('missing selection falls back to the nearest existing folder', () => {
  const files = new Set(['src/lib/a.ts', 'README.md'])
  assert.equal(nearestExisting('README.md', files), 'README.md')
  assert.equal(nearestExisting('src/lib/gone.ts', files), 'src/lib')
  assert.equal(nearestExisting('src/other/x/gone.ts', files), 'src')
  assert.equal(nearestExisting('docs/x.md', files), '')
})
