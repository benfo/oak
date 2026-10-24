import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { compareReleaseVersions, notesForRelease, shouldShowReleaseNotice } from '../src/renderer/src/lib/releaseNotes.ts'
const { releaseNotes } = createRequire(import.meta.url)('../scripts/release-notes.cjs')

const note = (version: string) => ({
  version,
  highlights: [{ title: `Title ${version}`, text: `Text ${version}` }],
  fixes: [`Fix ${version}`]
})
const fixture = ['0.1.5', '0.1.4', '0.1.3', '0.1.2'].map(note)

test('fresh installs, repeated launches and downgrades do not show an update notice', () => {
  const show = (version: string, previous: string | null, existing: boolean) =>
    shouldShowReleaseNotice(version, previous, existing, fixture)
  assert.equal(show('0.1.5', '0.1.4', true), true)
  assert.equal(show('0.1.4', null, false), false)
  assert.equal(show('0.1.4', '0.1.4', true), false)
  assert.equal(show('0.1.3', '0.1.4', true), false)
  assert.equal(show('0.1.4', '0.1.3', true), true)
  assert.equal(show('0.1.4', null, true), true)
  assert.equal(show('0.1.99', '0.1.4', true), false)
})

test('skipped releases appear in order, without future or already seen notes', () => {
  const versions = (version: string, since?: string) => notesForRelease(version, since, fixture).map((n) => n.version)
  assert.deepEqual(versions('0.1.5', '0.1.3'), ['0.1.5', '0.1.4'])
  assert.deepEqual(versions('0.1.4', '0.1.1'), ['0.1.4', '0.1.3', '0.1.2'])
  assert.deepEqual(versions('0.1.4'), ['0.1.4'])
  assert.deepEqual(versions('0.1.3'), ['0.1.3'])
  assert.equal(compareReleaseVersions('0.1.10', '0.1.9'), 1)
  assert.equal(compareReleaseVersions('0.1.4-beta', '0.1.3'), null)
})

test('GitHub release notes use the same curated highlights and fixes as the app', () => {
  const text = releaseNotes('0.1.5', fixture)
  for (const entry of notesForRelease('0.1.5', null, fixture)) {
    for (const highlight of entry.highlights) {
      assert.ok(text.includes(highlight.title))
      assert.ok(text.includes(highlight.text))
    }
    for (const fix of entry.fixes) assert.ok(text.includes(fix))
  }
  assert.throws(() => releaseNotes('0.1.99', fixture), /Add release notes/)
})
