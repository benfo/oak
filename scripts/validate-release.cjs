const { version } = require('../package.json')
const { releaseNotes } = require('./release-notes.cjs')

if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Only stable x.y.z versions can be published by this workflow.')
if (process.env.GITHUB_REF !== `refs/tags/v${version}`) {
  throw new Error(`The release tag must match package.json: v${version}`)
}
releaseNotes(version)
console.log(`Validated v${version} and its release notes.`)
