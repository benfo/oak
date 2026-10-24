import { _electron as electron, test as base, type ElectronApplication, type Page } from '@playwright/test'
import { hugeDiffRepo, manyCommits, removeDir, smallRepo, tempDir } from './repos'

// The electron package exports the path of the binary.
const electronPath = require('electron') as unknown as string
const root = process.cwd()

export interface Launched {
  app: ElectronApplication
  page: Page
}

async function launch(repo: string): Promise<Launched> {
  const userData = tempDir('userdata')
  const app = await electron.launch({
    executablePath: electronPath,
    args: [root, repo, `--user-data-dir=${userData}`]
  })
  const page = await app.firstWindow()
  const close = app.close.bind(app)
  app.close = async () => {
    await close()
    removeDir(userData)
  }
  await page.waitForLoadState('domcontentloaded')
  return { app, page }
}

interface Fixtures {
  /** Opens the app on a repo (on Changes unless `view` says otherwise); closed after the test. */
  open: (repo: string, view?: 'changes' | 'history') => Promise<Page>
  /** A fresh small repo with a modified file (three hunks) and an untracked file. */
  small: string
}
interface WorkerFixtures {
  /** Large repos are built once per run and only read by the tests. */
  commits5k: string
  hugeDiff: string
}

export const test = base.extend<Fixtures, WorkerFixtures>({
  open: async ({}, use) => {
    const launched: Launched[] = []
    await use(async (repo, view = 'changes') => {
      const l = await launch(repo)
      launched.push(l)
      await l.page.getByRole('toolbar', { name: 'Repository actions' }).waitFor()
      await l.page.keyboard.press(view === 'changes' ? 'Control+1' : 'Control+2')
      return l.page
    })
    for (const l of launched) await l.app.close()
  },
  small: async ({}, use) => {
    const dir = tempDir('small')
    smallRepo(dir)
    await use(dir)
    removeDir(dir)
  },
  commits5k: [
    async ({}, use) => {
      const dir = tempDir('commits')
      manyCommits(dir, 5000)
      await use(dir)
      removeDir(dir)
    },
    { scope: 'worker' }
  ],
  hugeDiff: [
    async ({}, use) => {
      const dir = tempDir('huge')
      hugeDiffRepo(dir)
      await use(dir)
      removeDir(dir)
    },
    { scope: 'worker' }
  ]
})

export { expect } from '@playwright/test'
