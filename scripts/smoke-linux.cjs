// Run the real packaged app against a disposable Git repository, with its sandbox enabled.
const { spawnSync, execFileSync } = require('node:child_process')
const { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, existsSync, rmSync, openSync, closeSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join, resolve } = require('node:path')
const { version } = require('../package.json')

if (process.platform !== 'linux') throw new Error('This smoke test requires Linux and a display (or xvfb-run).')
const executable = resolve(process.argv[2] || '/opt/Oak/oak')
const scratch = mkdtempSync(join(tmpdir(), 'oak-linux-smoke-'))
const repo = join(scratch, 'repo')
const output = resolve('out/linux-smoke')
mkdirSync(repo)
mkdirSync(join(scratch, 'profile', 'Local Storage'), { recursive: true })
mkdirSync(output, { recursive: true })
const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim()
try {
  git('init', '-b', 'main')
  git('config', 'user.name', 'Oak Package Test')
  git('config', 'user.email', 'oak@example.test')
  writeFileSync(join(repo, 'example.ts'), 'export const amount = 75\n')
  git('add', '.')
  git('commit', '-m', 'Add sample file')
  writeFileSync(join(repo, 'example.ts'), 'export const amount = 100\n')
  const expression = `(async () => {
    if (window.bridge.platform !== 'linux') throw Error('Expected Linux preload bridge')
    if (await window.bridge.invoke('appVersion') !== ${JSON.stringify(version)}) throw Error('Wrong package version')
    if (typeof require !== 'undefined') throw Error('Node must not be available in the renderer')
    for (let i = 0; i < 200; i++) {
      if (document.querySelector('.changes-diff .dl.add')?.textContent.includes('100')) break
      await new Promise(r => setTimeout(r, 50))
    }
    if (!document.querySelector('.changes-diff .dl.add')?.textContent.includes('100')) throw Error('Working diff did not load')
    await window.bridge.invoke('stage', ${JSON.stringify(repo)}, ['example.ts'])
    return 'PASS Linux packaged UI, diff and Git staging'
  })()`
  const logFile = join(output, 'smoke.log')
  const logHandle = openSync(logFile, 'w')
  const result = spawnSync(executable, [repo, `--user-data-dir=${join(scratch, 'profile')}`, '--disable-gpu', '--enable-logging=stderr'], {
    stdio: ['ignore', logHandle, logHandle],
    timeout: 45000,
    killSignal: 'SIGKILL',
    env: { ...process.env, OAK_SCREENSHOT: join(scratch, 'smoke.png'), OAK_SCREENSHOT_KEYS: 'Control+1', OAK_SCREENSHOT_JS: expression }
  })
  closeSync(logHandle)
  const log = readFileSync(logFile, 'utf8')
  if (existsSync(join(scratch, 'smoke.png'))) copyFileSync(join(scratch, 'smoke.png'), join(output, 'smoke.png'))
  if (result.error || result.status !== 0 || !log.includes('screenshot js: PASS Linux packaged')) {
    throw new Error(`Packaged Linux smoke test failed: ${result.error?.message || result.status}\n${log}`)
  }
  if (git('diff', '--cached', '--name-only') !== 'example.ts' || !git('diff', '--cached').includes('+export const amount = 100')) {
    throw new Error('The packaged app did not stage the expected Git change.')
  }
  console.log(`PASS Oak ${version}: packaged Linux UI, real diff and Git staging`)
} finally {
  rmSync(scratch, { recursive: true, force: true })
}
