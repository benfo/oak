import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { previewRefs, PREVIEW_MAX_BYTES } from '../src/shared/filePreview.ts'
import { createPreviewRegistry, hasExtension, type Previewer } from '../src/shared/previewRegistry.ts'
import { fileVersions } from '../src/main/fileVersions.ts'

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd })
    .toString()
    .trim()
const text = (v: { state: string; bytes?: Uint8Array }) => (v.state === 'ok' ? Buffer.from(v.bytes!).toString() : v.state)

function repoWith(setup: (dir: string) => void) {
  const dir = mkdtempSync(join(tmpdir(), 'oak-preview-'))
  git(dir, 'init', '-q')
  setup(dir)
  return dir
}

test('an unstaged change compares the index with the working tree', () => {
  assert.deepEqual(previewRefs({ kind: 'working', diffKind: 'unstaged', file: 'a.svg' }), {
    before: { from: 'git', spec: ':a.svg' },
    after: { from: 'disk', file: 'a.svg' }
  })
})

test('a staged change compares HEAD with the index, reading a rename from its old path', () => {
  assert.deepEqual(previewRefs({ kind: 'working', diffKind: 'staged', file: 'new.svg', oldPath: 'old.svg' }), {
    before: { from: 'git', spec: 'HEAD:old.svg' },
    after: { from: 'git', spec: ':new.svg' }
  })
})

test('an untracked file has no before', () => {
  assert.equal(previewRefs({ kind: 'working', diffKind: 'untracked', file: 'a.svg' }).before, null)
})

test('a commit compares its parent with itself, and a root commit has no before', () => {
  assert.deepEqual(previewRefs({ kind: 'commit', hash: 'c1', parent: 'p1', file: 'b.svg', oldPath: 'a.svg' }), {
    before: { from: 'git', spec: 'p1:a.svg' },
    after: { from: 'git', spec: 'c1:b.svg' }
  })
  assert.equal(previewRefs({ kind: 'commit', hash: 'c1', parent: null, file: 'a.svg' }).before, null)
})

test('the registry hands back the first previewer that matches, or null', () => {
  const previewer = (id: string, ext: string): Previewer<string> => ({
    id,
    label: id,
    matches: (p) => hasExtension(p, new Set([ext])),
    defaultMode: 'preview',
    view: id
  })
  const registry = createPreviewRegistry([previewer('svg', 'svg'), previewer('png', 'png')])
  assert.equal(registry.previewerFor('icons/Logo.SVG')?.id, 'svg')
  assert.equal(registry.previewerFor('a/b.png')?.id, 'png')
  assert.equal(registry.previewerFor('src/app.ts'), null)
  assert.equal(registry.previewerFor('svg'), null)
})

test('reading a modified file gives the committed and working versions', async () => {
  const dir = repoWith((d) => {
    writeFileSync(join(d, 'a.svg'), '<svg>1</svg>')
    git(d, 'add', '.')
    git(d, 'commit', '-qm', 'one')
    writeFileSync(join(d, 'a.svg'), '<svg>2</svg>')
  })
  try {
    const v = await fileVersions(dir, { kind: 'headToWorking', file: 'a.svg' })
    assert.equal(text(v.before), '<svg>1</svg>')
    assert.equal(text(v.after), '<svg>2</svg>')
  } finally {
    rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
  }
})

test('an untracked file has a missing before and a deleted file a missing after', async () => {
  const dir = repoWith((d) => {
    writeFileSync(join(d, 'gone.svg'), '<svg/>')
    git(d, 'add', '.')
    git(d, 'commit', '-qm', 'one')
    rmSync(join(d, 'gone.svg'))
    writeFileSync(join(d, 'new.svg'), '<svg>n</svg>')
  })
  try {
    const added = await fileVersions(dir, { kind: 'working', diffKind: 'untracked', file: 'new.svg' })
    assert.deepEqual([added.before.state, text(added.after)], ['missing', '<svg>n</svg>'])
    const deleted = await fileVersions(dir, { kind: 'headToWorking', file: 'gone.svg' })
    assert.deepEqual([text(deleted.before), deleted.after.state], ['<svg/>', 'missing'])
  } finally {
    rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
  }
})

test('a commit reads each side at its own path, and a root commit has no before', async () => {
  const dir = repoWith((d) => {
    mkdirSync(join(d, 'img'))
    writeFileSync(join(d, 'img', 'a.svg'), '<svg>a</svg>')
    git(d, 'add', '.')
    git(d, 'commit', '-qm', 'one')
    git(d, 'mv', 'img/a.svg', 'img/b.svg')
    git(d, 'commit', '-qm', 'two')
  })
  try {
    const [two, one] = git(dir, 'rev-list', 'HEAD').split('\n')
    const moved = await fileVersions(dir, { kind: 'commit', hash: two, parent: one, file: 'img/b.svg', oldPath: 'img/a.svg' })
    assert.deepEqual([text(moved.before), text(moved.after)], ['<svg>a</svg>', '<svg>a</svg>'])
    const root = await fileVersions(dir, { kind: 'commit', hash: one, parent: null, file: 'img/a.svg' })
    assert.deepEqual([root.before.state, text(root.after)], ['missing', '<svg>a</svg>'])
  } finally {
    rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
  }
})

test('a file over the size cap is reported, not loaded', async () => {
  const dir = repoWith((d) => {
    writeFileSync(join(d, 'big.svg'), Buffer.alloc(PREVIEW_MAX_BYTES + 1, 'a'))
    git(d, 'add', '.')
    git(d, 'commit', '-qm', 'one')
  })
  try {
    const v = await fileVersions(dir, { kind: 'headToWorking', file: 'big.svg' })
    assert.deepEqual([v.before.state, v.after.state], ['tooLarge', 'tooLarge'])
  } finally {
    rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
  }
})
