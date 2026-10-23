const releases = require('../src/shared/releases.json')

function releaseNotes(version) {
  const release = releases.find((entry) => entry.version === version)
  if (!release) throw new Error(`Add release notes for ${version} to src/shared/releases.json before publishing.`)
  const highlights = release.highlights.flatMap((item) => [`### ${item.title}`, '', item.text, ''])
  const fixes = release.fixes.length ? ['### Fixes', '', ...release.fixes.map((text) => `- ${text}`), ''] : []
  return [`## Oak ${version}`, '', ...highlights, ...fixes].join('\n')
}

module.exports = { releaseNotes }
