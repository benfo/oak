import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { compareReleaseVersions, notesForRelease, shouldShowReleaseNotice } from '../src/renderer/src/lib/releaseNotes.ts'
const { releaseNotes } = createRequire(import.meta.url)('../scripts/release-notes.cjs')

test('fresh installs, repeated launches and downgrades do not show an update notice', () => {
  assert.equal(shouldShowReleaseNotice('0.1.5', '0.1.4', true), true)
  assert.equal(shouldShowReleaseNotice('0.1.4', null, false), false)
  assert.equal(shouldShowReleaseNotice('0.1.4', '0.1.4', true), false)
  assert.equal(shouldShowReleaseNotice('0.1.3', '0.1.4', true), false)
  assert.equal(shouldShowReleaseNotice('0.1.4', '0.1.3', true), true)
  assert.equal(shouldShowReleaseNotice('0.1.4', null, true), true)
  assert.equal(shouldShowReleaseNotice('0.1.99', '0.1.4', true), false)
})

test('skipped releases appear in order, without future or already seen notes', () => {
  assert.deepEqual(notesForRelease('0.1.5', '0.1.3').map((n) => n.version), ['0.1.5', '0.1.4'])
  assert.deepEqual(notesForRelease('0.1.4', '0.1.1').map((n) => n.version), ['0.1.4', '0.1.3', '0.1.2'])
  assert.deepEqual(notesForRelease('0.1.4').map((n) => n.version), ['0.1.4'])
  assert.deepEqual(notesForRelease('0.1.3').map((n) => n.version), ['0.1.3'])
  assert.equal(compareReleaseVersions('0.1.10', '0.1.9'), 1)
  assert.equal(compareReleaseVersions('0.1.4-beta', '0.1.3'), null)
})

test('GitHub release notes use the same curated highlights and fixes as the app', () => {
  const text = releaseNotes('0.1.5')
  for (const entry of notesForRelease('0.1.5')) {
    for (const highlight of entry.highlights) {
      assert.ok(text.includes(highlight.title))
      assert.ok(text.includes(highlight.text))
    }
    for (const fix of entry.fixes) assert.ok(text.includes(fix))
  }
  assert.throws(() => releaseNotes('0.1.99'), /Add release notes/)
})
