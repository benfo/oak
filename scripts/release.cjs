// Publish only a complete, verified cross-platform artifact set. Packaging runs in native CI jobs.
const { execFileSync } = require('child_process')
const { mkdirSync, writeFileSync } = require('fs')
const { resolve } = require('path')
const { releaseNotes } = require('./release-notes.cjs')
const { collectReleaseAssets } = require('./release-assets.cjs')
const { version } = require('../package.json')

const repo = 'benfo/oak'
const tag = `v${version}`
const linuxOnly = process.argv.includes('--linux-only')
const assets = collectReleaseAssets(resolve(__dirname, '../dist'), version, linuxOnly)
const notes = releaseNotes(version)
const notesPath = resolve(__dirname, '../dist/release-notes.md')
mkdirSync(resolve(__dirname, '../dist'), { recursive: true })
writeFileSync(notesPath, notes)

if (!process.env.GH_TOKEN) {
  try {
    process.env.GH_TOKEN = execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim()
  } catch {
    console.error('Set GH_TOKEN or log in with gh auth login before releasing.')
    process.exit(1)
  }
}
const gh = (args, options = {}) => execFileSync('gh', [...args, '--repo', repo], { encoding: 'utf8', ...options })
let existing
try {
  existing = JSON.parse(gh(['release', 'view', tag, '--json', 'isDraft,assets']))
} catch (error) {
  // Only a missing release is a new release; authentication/network failures must stop publishing.
  if (!String(error.stderr || '').includes('release not found')) throw error
}
if (linuxOnly) {
  if (!existing || existing.isDraft) throw new Error('Linux backfill requires an existing published release.')
  if (
    existing.assets.some((asset) => asset.name.endsWith('.AppImage') || asset.name.endsWith('.deb') || asset.name === 'latest-linux.yml')
  ) {
    throw new Error('Linux assets already exist. Do not replace published packages; use a new version.')
  }
  // Make both binaries available before exposing their updater manifest.
  gh(['release', 'upload', tag, ...assets.filter((file) => !file.endsWith('.yml'))])
  gh(['release', 'upload', tag, ...assets.filter((file) => file.endsWith('.yml'))])
  gh(['release', 'edit', tag, '--notes-file', notesPath])
  console.log(gh(['release', 'view', tag, '--json', 'url', '--jq', '.url']).trim())
  process.exit(0)
}
if (existing && !existing.isDraft) throw new Error(`${tag} is already published. Bump the version before releasing.`)
if (existing) gh(['release', 'edit', tag, '--title', version, '--notes-file', notesPath])
else gh(['release', 'create', tag, '--draft', '--title', version, '--notes-file', notesPath])

gh(['release', 'upload', tag, ...assets, '--clobber'])

const release = JSON.parse(gh(['release', 'view', tag, '--json', 'assets']))
const uploaded = new Set(release.assets.map((asset) => asset.name))
if (assets.some((file) => !uploaded.has(require('path').basename(file)))) {
  throw new Error('Release is missing Windows or Linux assets; it has been left in draft.')
}
gh(['release', 'edit', tag, '--draft=false', '--latest', '--notes-file', notesPath])
console.log(gh(['release', 'view', tag, '--json', 'url', '--jq', '.url']).trim())
