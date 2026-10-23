const { existsSync, readFileSync, statSync } = require('node:fs')
const { join } = require('node:path')
const { createHash } = require('node:crypto')

/** Validate complete, matching packages before uploading or publishing anything. */
function collectReleaseAssets(directory, version, linuxOnly = false) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Expected a stable release version.')
  const linux = [`Oak-${version}-linux-x86_64.AppImage`, `Oak-${version}-linux-amd64.deb`, 'latest-linux.yml']
  const windows = [`Oak-Setup-${version}.exe`, `Oak-Setup-${version}.exe.blockmap`, 'latest.yml']
  const names = linuxOnly ? linux : [...windows, ...linux]
  for (const name of names) {
    const file = join(directory, name)
    if (!existsSync(file) || !statSync(file).isFile() || !statSync(file).size) throw new Error(`Missing release asset: ${name}`)
  }
  for (const [manifest, binaries] of [
    ...(!linuxOnly ? [['latest.yml', windows.slice(0, 1)]] : []),
    ['latest-linux.yml', linux.slice(0, 2)]
  ]) {
    const text = readFileSync(join(directory, manifest), 'utf8')
    if (!text.startsWith(`version: ${version}\n`) && !text.startsWith(`version: ${version}\r\n`)) throw new Error(`Wrong version in ${manifest}`)
    for (const name of binaries) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const entry = new RegExp(`url: ${escaped}\\r?\\n\\s+sha512: (\\S+)\\r?\\n\\s+size: (\\d+)`).exec(text)
      const bytes = readFileSync(join(directory, name))
      if (!entry || Number(entry[2]) !== bytes.length || entry[1] !== createHash('sha512').update(bytes).digest('base64')) {
        throw new Error(`Update metadata does not match ${name}`)
      }
    }
  }
  return names.map((name) => join(directory, name))
}

module.exports = { collectReleaseAssets }
