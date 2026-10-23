import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildChangeRows, changeTreeOrder, expandTo, folderStats, toggled } from '../src/renderer/src/lib/changeTree.ts'

const f = (path: string, additions: number | null = 1, deletions: number | null = 0) => ({ path, additions, deletions })

test('folders come first, single-folder chains are compressed, files sort within folders', () => {
  const rows = buildChangeRows([f('README.md'), f('auth0/deploy/b.js'), f('auth0/deploy/a.js'), f('src/x/y.ts'), f('src/z.ts')], new Set())
  assert.deepEqual(rows.map((r) => [r.depth, r.name, r.folder]), [
    [0, 'auth0/deploy', true], [1, 'a.js', false], [1, 'b.js', false],
    [0, 'src', true], [1, 'x', true], [2, 'y.ts', false], [1, 'z.ts', false],
    [0, 'README.md', false]
  ])
  assert.equal(rows[0].id, 'auth0/deploy')
  assert.equal(rows[1].parent, 'auth0/deploy')
  assert.equal(rows[0].parent, null)
})

test('collapsed folders hide their rows but keep every file for folder actions', () => {
  const entries = [f('a/b.ts'), f('a/c/d.ts')]
  const rows = buildChangeRows(entries, new Set(['a']))
  assert.deepEqual(rows.map((r) => r.id), ['a'])
  assert.deepEqual(rows[0].files.map((e) => e.path).sort(), ['a/b.ts', 'a/c/d.ts'])
  assert.deepEqual(changeTreeOrder(entries).map((e) => e.path), ['a/c/d.ts', 'a/b.ts'])
})

test('expandTo opens only folders that hide the file; toggled flips one folder', () => {
  const collapsed = new Set(['a', 'a/c', 'other'])
  assert.deepEqual([...expandTo(collapsed, 'a/c/d.ts')], ['other'])
  assert.equal(expandTo(collapsed, 'zzz/file.ts'), collapsed)
  assert.deepEqual([...toggled(new Set(['a']), 'a')], [])
  assert.deepEqual([...toggled(new Set(), 'a')], ['a'])
})

test('folder stats skip files without counts', () => {
  assert.deepEqual(folderStats([f('a', 3, 1), f('b', null, null), f('c', 2, 0)]), { additions: 5, deletions: 1 })
})
