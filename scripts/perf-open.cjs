// Times opening a repository in the real app and counts the git commands it runs.
//   npm run build && node scripts/perf-open.cjs <label> <runs> <repo>...
// For each repo it launches Oak and prints, as JSON, the median milliseconds since launch until the toolbar, the
// status, the first commits, the complete sidebar branch count and the usable branch button appear, plus how many
// git commands ran while opening, over five window focuses, and after an outside `git add` (counted with GIT_TRACE).
// To compare with another commit: `git switch --detach <commit>`, build, run with another label, switch back.
// A synthetic repo with many refs: `git update-ref --stdin` with `create refs/heads/b-N HEAD` lines, then
// `git pack-refs --all` (most real repos have packed refs). The repo gets a temporary file staged and unstaged.
const { _electron: electron } = require('@playwright/test')
const { execFileSync } = require('child_process')
const fs = require('fs'),
  os = require('os'),
  path = require('path')
const electronPath = require('electron')
const root = path.join(__dirname, '..')
const [label, runsArg, ...repos] = process.argv.slice(2)
if (!label || !(Number(runsArg) > 0) || !repos.length) {
  console.error('Usage: node scripts/perf-open.cjs <label> <runs> <repo>...')
  process.exit(1)
}
const runs = Number(runsArg)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]
const gitCount = (file, re) =>
  fs.existsSync(file)
    ? fs
        .readFileSync(file, 'utf8')
        .split('\n')
        .filter((l) => re.test(l)).length
    : 0

async function once(repo) {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'oak-perf-ud-'))
  const trace = path.join(ud, 'trace.txt')
  const heads = execFileSync('git', ['for-each-ref', '--format=x', 'refs/heads'], { cwd: repo, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean).length
  const app = await electron.launch({
    executablePath: electronPath,
    args: [root, repo, `--user-data-dir=${ud}`],
    env: { ...process.env, GIT_TRACE: trace }
  })
  const page = await app.firstWindow()
  const at = (fn, arg) => page.waitForFunction(fn, arg, { polling: 'raf', timeout: 60000 }).then((h) => h.jsonValue())
  const m = {}
  await Promise.all([
    at(() => (document.querySelector('[role=toolbar][aria-label="Repository actions"]') ? performance.now() : false)).then(
      (t) => (m.toolbar = t)
    ),
    at(() =>
      document.querySelector('.tb-branch span:not(.spinner)')?.textContent &&
      !/^…$/.test(document.querySelector('.tb-branch span:not(.spinner)').textContent)
        ? performance.now()
        : false
    ).then((t) => (m.status = t)),
    at(() => (document.querySelector('.commit-list [role=option]') ? performance.now() : false)).then((t) => (m.firstCommits = t)),
    at((n) => {
      const c = [...document.querySelectorAll('.section-count')].map((e) => e.textContent)
      return c.includes(String(n)) ? performance.now() : false
    }, heads).then((t) => (m.sidebarBranches = t)),
    at(() => {
      const b = document.querySelector('.tb-branch')
      return b && !b.disabled && !b.querySelector('.spinner') ? performance.now() : false
    }).then((t) => (m.branchButton = t))
  ])
  await sleep(2500) // let the first load settle completely
  const afterOpen = {
    forEachRef: gitCount(trace, /built-in: git for-each-ref/),
    log: gitCount(trace, /built-in: git log/),
    all: gitCount(trace, /built-in: git /)
  }
  // Five window focuses in a row.
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await sleep(300)
  }
  await sleep(1500)
  const afterFocus = {
    forEachRef: gitCount(trace, /built-in: git for-each-ref/),
    log: gitCount(trace, /built-in: git log/),
    all: gitCount(trace, /built-in: git /)
  }
  // Something stages a file from outside (touches .git/index).
  fs.writeFileSync(path.join(repo, 'perf-new.txt'), String(Math.random()))
  execFileSync('git', ['add', 'perf-new.txt'], { cwd: repo })
  await sleep(2500)
  const afterStage = {
    forEachRef: gitCount(trace, /built-in: git for-each-ref/),
    log: gitCount(trace, /built-in: git log/),
    all: gitCount(trace, /built-in: git /)
  }
  execFileSync('git', ['reset', '-q', 'perf-new.txt'], { cwd: repo })
  fs.rmSync(path.join(repo, 'perf-new.txt'))
  await app.close()
  fs.rmSync(ud, { recursive: true, force: true })
  return { m, afterOpen, afterFocus, afterStage }
}

;(async () => {
  for (const repo of repos) {
    const rs = []
    for (let i = 0; i < runs; i++) rs.push(await once(repo))
    const keys = ['toolbar', 'status', 'firstCommits', 'sidebarBranches', 'branchButton']
    const t = Object.fromEntries(keys.map((k) => [k, Math.round(median(rs.map((r) => r.m[k])))]))
    const d = (a, b, k) => median(rs.map((r) => r[b][k] - r[a][k]))
    console.log(
      JSON.stringify({
        label,
        repo: path.basename(repo),
        runs,
        msSinceLaunchMedian: t,
        gitOnOpen: {
          forEachRef: median(rs.map((r) => r.afterOpen.forEachRef)),
          log: median(rs.map((r) => r.afterOpen.log)),
          all: median(rs.map((r) => r.afterOpen.all))
        },
        gitFor5Focuses: {
          forEachRef: d('afterOpen', 'afterFocus', 'forEachRef'),
          log: d('afterOpen', 'afterFocus', 'log'),
          all: d('afterOpen', 'afterFocus', 'all')
        },
        gitForExternalStage: {
          forEachRef: d('afterFocus', 'afterStage', 'forEachRef'),
          log: d('afterFocus', 'afterStage', 'log'),
          all: d('afterFocus', 'afterStage', 'all')
        }
      })
    )
  }
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
