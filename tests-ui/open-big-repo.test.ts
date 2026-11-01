import { execFileSync } from 'node:child_process'
import { expect, test } from './fixtures'
import { manyRefsRepo, removeDir, tempDir } from './repos'

const count = (dir: string, pattern: string) =>
  execFileSync('git', ['for-each-ref', '--format=x', pattern], { cwd: dir, encoding: 'utf8' }).split('\n').filter(Boolean).length

/** Opening a big repo must not wait on the slow per-ref details, and nothing may look complete before it is. */
test('while branch details load, Changes works and branch lists are inert, then every ref is listed', async ({ openApp }) => {
  const dir = tempDir('openbig')
  manyRefsRepo(dir, 300)
  try {
    const { app, page } = await openApp(dir, 'changes')
    // Hold the slow call back so the first load can be seen, then reload the window onto the same repo.
    await app.evaluate(({ ipcMain }) => {
      const handlers = (ipcMain as unknown as { _invokeHandlers: Map<string, (...a: unknown[]) => Promise<unknown>> })._invokeHandlers
      const real = handlers.get('git:branchDetails')!
      handlers.set('git:branchDetails', async (...a) => {
        await new Promise((r) => setTimeout(r, 2500))
        return real(...a)
      })
    })
    await page.reload()
    const branch = page.locator('.tb-branch')
    await expect(branch).toBeDisabled()
    await expect(branch.locator('.spinner')).toBeVisible()
    // Changes is already usable, and the sidebar says it is still loading rather than showing zero.
    await expect(page.getByRole('toolbar', { name: 'Repository actions' })).toBeVisible()
    await page.keyboard.press('Control+B')
    await expect(page.getByText('Still loading branches…')).toBeVisible()

    await expect(branch).toBeEnabled({ timeout: 10_000 })
    // The Branches count matches what git lists, exactly (Tags sits below the fold of the virtualized sidebar).
    const heads = count(dir, 'refs/heads')
    expect(heads).toBe(301)
    await expect(page.locator('.section-count', { hasText: new RegExp(`^${heads}\$`) })).toHaveCount(1)
  } finally {
    removeDir(dir)
  }
})
