import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { collectReleaseAssets } from '../scripts/release-assets.cjs'

const version = '0.1.6'
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'oak-release-assets-'))
  const windows = 'Oak-Setup-0.1.6.exe'
  const linux = ['Oak-0.1.6-linux-x86_64.AppImage', 'Oak-0.1.6-linux-amd64.deb']
  const binaries = [windows, ...linux]
  for (const name of [...binaries, `${windows}.blockmap`]) writeFileSync(join(directory, name), `test ${name}`)
  for (const [manifest, names] of [['latest.yml', [windows]], ['latest-linux.yml', linux]] as const) {
    writeFileSync(join(directory, manifest), `version: ${version}\nfiles:\n` + names.map((name) => {
      const bytes = readFileSync(join(directory, name))
      return `  - url: ${name}\n    sha512: ${createHash('sha512').update(bytes).digest('base64')}\n    size: ${bytes.length}\n`
    }).join(''))
  }
  return directory
}

test('new releases require matching Windows and Linux binaries and updater metadata', (t) => {
  const directory = fixture(); t.after(() => rmSync(directory, { recursive: true, force: true }))
  assert.equal(collectReleaseAssets(directory, version).length, 6)
  rmSync(join(directory, 'Oak-0.1.6-linux-amd64.deb'))
  assert.throws(() => collectReleaseAssets(directory, version), /Missing release asset/)
})

test('release validation rejects changed bytes and mismatched manifest versions', (t) => {
  const directory = fixture(); t.after(() => rmSync(directory, { recursive: true, force: true }))
  writeFileSync(join(directory, 'Oak-0.1.6-linux-amd64.deb'), 'corrupted')
  assert.throws(() => collectReleaseAssets(directory, version), /metadata does not match/)
  writeFileSync(join(directory, 'latest-linux.yml'), 'version: 0.1.5\n')
  assert.throws(() => collectReleaseAssets(directory, version), /Wrong version/)
})

test('Linux backfill validates only Linux assets and never needs Windows binaries', (t) => {
  const directory = fixture(); t.after(() => rmSync(directory, { recursive: true, force: true }))
  rmSync(join(directory, 'Oak-Setup-0.1.6.exe'))
  assert.equal(collectReleaseAssets(directory, version, true).length, 3)
  assert.throws(() => collectReleaseAssets(directory, '../0.1.6'), /stable release version/)
})
