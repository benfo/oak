import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { previewRefs, sameVersions, PREVIEW_MAX_BYTES } from '../src/shared/filePreview.ts'
import { hasExtension } from '../src/shared/fileKinds.ts'
import { createPreviewRegistry, type Previewer } from '../src/shared/previewRegistry.ts'
import { fileVersions } from '../src/main/fileVersions.ts'

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd })
    .toString()
    .trim()
const text = (v: { state: string; bytes?: Uint8Array }) => (v.state === 'ok' ? Buffer.from(v.bytes!).toString() : v.state)

/** A throwaway repo, set up by `setup`, removed afterwards (retrying, as a killed git process can hold its folder a moment on Windows). */
async function withRepo(setup: (dir: string) => void, body: (dir: string) => Promise<void>) {
  const dir = mkdtempSync(join(tmpdir(), 'oak-preview-'))
  try {
    git(dir, 'init', '-q')
    setup(dir)
    await body(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
  }
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
  await withRepo(
    (d) => {
      writeFileSync(join(d, 'a.svg'), '<svg>1</svg>')
      git(d, 'add', '.')
      git(d, 'commit', '-qm', 'one')
      writeFileSync(join(d, 'a.svg'), '<svg>2</svg>')
    },
    async (dir) => {
      const v = await fileVersions(dir, { kind: 'headToWorking', file: 'a.svg' })
      assert.equal(text(v.before), '<svg>1</svg>')
      assert.equal(text(v.after), '<svg>2</svg>')
    }
  )
})

test('an untracked file has a missing before and a deleted file a missing after', async () => {
  await withRepo(
    (d) => {
      writeFileSync(join(d, 'gone.svg'), '<svg/>')
      git(d, 'add', '.')
      git(d, 'commit', '-qm', 'one')
      rmSync(join(d, 'gone.svg'))
      writeFileSync(join(d, 'new.svg'), '<svg>n</svg>')
    },
    async (dir) => {
      const added = await fileVersions(dir, { kind: 'working', diffKind: 'untracked', file: 'new.svg' })
      assert.deepEqual([added.before.state, text(added.after)], ['missing', '<svg>n</svg>'])
      const deleted = await fileVersions(dir, { kind: 'headToWorking', file: 'gone.svg' })
      assert.deepEqual([text(deleted.before), deleted.after.state], ['<svg/>', 'missing'])
    }
  )
})

test('a commit reads each side at its own path, and a root commit has no before', async () => {
  await withRepo(
    (d) => {
      mkdirSync(join(d, 'img'))
      writeFileSync(join(d, 'img', 'a.svg'), '<svg>a</svg>')
      git(d, 'add', '.')
      git(d, 'commit', '-qm', 'one')
      git(d, 'mv', 'img/a.svg', 'img/b.svg')
      git(d, 'commit', '-qm', 'two')
    },
    async (dir) => {
      const [two, one] = git(dir, 'rev-list', 'HEAD').split('\n')
      const moved = await fileVersions(dir, { kind: 'commit', hash: two, parent: one, file: 'img/b.svg', oldPath: 'img/a.svg' })
      assert.deepEqual([text(moved.before), text(moved.after)], ['<svg>a</svg>', '<svg>a</svg>'])
      const root = await fileVersions(dir, { kind: 'commit', hash: one, parent: null, file: 'img/a.svg' })
      assert.deepEqual([root.before.state, text(root.after)], ['missing', '<svg>a</svg>'])
    }
  )
})

test('a file over the size cap is reported, not loaded', async () => {
  await withRepo(
    (d) => {
      writeFileSync(join(d, 'big.svg'), Buffer.alloc(PREVIEW_MAX_BYTES + 1, 'a'))
      git(d, 'add', '.')
      git(d, 'commit', '-qm', 'one')
    },
    async (dir) => {
      const v = await fileVersions(dir, { kind: 'headToWorking', file: 'big.svg' })
      assert.deepEqual([v.before.state, v.after.state], ['tooLarge', 'tooLarge'])
    }
  )
})

test('a reload with the same content counts as nothing new', () => {
  const ok = (...bytes: number[]) => ({ state: 'ok' as const, bytes: new Uint8Array(bytes) })
  const missing = { state: 'missing' as const }
  assert.equal(sameVersions({ before: missing, after: ok(1, 2) }, { before: missing, after: ok(1, 2) }), true)
  assert.equal(sameVersions({ before: missing, after: ok(1, 2) }, { before: missing, after: ok(1, 3) }), false)
  assert.equal(sameVersions({ before: ok(1), after: ok(1) }, { before: missing, after: ok(1) }), false)
})
